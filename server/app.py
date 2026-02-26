from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_file
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import sqlite3
import json
import os
from datetime import datetime
import hashlib
import secrets
import csv
import io
import traceback

app = Flask(__name__)
# Use a stable secret key to keep sessions valid across server restarts
app.secret_key = "classroom_live_stable_secret_key_for_persistence"
# Configure sessions to last 7 days
from datetime import timedelta
app.permanent_session_lifetime = timedelta(days=7)

CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Track active connections: socket_id -> {student_id, name, room}
connected_students = {}
# Track classroom state: room_code -> { "students": { student_id: { name, attention, connected } } }
classroom_sessions = {}
# Track disconnection timers for grace period: student_id -> Timer object
disconnection_timers = {}

# Database configuration - using absolute path to avoid ambiguity
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, 'classroom.db')

def get_db():
    """Create database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Create teachers table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teachers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create students table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS monitoring_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            room_code TEXT,
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP,
            avg_attention REAL,
            alerts_count INTEGER DEFAULT 0,
            FOREIGN KEY (student_id) REFERENCES students(id)
        )
    ''')
    
    # Create attention logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attention_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            student_id TEXT NOT NULL,
            attention_score REAL NOT NULL,
            ear_value REAL,
            mar_value REAL,
            head_yaw TEXT,
            head_pitch TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id),
            FOREIGN KEY (student_id) REFERENCES students(id)
        )
    ''')
    
    # Create alerts table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            student_id TEXT NOT NULL,
            alert_type TEXT NOT NULL,
            alert_message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id),
            FOREIGN KEY (student_id) REFERENCES students(id)
        )
    ''')

    # Schema Migration: Add room_code to monitoring_sessions if missing
    try:
        cursor.execute("PRAGMA table_info(monitoring_sessions)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'room_code' not in columns:
            print("MIGRATION: Adding room_code column to monitoring_sessions")
            cursor.execute("ALTER TABLE monitoring_sessions ADD COLUMN room_code TEXT")
    except Exception as e:
        print(f"Migration error: {e}")
    
    # Create meeting_links table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS meeting_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            link_code TEXT UNIQUE NOT NULL,
            teacher_id INTEGER NOT NULL,
            class_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            FOREIGN KEY (teacher_id) REFERENCES teachers(id)
        )
    ''')
    
    conn.commit()
    conn.close()

def hash_password(password):
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

# Initialize database on startup
# Routes
@app.route('/')
@app.route('/home.html')
def index():
    """Home page"""
    return render_template('home.html')

@app.route('/test.html')
def test_page():
    """Test page for debugging"""
    return render_template('test.html')

@app.route('/register', methods=['GET', 'POST'])
@app.route('/register.html', methods=['GET', 'POST'])
def register():
    """Student registration page"""
    if request.method == 'POST':
        try:
            data = request.json
            name = data.get('name')
            email = data.get('email')
            password = data.get('password')
            role = data.get('role', 'student')
            
            if not all([name, email, password]):
                return jsonify({'success': False, 'message': 'All fields are required'}), 400
            
            conn = get_db()
            cursor = conn.cursor()
            
            if role == 'student':
                # Generate student ID
                cursor.execute('SELECT COUNT(*) as count FROM students')
                count = cursor.fetchone()['count']
                student_id = f"STU{str(count + 1).zfill(3)}"
                
                # Insert student
                cursor.execute('''
                    INSERT INTO students (id, name, email, password)
                    VALUES (?, ?, ?, ?)
                ''', (student_id, name, email, hash_password(password)))
                
            else:  # teacher
                cursor.execute('''
                    INSERT INTO teachers (name, email, password)
                    VALUES (?, ?, ?)
                ''', (name, email, hash_password(password)))
            
            conn.commit()
            conn.close()
            
            return jsonify({'success': True, 'message': 'Registration successful'})
            
        except sqlite3.IntegrityError:
            return jsonify({'success': False, 'message': 'Email already exists'}), 400
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500
    
    return render_template('register.html')

@app.route('/student_login', methods=['GET', 'POST'])
@app.route('/student_login.html', methods=['GET', 'POST'])
def student_login():
    """Student login page"""
    if request.method == 'POST':
        try:
            data = request.json
            email = data.get('email')
            password = data.get('password')
            
            conn = get_db()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM students WHERE email = ? AND password = ?
            ''', (email, hash_password(password)))
            
            student = cursor.fetchone()
            conn.close()
            
            if student:
                session['user_id'] = student['id']
                session['user_name'] = student['name']
                session['user_email'] = student['email']
                session['role'] = 'student'
                session.permanent = True # Make session persist after browser close/refresh
                
                return jsonify({
                    'success': True,
                    'user': {
                        'id': student['id'],
                        'name': student['name'],
                        'email': student['email'],
                        'role': 'student'
                    }
                })
            else:
                return jsonify({'success': False, 'message': 'Incorrect email or password'}), 401
                
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500
    
    return render_template('student_login.html')

@app.route('/teacher_login', methods=['GET', 'POST'])
@app.route('/teacher_login.html', methods=['GET', 'POST'])
def teacher_login():
    """Teacher login page"""
    if request.method == 'POST':
        try:
            data = request.json
            email = data.get('email')
            password = data.get('password')
            
            conn = get_db()
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM teachers WHERE email = ? AND password = ?
            ''', (email, hash_password(password)))
            
            teacher = cursor.fetchone()
            conn.close()
            
            if teacher:
                session['user_id'] = teacher['id']
                session['user_name'] = teacher['name']
                session['user_email'] = teacher['email']
                session['role'] = 'teacher'
                session.permanent = True # Make session persist after browser close/refresh
                
                return jsonify({
                    'success': True,
                    'user': {
                        'id': teacher['id'],
                        'name': teacher['name'],
                        'email': teacher['email'],
                        'role': 'teacher'
                    }
                })
            else:
                return jsonify({'success': False, 'message': 'Incorrect email or password'}), 401
                
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500
    
    return render_template('teacher_login.html')

@app.route('/student/classroom')
@app.route('/student_monitor')
@app.route('/student_monitor.html')
def student_monitor():
    """Student monitoring page"""
    if 'user_id' not in session or session.get('role') != 'student':
        return redirect(url_for('student_login'))
    
    room_code = request.args.get('code', '').upper()
    if not room_code:
        return redirect(url_for('student_dashboard'))
        
    # Validate room existence and status
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM meeting_links WHERE UPPER(link_code) = ? AND is_active = 1', (room_code,))
        room = cursor.fetchone()
        conn.close()
        
        if not room:
            # Check in-memory as backup 
            if room_code not in classroom_sessions:
                print(f"DEBUG: Room {room_code} not found in DB or memory.")
                return redirect(url_for('student_dashboard', error='invalid_room'))
    except Exception as e:
        print(f"Error validating room {room_code}: {e}")
        
    return render_template('student_monitor.html')

@app.route('/teacher_dashboard')
@app.route('/teacher_dashboard.html')
def teacher_dashboard():
    """Teacher dashboard page"""
    if 'user_id' not in session or session.get('role') != 'teacher':
        return redirect(url_for('teacher_login'))
    return render_template('teacher_dashboard.html')

@app.route('/student_dashboard')
@app.route('/student_dashboard.html')
def student_dashboard():
    """Student dashboard (lobby) page"""
    if 'user_id' not in session or session.get('role') != 'student':
        return redirect(url_for('student_login'))
    return render_template('student_dashboard.html')

@app.route('/api/start_session', methods=['POST'])
def start_session():
    """Start a new monitoring session"""
    try:
        data = request.json
        student_id = data.get('student_id')
        print(f"DEBUG: start_session call for {student_id} in room: {data.get('room')}")
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE monitoring_sessions
            SET end_time = CURRENT_TIMESTAMP
            WHERE student_id = ? AND end_time IS NULL
        ''', (student_id,))
        
        cursor.execute('''
            INSERT INTO monitoring_sessions (student_id, room_code)
            VALUES (?, ?)
        ''', (student_id, data.get('room')))
        
        session_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'session_id': session_id})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/log_attention', methods=['POST'])
def log_attention():
    """Log attention data"""
    try:
        data = request.json
        session_id = data.get('session_id')
        score = data.get('attention_score')
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO attention_logs 
            (session_id, student_id, attention_score, ear_value, mar_value, head_yaw, head_pitch)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            session_id,
            data.get('student_id'),
            score,
            data.get('ear_value'),
            data.get('mar_value'),
            data.get('head_yaw'),
            data.get('head_pitch')
        ))
        
        # Update session with current score (simulating real-time)
        cursor.execute('''
            UPDATE monitoring_sessions 
            SET avg_attention = ?
            WHERE id = ?
        ''', (score, session_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/log_alert', methods=['POST'])
def log_alert():
    """Log an alert to DB (Redundant for UI but kept for history logging)"""
    try:
        data = request.json
        log_attention_to_db(data.get('student_id'), None, data.get('room'), data.get('alert_type'), data.get('alert_message'))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/end_session', methods=['POST'])
def end_session():
    """End monitoring session"""
    try:
        data = request.json
        session_id = data.get('session_id')
        avg_attention = data.get('avg_attention')
        student_id = data.get('student_id')
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Get student name for notification
        cursor.execute('SELECT name FROM students WHERE id = ?', (student_id,))
        student = cursor.fetchone()
        student_name = student['name'] if student else 'Unknown'
        
        cursor.execute('''
            UPDATE monitoring_sessions 
            SET end_time = CURRENT_TIMESTAMP, avg_attention = ?
            WHERE id = ?
        ''', (avg_attention, session_id))
        
        conn.commit()
        conn.close()
        
        # Notify teacher dashboard that student left
        socketio.emit('student_left', {
            'student_id': student_id,
            'student_name': student_name,
            'timestamp': datetime.now().isoformat()
        }, room='teacher_room')
        
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500



@app.route('/api/get_students', methods=['GET'])
def get_students():
    """Get only students with active monitoring sessions for teacher dashboard"""
    try:
        room_arg = request.args.get('room')
        if room_arg in ['null', 'undefined', 'None', '']:
            room_arg = None
            
        print(f"DEBUG: get_students API called. Room Arg: {room_arg}")

        conn = get_db()
        cursor = conn.cursor()
        
        # Only get students who have an active monitoring session (end_time IS NULL)
        cursor.execute('''
            SELECT 
                s.id,
                s.name,
                s.email,
                ms.id as session_id,
                ms.avg_attention,
                ms.alerts_count,
                ms.room_code,
                ms.start_time
            FROM students s
            JOIN monitoring_sessions ms ON s.id = ms.student_id
            WHERE ms.end_time IS NULL AND (ms.room_code = ? OR ? IS NULL)
            ORDER BY ms.start_time DESC
        ''', (room_arg, room_arg))
        
        students = []
        for row in cursor.fetchall():
            students.append({
                'id': row['id'],
                'name': row['name'],
                'email': row['email'],
                'session_id': row['session_id'],
                'attention': row['avg_attention'] or 0,
                'alerts_count': row['alerts_count'] or 0,
                'start_time': row['start_time']
            })
        
        conn.close()
        
        return jsonify({'success': True, 'students': students})
        
    except Exception as e:
        print("ERROR in get_students:")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/get_student_stats/<student_id>', methods=['GET'])
def get_student_stats(student_id):
    """Get detailed stats for a specific student"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get latest attention logs
        cursor.execute('''
            SELECT attention_score, ear_value, mar_value, head_yaw, head_pitch, timestamp
            FROM attention_logs
            WHERE student_id = ?
            ORDER BY timestamp DESC
            LIMIT 20
        ''', (student_id,))
        
        logs = [dict(row) for row in cursor.fetchall()]
        
        # Get recent alerts
        cursor.execute('''
            SELECT alert_type, alert_message, timestamp
            FROM alerts
            WHERE student_id = ?
            ORDER BY timestamp DESC
            LIMIT 10
        ''', (student_id,))
        
        alerts = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify({
            'success': True,
            'logs': logs,
            'alerts': alerts
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/logout')
def logout():
    """Logout user"""
    session.clear()
    return redirect(url_for('index'))

@app.route('/api/generate_meeting_link', methods=['POST'])
def generate_meeting_link():
    """Generate unique meeting link for teacher"""
    try:
        data = request.json
        teacher_id = data.get('teacher_id')
        class_name = data.get('class_name', 'Classroom')
        
        # Generate unique link code
        link_code = secrets.token_urlsafe(8)
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO meeting_links (link_code, teacher_id, class_name)
            VALUES (?, ?, ?)
        ''', (link_code, teacher_id, class_name))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'link_code': link_code,
            'meeting_url': f'/join/{link_code}'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/validate_room', methods=['GET'])
def validate_room():
    """Check if a room ID exists and is active"""
    room_code = request.args.get('code', '').upper()
    print(f"DEBUG: Validating room: {room_code}")
    
    if not room_code:
        return jsonify({'valid': False, 'message': 'Room code required'}), 400
        
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM meeting_links WHERE UPPER(link_code) = ? AND is_active = 1', (room_code,))
        room = cursor.fetchone()
        conn.close()
        
        if room:
            print(f"DEBUG: Room {room_code} found in DB.")
            return jsonify({'valid': True})
        
        # Check in-memory as backup
        if room_code in classroom_sessions:
            print(f"DEBUG: Room {room_code} found in memory.")
            return jsonify({'valid': True})
            
        print(f"DEBUG: Room {room_code} NOT found.")
        return jsonify({'valid': False, 'message': 'Invalid Room ID. Please check the Room ID and try again.'}), 404
        
    except Exception as e:
        return jsonify({'valid': False, 'message': str(e)}), 500

@app.route('/api/get_recent_alerts', methods=['GET'])
def get_recent_alerts():
    """API for alerts is now deprecated for UI"""
    return jsonify({'success': True, 'alerts': []})

@app.route('/api/download_report', methods=['GET'])
def download_report():
    """Generate CSV report of all sessions"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get all completed or active sessions
        cursor.execute('''
            SELECT 
                s.name, 
                s.email, 
                ms.start_time, 
                ms.end_time, 
                ms.avg_attention, 
                ms.alerts_count
            FROM monitoring_sessions ms
            JOIN students s ON ms.student_id = s.id
            ORDER BY ms.start_time DESC
        ''')
        
        rows = cursor.fetchall()
        conn.close()
        
        # CSV Generation
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Student Name', 'Email', 'Start Time', 'End Time', 'Avg Attention (%)', 'Alerts Count'])
        
        for row in rows:
            writer.writerow([
                row['name'],
                row['email'],
                row['start_time'],
                row['end_time'] or 'Active',
                row['avg_attention'],
                row['alerts_count']
            ])
            
        output.seek(0)
        from flask import Response
        return Response(
            output,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=class_report.csv"}
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@socketio.on('create_class')
def handle_create_class():
    """Teacher creates a new unique class session"""
    room_code = secrets.token_hex(3).upper() # 6 chars
    
    # Store in DB for persistence and validation
    try:
        # We don't have teacher_id here easily from session in socket context sometimes, 
        # but we can try to get it or just store the code for validation.
        # Since this is a simple app, we'll store it as active.
        conn = get_db()
        cursor = conn.cursor()
        # Using a dummy teacher_id if not found, or ideally getting it from session
        teacher_id = session.get('user_id', 1) 
        cursor.execute('''
            INSERT INTO meeting_links (link_code, teacher_id, class_name, is_active)
            VALUES (?, ?, ?, ?)
        ''', (room_code, teacher_id, 'Classroom Session', 1))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error persisting room code: {e}")

    join_room(room_code)
    # Also join a generic teacher room for global ops if needed, but per-room is better
    emit('class_created', {'code': room_code})
    return room_code

@socketio.on('teacher_join')
def handle_teacher_join(data):
    """Teacher rejoins an existing room (e.g. after refresh)"""
    room = data.get('room')
    if not room: return
    join_room(room)
    print(f"DEBUG: Teacher rejoined room {room}")
    emit('class_created', {'code': room})

@socketio.on('join_class')
def handle_join_class(data):
    room = data.get('room')
    student_id = data.get('student_id')
    student_name = data.get('student_name')
    if not room or not student_id: return
    
    join_room(room)
    
    # Initialize database session (Persistence)
    try:
        conn = get_db()
        cursor = conn.cursor()
        # Look for existing active session
        cursor.execute("SELECT id FROM monitoring_sessions WHERE student_id = ? AND room_code = ? AND end_time IS NULL", (student_id, room))
        session_row = cursor.fetchone()
        
        if not session_row:
            print(f"DEBUG: Creating new DB session for {student_id} in {room}")
            cursor.execute("INSERT INTO monitoring_sessions (student_id, room_code) VALUES (?, ?)", (student_id, room))
            conn.commit()
        conn.close()
    except Exception as e:
        print(f"DEBUG ERROR: Failed to create DB session: {e}")

    # Track connection
    connected_students[request.sid] = {
        'student_id': student_id,
        'student_name': student_name,
        'room': room
    }

    # Initialize in-memory session
    if room not in classroom_sessions:
        classroom_sessions[room] = {"students": {}}
    
    classroom_sessions[room]["students"][student_id] = {
        "name": student_name,
        "attention": 100, # Default to 100 on join
        "connected": True
    }
    
    print(f"DEBUG: Student {student_name} joined room {room} in-memory.")
    
    emit('user_joined', {
        'id': request.sid, # Socket ID
        'student_id': student_id,
        'student_name': student_name
    }, room=room, include_self=False)

@socketio.on('rejoin_session')
def handle_rejoin_session(data):
    """Student rejoins after refresh - reuse same session/ID"""
    student_id = data.get('student_id')
    room = data.get('room')
    if not student_id or not room: return
    
    # Cancel any active disconnection timer
    if student_id in disconnection_timers:
        disconnection_timers[student_id].cancel()
        del disconnection_timers[student_id]
        print(f"DEBUG: Cancelled disconnection timer for {student_id}")
    
    join_room(room)
    connected_students[request.sid] = {
        'student_id': student_id,
        'student_name': data.get('student_name'),
        'room': room
    }
    
    # Notify teacher student is back
    emit('user_joined', {
        'id': request.sid,
        'student_id': student_id,
        'student_name': data.get('student_name'),
        'is_reconnect': True
    }, room=room, include_self=False)
    
    print(f"DEBUG: Student {student_id} successfully rejoined room {room}")

@socketio.on('request_sync')
def handle_request_sync(data):
    """Teacher requests sync of already connected students"""
    room = data.get('room')
    if not room: return
    
    # Iterate through all connected students
    for sid, info in connected_students.items():
        if info['room'] == room:
            # Emit user_joined ONLY to the requester (Teacher)
            emit('user_joined', {
                'id': sid,
                'student_id': info['student_id'],
                'student_name': info['student_name']
            }, room=request.sid)

@socketio.on('teacher_offer')
def handle_teacher_offer(data):
    # Route offer to specific student
    # data has { 'to': socketId, 'offer': ..., 'room': ... }
    # Also pass through the sender's (teacher) SID if needed, but not required yet
    emit('teacher_offer', data, room=data['to'])

@socketio.on('student_answer')
def handle_student_answer(data):
    # data has { 'answer': ..., 'room': roomCode, 'student_id': ... }
    # Route back to the teacher via the room (or specific teacher SID if tracked)
    # Adding 'from' as request.sid for tracking
    payload = data.copy()
    payload['from'] = request.sid
    emit('student_answer', payload, room=data['room'], include_self=False)

@socketio.on('ice_candidate')
def handle_ice_candidate(data):
    # data { 'to': socketId, 'candidate': ..., 'room': ..., 'student_id': ... }
    payload = data.copy()
    payload['from'] = request.sid
    
    if 'to' in data:
        emit('ice_candidate', payload, room=data['to'])
    else:
        emit('ice_candidate', payload, room=data['room'], include_self=False)

@socketio.on('teacher-stream')
def handle_teacher_stream(data):
    room = data.get('room')
    emit('teacher-stream', data, room=room, include_self=False)

@socketio.on('student_leave')
def handle_student_leave(data):
    """Student is leaving the class voluntarily"""
    student_id = data.get('student_id')
    student_name = data.get('student_name')
    room = data.get('room')

    if request.sid in connected_students:
        tracked = connected_students[request.sid]
        student_id = student_id or tracked.get('student_id')
        student_name = student_name or tracked.get('student_name')
        room = room or tracked.get('room')

    # Process final disconnect immediately
    finalize_student_disconnect(student_id, student_name, room)

    if request.sid in connected_students:
        del connected_students[request.sid]

def finalize_student_disconnect(student_id, student_name, room):
    """Final source of truth for student departure cleanup"""
    if not room or not student_id: return

    # 1. Update DB (Safety net if not already done)
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE monitoring_sessions
            SET end_time = CURRENT_TIMESTAMP
            WHERE student_id = ? AND end_time IS NULL
        ''', (student_id,))
        conn.commit()
        conn.close()
    except: pass

    # 2. Update In-Memory State
    if room in classroom_sessions:
        if student_id in classroom_sessions[room]["students"]:
            classroom_sessions[room]["students"][student_id]["connected"] = False
            recalculate_and_broadcast_stats(room)

    # 3. Notify Teacher Dashboard for DOM Cleanup
    socketio.emit('student_left', {
        'student_id': student_id,
        'student_name': student_name,
        'timestamp': datetime.now().isoformat(),
        'is_final': True
    }, room=room)

    # 4. Cleanup Timers
    if student_id in disconnection_timers:
        del disconnection_timers[student_id]

    #finalize_student_disconnect handled by timer or explicit leave now.
    pass

@socketio.on('disconnect')
def handle_disconnect():
    """Handle unexpected disconnections with grace period"""
    if request.sid in connected_students:
        user = connected_students[request.sid]
        student_id = user['student_id']
        room = user['room']
        student_name = user['student_name']

        # 1. Notify teacher immediately that student is "reconnecting"
        socketio.emit('student_reconnecting', {
            'student_id': student_id,
            'student_name': student_name,
            'timestamp': datetime.now().isoformat()
        }, room=room)

        # 2. Start grace period timer (15 seconds)
        import threading
        timer = threading.Timer(15.0, finalize_student_disconnect, [student_id, student_name, room])
        disconnection_timers[student_id] = timer
        timer.start()

        # 3. Clean up socket registry (but keep DB session open for now)
        del connected_students[request.sid]

@socketio.on('kick_student')
def handle_kick_student(data):
    """Teacher kicks a student"""
    student_id = data.get('student_id')
    room = data.get('room')

    # Find target socket ID for the student in this room.
    target_sid = None
    for sid, info in connected_students.items():
        if info.get('student_id') == student_id and (not room or info.get('room') == room):
            target_sid = sid
            room = room or info.get('room')
            break

    # Close session in DB
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE monitoring_sessions
            SET end_time = CURRENT_TIMESTAMP
            WHERE student_id = ? AND end_time IS NULL
        ''', (student_id,))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error closing session for kicked student: {e}")

    # Notify only the targeted student.
    if target_sid:
        socketio.emit('kicked', {'message': 'You have been removed from the class.'}, room=target_sid)
        student_name = connected_students[target_sid].get('student_name')
        del connected_students[target_sid]
    else:
        student_name = 'Student'

    # In-memory cleanup
    if room and student_id and room in classroom_sessions:
        if student_id in classroom_sessions[room]["students"]:
            classroom_sessions[room]["students"][student_id]["connected"] = False
            recalculate_and_broadcast_stats(room)

    # Notify teacher dashboard for immediate UI cleanup.
    if room:
        socketio.emit('student_left', {
            'student_id': student_id,
            'student_name': student_name,
            'timestamp': datetime.now().isoformat(),
            'is_final': True
        }, room=room)

def log_attention_to_db(student_id, score, room=None, alert_type=None, message=None, status=None):
    """Helper to log attention and alerts to database"""
    if not student_id: return
    
    conn = None
    try:
        normalized_score = None
        if score is not None:
            try:
                normalized_score = max(0.0, min(100.0, float(score)))
            except (TypeError, ValueError):
                normalized_score = None

        conn = get_db()
        cursor = conn.cursor()

        # Find the latest active session for this student.
        if room:
            cursor.execute('''
                SELECT id, room_code FROM monitoring_sessions
                WHERE student_id = ? AND end_time IS NULL
                AND (room_code = ? OR room_code IS NULL)
                ORDER BY id DESC LIMIT 1
            ''', (student_id, room))
        else:
            cursor.execute('''
                SELECT id, room_code FROM monitoring_sessions
                WHERE student_id = ? AND end_time IS NULL
                ORDER BY id DESC LIMIT 1
            ''', (student_id,))

        active_session = cursor.fetchone()
        if not active_session:
            # Fallback: Create session if missing (e.g. fast updates before join_class DB call finishes)
            if room:
                print(f"DEBUG: log_attention_to_db creating fallback session for {student_id}")
                cursor.execute("INSERT INTO monitoring_sessions (student_id, room_code) VALUES (?, ?)", (student_id, room))
                session_id = cursor.lastrowid
            else:
                return
        else:
            session_id = active_session['id']
            room = room or active_session['room_code']

        if normalized_score is not None:
            cursor.execute('''
                INSERT INTO attention_logs (session_id, student_id, attention_score)
                VALUES (?, ?, ?)
            ''', (session_id, student_id, normalized_score))
            cursor.execute('''
                UPDATE monitoring_sessions SET avg_attention = ? WHERE id = ?
            ''', (normalized_score, session_id))

        if (alert_type and message) or (status and status != 'Focused'):
            final_alert_type = alert_type or 'Behavior'
            final_message = message or f"Status: {status}"
            
            cursor.execute('''
                INSERT INTO alerts (session_id, student_id, alert_type, alert_message)
                VALUES (?, ?, ?, ?)
            ''', (session_id, student_id, final_alert_type, final_message))
            cursor.execute('''
                UPDATE monitoring_sessions SET alerts_count = alerts_count + 1 WHERE id = ?
            ''', (session_id,))

        conn.commit()
    except Exception as e:
        print(f"Error logging attention to DB: {e}")
    finally:
        if conn: conn.close()

def recalculate_and_broadcast_stats(room):
    """Single source of truth for dashboard statistics"""
    if room not in classroom_sessions: return
    
    students = classroom_sessions[room]["students"]
    active_students = [s for s in students.values() if s.get('connected')]
    
    active_count = len(active_students)
    class_avg = round(sum(s['attention'] for s in active_students) / active_count) if active_count > 0 else 0
    low_count = len([s for s in active_students if 40 <= s['attention'] < 70])
    critical_count = len([s for s in active_students if s['attention'] < 40])
    
    # Broadcast to Teacher Dashboard
    socketio.emit('dashboard_update', {
        'active_count': active_count,
        'class_avg': class_avg,
        'low_count': low_count,
        'critical_count': critical_count,
        'students': [
            {
                'id': sid,
                'name': s['name'],
                'attention': s['attention'],
                'connected': s['connected'],
                'status': s.get('status', 'Focused')
            } for sid, s in students.items() if s.get('connected')
        ]
    }, room=room)

@socketio.on('attention_update')
@socketio.on('attention-update')
def handle_attention_update(data):
    """Real-time attention heartbeat from student (Single Source of Truth)"""
    room = data.get('room')
    student_id = data.get('student_id') or data.get('userId')
    attention = data.get('attention', 0)
    student_name = data.get('student_name', 'Student')
    status = data.get('status', 'Focused')
    
    if not room or not student_id: 
        print(f"DEBUG ERROR: Missing data in attention update: {data}")
        return
    
    # print(f"DEBUG: Attention update from {student_id} in {room}: {attention}% ({status})")
    
    # Update in-memory state
    if room not in classroom_sessions:
        classroom_sessions[room] = {"students": {}}
        
    # Update WITHOUT overwriting existing metadata like 'sid'
    if student_id not in classroom_sessions[room]["students"]:
        classroom_sessions[room]["students"][student_id] = {
            "name": student_name,
            "connected": True
        }
    
    s_data = classroom_sessions[room]["students"][student_id]
    s_data.update({
        "attention": attention,
        "status": status,
        "connected": True
    })

    # 1. Relay the individual update to the room (Teacher will catch it)
    socketio.emit('attention-update', {
        'userId': student_id,
        'userName': student_name,
        'attention': attention,
        'status': status
    }, room=room)

    # 2. Recalculate and push full dashboard update
    recalculate_and_broadcast_stats(room)

    # Optional: Periodic DB Log
    log_attention_to_db(student_id, attention, room, status=status)

@socketio.on('monitor_control')
def handle_monitor_control(data):
    """Teacher controls student state (mute/video off) or kicks"""
    room = data.get('room')
    action = data.get('action')
    student_id = data.get('student_id')
    
    if action == 'kick_student':
        handle_kick_student(data)
    else:
        emit('monitor_control', data, room=room)

@socketio.on('student_control_sync')
def handle_student_control_sync(data):
    """Broadcast student mic/cam status to the room"""
    room = data.get('room')
    if room:
        emit('student_control_sync', data, room=room, include_self=False)

@socketio.on('end_class')
def handle_end_class(data):
    """Teacher ends the class via Socket.IO"""
    room = data.get('room')
    if not room: return
    
    # Optional security: Verify requester is the teacher for this room
    # For now, we proceed with broad cleanup
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # 1. End all sessions in this room
        cursor.execute('''
            UPDATE monitoring_sessions 
            SET end_time = CURRENT_TIMESTAMP
            WHERE room_code = ? AND end_time IS NULL
        ''', (room,))
        
        # Deactivate room code
        cursor.execute('UPDATE meeting_links SET is_active = 0 WHERE link_code = ?', (room,))
        
        conn.commit()
        conn.close()
        
        # 2. Notify all participants in the room
        socketio.emit('class_ended', {'message': 'Class has ended.'}, room=room)
        
        # 3. Confirm to teacher
        emit('class_ended_confirm', {'success': True}, room=request.sid)
        
        # 4. Cleanup in-memory state for this room
        if room in classroom_sessions:
            del classroom_sessions[room]
            
    except Exception as e:
        print(f"Error ending class {room}: {e}")
        emit('class_ended_confirm', {'success': False, 'error': str(e)}, room=request.sid)

@app.route('/api/end_all_sessions', methods=['POST'])
def end_all_sessions():
    """End all active monitoring sessions"""
    if 'user_id' not in session or session.get('role') != 'teacher':
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE monitoring_sessions 
        SET end_time = CURRENT_TIMESTAMP
        WHERE end_time IS NULL
    ''')
    
    # Deactivate all rooms
    cursor.execute('UPDATE meeting_links SET is_active = 0')
    
    conn.commit()
    conn.close()
    
    # Broadcast to ALL connected clients to stop
    socketio.emit('class_ended', {'message': 'Class has ended.'})
    
    return jsonify({'success': True, 'message': 'All sessions ended successfully'})

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Initialize DB on start
    init_db()
        
    # Cleanup stale sessions (older than 12 hours)
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE monitoring_sessions SET end_time = CURRENT_TIMESTAMP WHERE end_time IS NULL AND start_time < datetime('now', '-12 hours')")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Cleanup error: {e}")

    # Start server
    use_ssl = os.path.exists('key.pem') and os.path.exists('cert.pem')
    protocol = "https" if use_ssl else "http"
    print(f"\n--- SERVER STARTING ---")
    print(f"Access link: {protocol}://localhost:5001")
    print(f"-----------------------\n")

    if use_ssl:
        socketio.run(app, debug=True, host='0.0.0.0', port=5001, keyfile='key.pem', certfile='cert.pem')
    else:
        socketio.run(app, debug=True, host='0.0.0.0', port=5001)

