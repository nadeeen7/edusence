import os
import sys

# Ensure local modules (config, models, auth) are importable when running from root
sys.path.insert(0, os.path.dirname(__file__))

import re
import time
import secrets
import traceback
import csv
import io
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, session, redirect, url_for, render_template, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_compress import Compress
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Local Imports
from config import Config
from models import db, Teacher, Student, MonitoringSession, AttentionLog, Alert, MeetingLink, SessionAnalytics
from auth import generate_token, token_required

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)

# Fix for Render DATABASE_URL (postgres:// -> postgresql://)
db_url = app.config.get('SQLALCHEMY_DATABASE_URI')
if db_url and db_url.startswith("postgres://"):
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url.replace("postgres://", "postgresql://", 1)

# SQLAlchemy Engine Options for stability and performance
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
    "pool_size": 5,
    "max_overflow": 10,
}

# Initialize Extensions
app.config['COMPRESS_REGISTER'] = True
Compress(app)
origins = [
    app.config.get('FRONTEND_URL', 'https://edusence.vercel.app'),
    'http://localhost:5173',
    'https://localhost:5173',
    'http://127.0.0.1:5173',
    'https://127.0.0.1:5173',
    'http://192.168.1.5:5173',
    'https://192.168.1.5:5173',
    re.compile(r"https://.*\.vercel\.app"),
    re.compile(r"https://.*\.railway\.app")
]

CORS(app, supports_credentials=True, origins=origins, expose_headers=["Content-Disposition"])
db.init_app(app)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    ping_timeout=60,
    ping_interval=25,
    async_mode='threading'
)

# Auto-create tables if they don't exist
with app.app_context():
    db.create_all()

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
    return jsonify({"status": "EduSense API is running"}), 200

@app.route('/health')
def health():
    return jsonify({"status": "running", "service": "EduSense API"}), 200

@app.route('/register', methods=['POST'])
def register():
    """Register student or teacher with hashed password"""
    try:
        data = request.json
        name = data.get('name')
        email = data.get('email', '').strip().lower()
        password = data.get('password')
        role = data.get('role', 'student')

        if not all([name, email, password]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400

        # Single combined check for email existence across both tables
        teacher_exists = Teacher.query.filter_by(email=email).first()
        student_exists = Student.query.filter_by(email=email).first()
        if teacher_exists or student_exists:
            return jsonify({'success': False, 'message': 'Email already registered'}), 400

        if role == 'teacher':
            new_user = Teacher(name=name, email=email, password=hash_password(password))
        else:
            # Use a timestamp-based ID to avoid count() query
            student_id = f"STU{str(int(time.time() * 1000))[-7:]}"
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
    if not isinstance(current_user, Teacher):
        return jsonify({'success': False, 'message': 'Teacher access required'}), 403
        
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
            "duration": 0,
            "studentsCount": 0,
            "avgAttention": 0,
            "bestStudent": "N/A",
            "needsImprovement": "N/A"
        }

        # Find the most recently completed session for this teacher
        last_analytics = SessionAnalytics.query.filter_by(teacher_id=current_user.id)\
            .order_by(SessionAnalytics.timestamp.desc()).first()
        
        if last_analytics:
            latest_session_id = last_analytics.session_id
            
            # Get all records for that exact session_id (one row per student)
            session_group = db.session.query(SessionAnalytics).filter_by(
                teacher_id=current_user.id, 
                session_id=latest_session_id
            ).all()
            
            print(f"[DEBUG] Dashboard: teacher={current_user.id}, latest_session_id={latest_session_id}, students_in_group={len(session_group) if session_group else 0}", flush=True)
                
            if session_group:
                last_class_stats["studentsCount"] = len(session_group)
                last_class_stats["avgAttention"] = round(sum(s.overall_attention for s in session_group) / len(session_group))
                last_class_stats["duration"] = session_group[0].class_duration
                
                sorted_sessions = sorted(session_group, key=lambda x: x.overall_attention, reverse=True)
                last_class_stats["bestStudent"] = f"{sorted_sessions[0].student_name} – {round(sorted_sessions[0].overall_attention)}%"
                last_class_stats["needsImprovement"] = f"{sorted_sessions[-1].student_name} – {round(sorted_sessions[-1].overall_attention)}%"

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
                highest_attn_str = f"{sorted_by_attn[0]['name']} – {sorted_by_attn[0]['attention']}%"
                lowest_attn_str = f"{sorted_by_attn[-1]['name']} – {sorted_by_attn[-1]['attention']}%"
                
            status = "Active" if room_data.get('active') else "Ended"

        # Update lastClassStats with distraction count
        if last_analytics and 'session_group' in locals() and 'session_group' in vars():
            last_class_stats["totalDistractions"] = sum(getattr(s, 'distraction_count', 0) for s in session_group)
        elif last_analytics:
             # Try to find session_group if it wasn't already calculated
             latest_ts = last_analytics.timestamp
             # We can't easily re-calculate session_group here without re-querying or restructuring.
             # Let's just use the single last_analytics distraction count as fallback if group fails.
             last_class_stats["totalDistractions"] = getattr(last_analytics, 'distraction_count', 0)
        else:
            last_class_stats["totalDistractions"] = 0

        # New minimal stats for professional dashboard
        total_classes = MeetingLink.query.filter_by(teacher_id=current_user.id).count()
        last_class_date = "N/A"
        if last_class_room:
            last_class_date = last_class_room.created_at.strftime("%b %d, %Y")

        # New Perfect Accuracy Attendance:
        # We count unique student_ids from MonitoringSession for the last session
        attendance_count = 0
        if last_class_room:
            attendance_count = db.session.query(MonitoringSession.student_id)\
                .filter_by(room_code=last_class_room.link_code)\
                .distinct().count()

        return jsonify({
            'success': True,
            'totalStudents': attendance_count, 
            'activeStudents': active_count,
            'classAvg': current_class_avg,
            'historicalAvg': last_class_stats["avgAttention"],
            'highestAttention': highest_attn_str,
            'lowestAttention': lowest_attn_str,
            'classStatus': status,
            'chartData': [], # Simplified for classy look
            'lastClassStats': last_class_stats,
            'totalClasses': total_classes,
            'lastClassDate': last_class_date
        })
    except Exception as e:
        print(f"[ERROR] SQL/Dashboard Exception: {str(e)}", flush=True)
        return jsonify({'success': False, 'message': "Failed to load dashboard statistics"}), 500

