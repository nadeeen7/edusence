import os
import secrets
import traceback
import csv
import io
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, session, redirect, url_for, render_template, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Local Imports
from config import Config
from models import db, Teacher, Student, MonitoringSession, AttentionLog, Alert, MeetingLink
from auth import generate_token, token_required

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)

# Initialize Extensions
origins = [
    app.config.get('FRONTEND_URL', 'http://localhost:5173'),
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174'
]

CORS(app, supports_credentials=True, origins=origins)
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# --- Internal State ---
classroom_sessions = {} # { room_code: { students: { id: { name, attention, ... } }, active: bool } }
connected_students = {} # { sid: { student_id, name, room } }
disconnection_timers = {}

# --- Password Helpers ---
def hash_password(password):
    return generate_password_hash(password)

def verify_password(hashed_password, password):
    return check_password_hash(hashed_password, password)

# --- Routes ---

@app.route('/')
def index():
    return jsonify({"status": "Online Attention Detector API is running"}), 200

@app.route('/register', methods=['POST'])
def register():
    """Register student or teacher with hashed password"""
    try:
        data = request.json
        print(f"Registration Attempt: {data}")
        name = data.get('name')
        email = data.get('email', '').strip().lower()
        password = data.get('password')
        role = data.get('role', 'student')

        if not all([name, email, password]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400

        if Teacher.query.filter_by(email=email).first() or Student.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already registered'}), 400

        if role == 'teacher':
            new_user = Teacher(name=name, email=email, password=hash_password(password))
        else:
            student_count = Student.query.count()
            student_id = f"STU{str(student_count + 1).zfill(3)}"
            new_user = Student(id=student_id, name=name, email=email, password=hash_password(password))

        db.session.add(new_user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Registration successful'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    """Universal login returning JWT"""
    try:
        data = request.json
        email = data.get('email', '').strip().lower()
        password = data.get('password')
        role = data.get('role', 'student')

        user = None
        if role == 'teacher':
            user = Teacher.query.filter_by(email=email).first()
        else:
            user = Student.query.filter_by(email=email).first()

        if user and verify_password(user.password, password):
            token = generate_token(user.id, role)
            return jsonify({
                'success': True,
                'token': token,
                'user': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'role': role
                }
            }), 200
        
        # New: Check if the email exists for the OTHER role to provide a helpful error
        other_role = 'student' if role == 'teacher' else 'teacher'
        other_user = Student.query.filter_by(email=email).first() if role == 'teacher' else Teacher.query.filter_by(email=email).first()
        
        if other_user:
            return jsonify({
                'success': False, 
                'message': f'This email is registered as a {other_role}. Please use the {other_role} login portal.'
            }), 401
            
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/validate_room', methods=['GET'])
@token_required
def validate_room(current_user):
    room_code = request.args.get('code', '').strip().upper()
    room = MeetingLink.query.filter_by(link_code=room_code).first()
    if room and room.is_active:
        return jsonify({'valid': True, 'class_name': room.class_name})
    return jsonify({'valid': False, 'message': 'Invalid or inactive Room ID'}), 404

@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats(current_user):
    try:
        total_students = Student.query.count()
        
        # Get all meeting links for this teacher
        all_meetings = MeetingLink.query.filter_by(teacher_id=current_user.id).order_by(MeetingLink.created_at.desc()).all()
        
        last_class_room = None
        if all_meetings:
            # If the first one is active, the "Last Class" is the second one.
            # Otherwise, the first one is the "Last Class".
            if all_meetings[0].is_active and len(all_meetings) > 1:
                last_class_room = all_meetings[1]
            elif not all_meetings[0].is_active:
                last_class_room = all_meetings[0]

        # Initialize defaults
        last_class_stats = {
            "duration": "0 mins",
            "studentsCount": 0,
            "avgAttention": 0,
            "focusedCount": 0,
            "distractedCount": 0,
            "bestStudent": "N/A",
            "needsImprovement": "N/A"
        }

        if last_class_room:
            sessions = MonitoringSession.query.filter_by(room_code=last_class_room.link_code).all()
            if sessions:
                last_class_stats["studentsCount"] = len(sessions)
                valid_attentions = [s.avg_attention for s in sessions if s.avg_attention is not None]
                if valid_attentions:
                    last_class_stats["avgAttention"] = round(sum(valid_attentions) / len(valid_attentions))
                    
                    # Focused/Distracted (Threshold 60%)
                    last_class_stats["focusedCount"] = len([a for a in valid_attentions if a >= 60])
                    last_class_stats["distractedCount"] = len([a for a in valid_attentions if a < 60])
                    
                    # Best/Needs Improvement
                    # Join with Student to get names
                    session_data = db.session.query(Student.name, MonitoringSession.avg_attention)\
                        .join(MonitoringSession, Student.id == MonitoringSession.student_id)\
                        .filter(MonitoringSession.room_code == last_class_room.link_code)\
                        .filter(MonitoringSession.avg_attention.isnot(None))\
                        .order_by(MonitoringSession.avg_attention.desc()).all()
                    
                    if session_data:
                        last_class_stats["bestStudent"] = session_data[0][0]
                        last_class_stats["needsImprovement"] = session_data[-1][0]

                # Duration calculation
                start_times = [s.start_time for s in sessions if s.start_time]
                end_times = [s.end_time for s in sessions if s.end_time]
                if start_times and end_times:
                    duration = max(end_times) - min(start_times)
                    minutes = int(duration.total_seconds() / 60)
                    last_class_stats["duration"] = f"{minutes} mins"

        # Current live session stats (already partially implemented)
        room_code = request.args.get('room')
        if not room_code and all_meetings and all_meetings[0].is_active:
            room_code = all_meetings[0].link_code

        active_count = 0
        current_class_avg = 0
        status = "Inactive"
        highest_attn_str = "N/A"
        lowest_attn_str = "N/A"

        if room_code and room_code in classroom_sessions:
            room_data = classroom_sessions[room_code]
            active_students = [s for sid, s in room_data["students"].items() if s.get('connected')]
            active_count = len(active_students)
            if active_count > 0:
                current_class_avg = round(sum(s['attention'] for s in active_students) / active_count)
                
                # Sorted for best/worst in CURRENT session
                sorted_by_attn = sorted(active_students, key=lambda x: x['attention'], reverse=True)
                highest_attn_str = f"{sorted_by_attn[0]['name']} - {sorted_by_attn[0]['attention']}%"
                lowest_attn_str = f"{sorted_by_attn[-1]['name']} - {sorted_by_attn[-1]['attention']}%"
                
            status = "Active" if room_data.get('active') else "Ended"

        chart_data = [0]*9 + [current_class_avg] if active_count > 0 else [0]*10

        return jsonify({
            'success': True,
            'totalStudents': last_class_stats["studentsCount"], # Maps to "Previous Class Attendance"
            'activeStudents': active_count,
            'classAvg': current_class_avg, # Current live average
            'historicalAvg': last_class_stats["avgAttention"], # For the summary card
            'highestAttention': highest_attn_str, # Current best
            'lowestAttention': lowest_attn_str, # Current worst
            'classStatus': status,
            'chartData': chart_data,
            'lastClassStats': last_class_stats
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/download_report', methods=['GET'])
@token_required
def download_report(current_user):
    """Aggregate stats and generate CSV for all sessions"""
    try:
        room_limit = request.args.get('room')
        query = db.session.query(Student, MonitoringSession)\
            .join(MonitoringSession, Student.id == MonitoringSession.student_id)
        
        if room_limit:
            query = query.filter(MonitoringSession.room_code == room_limit)
            
        sessions = query.all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Student ID', 'Student Name', 'Room', 'Start Time', 'End Time', 'Avg Attention (%)', 'Alerts'])
        
        for student, ms in sessions:
            writer.writerow([
                student.id,
                student.name,
                ms.room_code,
                ms.start_time.isoformat() if ms.start_time else '',
                ms.end_time.isoformat() if ms.end_time else 'Active',
                round(ms.avg_attention or 0),
                ms.alerts_count or 0
            ])
            
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename=edusense_report_{datetime.now().strftime('%Y%m%d')}.csv"}
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate_meeting_link', methods=['POST'])
@token_required
def generate_meeting_link(current_user):
    try:
        if not isinstance(current_user, Teacher):
            return jsonify({'success': False, 'message': 'Only teachers can create classes'}), 403
        data = request.json
        teacher_id = current_user.id
        class_name = data.get('class_name', "AI Classroom")
        
        # Generate unique code
        link_code = secrets.token_hex(4).upper()
        new_link = MeetingLink(teacher_id=teacher_id, link_code=link_code, class_name=class_name)
        db.session.add(new_link)
        db.session.commit()
        
        return jsonify({'success': True, 'link_code': link_code}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/start_session', methods=['POST'])
@token_required
def start_session(current_user):
    try:
        if not isinstance(current_user, Student):
            return jsonify({'success': False, 'message': 'Only students can join sessions'}), 403
        data = request.json
        student_id = current_user.id
        room = data.get('room')
        
        if not room:
            return jsonify({'success': False, 'message': 'Room code required'}), 400
            
        # Check if session already exists
        session_rec = MonitoringSession.query.filter_by(student_id=student_id, room_code=room, end_time=None).first()
        if not session_rec:
            session_rec = MonitoringSession(student_id=student_id, room_code=room)
            db.session.add(session_rec)
            db.session.commit()
            
        return jsonify({'success': True, 'session_id': session_rec.id}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/end_session', methods=['POST'])
@token_required
def end_session_rest(current_user):
    try:
        data = request.json
        session_id = data.get('session_id')
        if not session_id:
            return jsonify({'success': False, 'message': 'Session ID required'}), 400
            
        session_rec = MonitoringSession.query.get(session_id)
        if session_rec:
            session_rec.end_time = db.func.current_timestamp()
            db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/get_student_stats/<student_id>', methods=['GET'])
@token_required
def get_student_stats(current_user, student_id):
    try:
        logs = AttentionLog.query.filter_by(student_id=student_id).order_by(AttentionLog.timestamp.desc()).limit(10).all()
        return jsonify({
            'success': True,
            'logs': [{'attention_score': l.attention_score, 'timestamp': l.timestamp.isoformat()} for l in logs]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# --- Socket.IO Handlers ---

@socketio.on('join_room')
def handle_join_room(data):
    room = data.get('room', '').strip().upper()
    role = data.get('role', 'student')
    user_id = data.get('student_id') or data.get('teacher_id')
    user_name = data.get('student_name') or data.get('teacher_name') or "User"

    if not room or not user_id: return

    join_room(room)
    if room not in classroom_sessions:
        classroom_sessions[room] = {"students": {}, "active": True, "history": []}

    if role == 'teacher':
        classroom_sessions[room]["teacher_sid"] = request.sid
        emit('room_joined', {'room': room, 'role': 'teacher'})
        emit('teacher_joined', {'teacher_id': user_id, 'teacher_name': user_name}, room=room, include_self=False)
        recalculate_and_broadcast_stats(room, include_students=True)
    else:
        connected_students[request.sid] = {'student_id': user_id, 'name': user_name, 'room': room}
        classroom_sessions[room]["students"][user_id] = {
            "name": user_name,
            "attention": 100,
            "connected": True,
            "status": "Focused"
        }
        emit('room_joined', {'room': room, 'role': 'student'})
        emit('user_joined', {'id': request.sid, 'student_id': user_id, 'student_name': user_name}, room=room, include_self=False)
        recalculate_and_broadcast_stats(room, include_students=True)

@socketio.on('attention_update')
@socketio.on('attention-update')
def handle_attention_update(data):
    room = data.get('room')
    student_id = data.get('student_id')
    attention = data.get('attention', 0)
    status = data.get('status', 'Unknown')
    
    if room in classroom_sessions:
        if student_id not in classroom_sessions[room]['students']:
            classroom_sessions[room]['students'][student_id] = {
                'name': data.get('student_name', 'Unknown'),
                'attention': attention,
                'status': status,
                'connected': True,
                'last_seen': datetime.now(),
                'hand_raised': False
            }
        else:
            student = classroom_sessions[room]['students'][student_id]
            student['attention'] = attention
            student['status'] = status
            student['last_seen'] = datetime.now()
            student['connected'] = True

        # Broadcast update to teacher
        emit('attention-update', {
            'student_id': student_id,
            'attention': attention,
            'status': status,
            'hand_raised': classroom_sessions[room]['students'][student_id].get('hand_raised', False)
        }, room=room)
        
        # Broadcast dashboard stats
        recalculate_and_broadcast_stats(room, include_students=True)

@socketio.on('raise_hand')
def handle_raise_hand(data):
    room = data.get('room')
    student_id = data.get('student_id')
    is_raised = data.get('is_raised', True)
    
    if room in classroom_sessions and student_id in classroom_sessions[room]['students']:
        classroom_sessions[room]['students'][student_id]['hand_raised'] = is_raised
        
        # Notify teacher
        emit('student_raised_hand', {
            'student_id': student_id,
            'student_name': classroom_sessions[room]['students'][student_id]['name'],
            'is_raised': is_raised
        }, room=room)
        
        print(f"[INFO] Student {student_id} {'raised' if is_raised else 'lowered'} hand in {room}")
        recalculate_and_broadcast_stats(room, include_students=True)

@socketio.on('request_sync')
def handle_request_sync(data):
    room = data.get('room')
    if room in classroom_sessions:
        recalculate_and_broadcast_stats(room, include_students=True)

@socketio.on('kick_student')
def handle_kick(data):
    room = data.get('room')
    student_id = data.get('student_id')
    if room and student_id:
        # Find the specific SID for this student_id in this room
        target_sid = None
        for sid, info in connected_students.items():
            if info['student_id'] == student_id and info['room'] == room:
                target_sid = sid
                break
        
        if target_sid:
            emit('kicked', {'message': 'You have been removed.'}, room=target_sid)
            print(f"[INFO] Student {student_id} kicked from room {room}")

@socketio.on('end_class')
@socketio.on('end_session')
def handle_end_class(data):
    room = data.get('room')
    if not room: return
    try:
        # Update both monitoring sessions and meeting links
        MonitoringSession.query.filter_by(room_code=room, end_time=None).update({
            "end_time": db.func.current_timestamp()
        })
        MeetingLink.query.filter_by(link_code=room).update({"is_active": False})
        db.session.commit()
        
        if room in classroom_sessions:
            classroom_sessions[room]["active"] = False
            
        # Unified event broadcast
        socketio.emit('class_ended', {'message': 'Class has ended.'}, room=room)
        print(f"[INFO] Room {room} ended by teacher")
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] Failed to end class {room}: {str(e)}")

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in connected_students:
        info = connected_students[request.sid]
        student_id = info['student_id']
        room = info['room']
        if room in classroom_sessions and student_id in classroom_sessions[room]["students"]:
            classroom_sessions[room]["students"][student_id]["connected"] = False
            recalculate_and_broadcast_stats(room, include_students=True)
            socketio.emit('student_left', {'student_id': student_id}, room=room)
        del connected_students[request.sid]

# WebRTC Signaling
@socketio.on('teacher_offer')
def handle_offer(data): emit('teacher_offer', data, room=data['to'])

@socketio.on('student_answer')
def handle_answer(data): emit('student_answer', data, room=data['room'], include_self=False)

@socketio.on('ice_candidate')
def handle_ice(data):
    if 'to' in data: emit('ice_candidate', data, room=data['to'])
    else: emit('ice_candidate', data, room=data['room'], include_self=False)

def recalculate_and_broadcast_stats(room, include_students=False):
    if room not in classroom_sessions: return
    students = classroom_sessions[room]["students"]
    active_students = [s for sid, s in students.items() if s.get('connected')]
    active_count = len(active_students)
    
    # Calculate average only for connected students
    class_avg = 0
    if active_count > 0:
        class_avg = round(sum(s['attention'] for s in active_students) / active_count)
    
    low_count = len([s for s in active_students if s['attention'] < 60])
    critical_count = len([s for s in active_students if s['attention'] < 40])
    
    highest = "N/A"
    lowest = "N/A"
    if active_students:
        sorted_students = sorted(active_students, key=lambda x: x['attention'], reverse=True)
        highest = f"{sorted_students[0]['name']} - {sorted_students[0]['attention']}%"
        lowest = f"{sorted_students[-1]['name']} - {sorted_students[-1]['attention']}%"

    payload = {
        'active_count': active_count,
        'class_avg': class_avg,
        'low_count': low_count,
        'critical_count': critical_count,
        'highest_attention': highest,
        'lowest_attention': lowest,
        'status': 'Active' if classroom_sessions[room].get('active') else 'Ended'
    }
    if include_students:
        payload['students'] = [
            {'id': sid, 'name': s['name'], 'attention': s['attention'], 'status': s['status']} 
            for sid, s in students.items() if s.get('connected')
        ]
    
    # Debug log for server activity
    print(f"[DEBUG] Room {room} Stats: {active_count} active, {class_avg}% avg")
    socketio.emit('dashboard_update', payload, room=room)

def log_attention_to_db(student_id, score, room, status=None):
    try:
        session_rec = MonitoringSession.query.filter_by(student_id=student_id, room_code=room, end_time=None).first()
        if not session_rec:
            session_rec = MonitoringSession(student_id=student_id, room_code=room)
            db.session.add(session_rec)
            db.session.flush()
        log = AttentionLog(session_id=session_rec.id, student_id=student_id, attention_score=score)
        db.session.add(log)
        session_rec.avg_attention = score
        if status and status != 'Focused':
            alert = Alert(session_id=session_rec.id, student_id=student_id, alert_type='Behavior', alert_message=f"Status: {status}")
            db.session.add(alert)
            session_rec.alerts_count = (session_rec.alerts_count or 0) + 1
        db.session.commit()
    except Exception as e:
        db.session.rollback()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=False, host='0.0.0.0', port=5000)