@app.route('/api/download_report', methods=['GET'])
@token_required
def download_report(current_user):
    """Aggregate stats and generate CSV for the most recently completed session"""
    if not isinstance(current_user, Teacher):
        return jsonify({'success': False, 'message': 'Teacher access required'}), 403
        
    try:
        # Find the most recently completed session for this teacher
        last_meeting = MeetingLink.query.filter_by(teacher_id=current_user.id, is_active=False)\
            .order_by(MeetingLink.created_at.desc()).first()
            
        print(f"[DEBUG] Download Report - Teacher ID: {current_user.id}, Last Meeting: {last_meeting.id if last_meeting else 'None'}", flush=True)
            
        if not last_meeting:
            return jsonify({'success': False, 'message': 'No completed sessions found'}), 404
            
        # Get analytics for this specific session
        records = SessionAnalytics.query.filter_by(session_id=last_meeting.id, teacher_id=current_user.id).all()
        
        if not records:
            return jsonify({'success': False, 'message': 'No data found for the latest session'}), 404
            
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Specified columns
        writer.writerow(['Student Name', 'Overall Attention (%)', 'Performance'])
        
        for r in records:
            attn = round(r.overall_attention)
            
            # Performance Classification
            if attn >= 80:
                perf = "Good"
            elif attn >= 50:
                perf = "Average"
            else:
                perf = "Needs Improvement"
                
            writer.writerow([r.student_name, f"{attn}%", perf])
            
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-disposition": f"attachment; filename=class_report_{last_meeting.id}.csv"
            }
        )
    except Exception as e:
        print(f"[ERROR] Report Generation Error: {str(e)}", flush=True)
        return jsonify({'success': False, 'message': "Failed to generate report"}), 500

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
        logs = AttentionLog.query.filter_by(student_id=student_id).order_by(AttentionLog.timestamp.desc()).limit(20).all()
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
    user_id = str(data.get('student_id') or data.get('teacher_id'))
    user_name = data.get('student_name') or data.get('teacher_name') or "User"

    if not room or not user_id: return

    join_room(room)
    if room not in classroom_sessions:
        classroom_sessions[room] = {"students": {}, "active": True, "history": []}

    if role == 'teacher':
        join_room(room)
        classroom_sessions[room]["teacher_sid"] = request.sid
        emit('room_joined', {'room': room, 'role': 'teacher'})
        emit('teacher_joined', {'teacher_id': user_id, 'teacher_name': user_name}, room=room, include_self=False)
        recalculate_and_broadcast_stats(room, include_students=True)
    else:
        join_room(room)
        connected_students[request.sid] = {'student_id': user_id, 'name': user_name, 'room': room}
        classroom_sessions[room]["students"][user_id] = {
            "name": user_name,
            "attention": 100,
            "connected": True,
            "status": "Focused",
            "hand_raised": False
        }
        emit('room_joined', {'room': room, 'role': 'student'})
        emit('user_joined', {'id': request.sid, 'student_id': user_id, 'student_name': user_name}, room=room, include_self=False)
        recalculate_and_broadcast_stats(room, include_students=True)

@socketio.on('attention_update')
@socketio.on('attention-update')
def handle_attention_update(data):
    room = data.get('room')
    student_id = str(data.get('student_id'))
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
    student_id = str(data.get('student_id'))
    is_raised = data.get('is_raised', True)
    
    if room in classroom_sessions and student_id in classroom_sessions[room]['students']:
        classroom_sessions[room]['students'][student_id]['hand_raised'] = is_raised
        
        # Notify teacher
        emit('student_raised_hand', {
            'student_id': student_id,
            'student_name': classroom_sessions[room]['students'][student_id]['name'],
            'is_raised': is_raised
        }, room=room)
        
        print(f"[INFO] Student {student_id} {'raised' if is_raised else 'lowered'} hand in {room}", flush=True)
        recalculate_and_broadcast_stats(room, include_students=True)

@socketio.on('media_state_change')
def handle_media_state_change(data):
    room = data.get('room')
    student_id = str(data.get('student_id'))
    
    if room in classroom_sessions and student_id in classroom_sessions[room]['students']:
        classroom_sessions[room]['students'][student_id]['video_enabled'] = data.get('videoEnabled', True)
        classroom_sessions[room]['students'][student_id]['audio_enabled'] = data.get('audioEnabled', True)
        
        emit('media_state_change', {
            'student_id': student_id,
            'videoEnabled': data.get('videoEnabled', True),
            'audioEnabled': data.get('audioEnabled', True)
        }, room=room)


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
        # Get teacher_id from room
        meeting = MeetingLink.query.filter_by(link_code=room).first()
        if not meeting: return
        
        current_time = datetime.now()
        duration_mins = 0
        if meeting.created_at:
            duration_mins = int((current_time - meeting.created_at).total_seconds() / 60)

        # Prevent duplicate analytics if end_class is called multiple times
        existing_analytics = SessionAnalytics.query.filter_by(session_id=meeting.id).first()
        if existing_analytics:
            print(f"[INFO] Analytics already saved for meeting {meeting.id}, skipping duplicate creation", flush=True)
        elif room in classroom_sessions:
            room_data = classroom_sessions[room]
            for student_id, s_data in room_data["students"].items():
                # Check for existing monitoring session to link ID and calculate True Average
                m_session = MonitoringSession.query.filter_by(student_id=student_id, room_code=room, end_time=None).first()
                
                overall_avg = s_data['attention'] # Fallback
                session_id_val = 0
                
                if m_session:
                    session_id_val = m_session.id
                    # Calculate true average from AttentionLog
                    logs = AttentionLog.query.filter_by(session_id=m_session.id).all()
                    if logs:
                        overall_avg = sum(l.attention_score for l in logs) / len(logs)
                    
                    m_session.end_time = current_time
                    m_session.avg_attention = overall_avg

                # Count distractions for this student/session
                distraction_count = Alert.query.filter_by(session_id=session_id_val).count() if session_id_val else 0

                # Save to SessionAnalytics — one row per student per session
                analysis = SessionAnalytics(
                    session_id=meeting.id, # Use MeetingLink.id for grouping
                    teacher_id=meeting.teacher_id,
                    student_name=s_data['name'],
                    overall_attention=overall_avg,
                    class_duration=duration_mins,
                    distraction_count=distraction_count
                )
                db.session.add(analysis)
            
            room_data["active"] = False
        
        # Also mark room inactive if it exists but analytics were already saved
        if room in classroom_sessions:
            classroom_sessions[room]["active"] = False

        # Close all active sessions for this room
        MonitoringSession.query.filter_by(room_code=room, end_time=None).update({
            "end_time": current_time
        })
        meeting.is_active = False
        db.session.commit()
        
        socketio.emit('class_ended', {'message': 'Class has ended.'}, room=room)
        print(f"[INFO] Room {room} ended and analytics saved", flush=True)
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] Failed to end class {room}: {str(e)}", flush=True)

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
    print(f"[DEBUG] Room {room} Stats: {active_count} active, {class_avg}% avg", flush=True)
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
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, debug=False, host='0.0.0.0', port=port)

@app.route('/api/log_error', methods=['POST'])
def log_error():
    print("REACT CRASH DETECTED =>", request.json, flush=True)
    return jsonify({"success": True}), 200
