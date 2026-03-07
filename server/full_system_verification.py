import requests
import socketio
import time
import csv
import io
import os
import sqlite3
from datetime import datetime

BASE_URL = 'http://localhost:5000'
# Use unique emails for each run to avoid registration conflicts
timestamp = int(time.time())
TEACHER_EMAIL = f"test_teacher_{timestamp}@example.com"
STUDENT_EMAIL = f"test_student_{timestamp}@example.com"
PASSWORD = "Password123"

# Session objects to persist JWT
teacher_session = requests.Session()
student_session = requests.Session()

def test_step(name):
    print(f"\n>>> [STEP] {name}")

def log_result(success, message):
    mark = "✅" if success else "❌"
    print(f"{mark} {message}")
    if not success:
        # We don't exit to see how much of the flow works
        pass

def run_verification():
    # --- PHASE 2: API VERIFICATION ---
    test_step("Teacher Registration")
    r = teacher_session.post(f"{BASE_URL}/register", json={
        "name": "Verify Teacher",
        "email": TEACHER_EMAIL,
        "password": PASSWORD,
        "role": "teacher"
    })
    log_result(r.status_code == 201, f"Registration status: {r.status_code}")
    
    test_step("Teacher Login")
    r = teacher_session.post(f"{BASE_URL}/login", json={
        "email": TEACHER_EMAIL,
        "password": PASSWORD,
        "role": "teacher"
    })
    log_result(r.status_code == 200, f"Login status: {r.status_code}")
    data = r.json()
    teacher_token = data.get('token')
    teacher_id = data.get('user', {}).get('id')
    teacher_session.headers.update({'Authorization': f'Bearer {teacher_token}'})

    test_step("Start Class (Generate Meeting Link)")
    r = teacher_session.post(f"{BASE_URL}/api/generate_meeting_link", json={"teacher_id": teacher_id})
    log_result(r.status_code == 201, f"Generate link status: {r.status_code}")
    room_code = r.json().get('link_code')
    log_result(room_code is not None, f"Room Code: {room_code}")

    test_step("Student Registration")
    r = student_session.post(f"{BASE_URL}/register", json={
        "name": "Verify Student",
        "email": STUDENT_EMAIL,
        "password": PASSWORD,
        "role": "student"
    })
    log_result(r.status_code == 201, f"Student registration status: {r.status_code}")

    test_step("Student Login")
    r = student_session.post(f"{BASE_URL}/login", json={
        "email": STUDENT_EMAIL,
        "password": PASSWORD,
        "role": "student"
    })
    log_result(r.status_code == 200, f"Student login status: {r.status_code}")
    data = r.json()
    student_token = data.get('token')
    student_id = data.get('user', {}).get('id')
    student_session.headers.update({'Authorization': f'Bearer {student_token}'})

    # --- PHASE 3: WebSocket Simulation ---
    test_step("Teacher WebSocket Connect & Join")
    sio_teacher = socketio.SimpleClient()
    try:
        sio_teacher.connect(BASE_URL)
        sio_teacher.emit('join_room', {
            'room': room_code,
            'role': 'teacher',
            'teacher_id': teacher_id,
            'teacher_name': 'Verify Teacher'
        })
        log_result(True, "Teacher socket connected and joined")
    except Exception as e:
        log_result(False, f"Teacher socket failed: {e}")
        return

    test_step("Student WebSocket Connect & Join")
    sio_student = socketio.SimpleClient()
    try:
        sio_student.connect(BASE_URL)
        sio_student.emit('join_room', {
            'room': room_code,
            'role': 'student',
            'student_id': student_id,
            'student_name': 'Verify Student'
        })
        log_result(True, "Student socket connected and joined")
    except Exception as e:
        log_result(False, f"Student socket failed: {e}")
        return
    
    time.sleep(1) # Allow events to process

    # Verify Teacher receives user_joined
    try:
        event = sio_teacher.receive(timeout=3)
        log_result(event[0] == 'user_joined', f"Teacher received event: {event[0]}")
    except:
        log_result(False, "Teacher did not receive user_joined event")

    test_step("Simulate Raise Hand")
    sio_student.emit('raise_hand', {
        'studentId': student_id,
        'roomId': room_code,
        'raise_hand': True
    })
    time.sleep(1)
    
    # Check if teacher received student_raised_hand
    found_hand = False
    for _ in range(3):
        try:
            event = sio_teacher.receive(timeout=1)
            if event[0] == 'student_raised_hand':
                found_hand = True
                log_result(True, "Teacher received student_raised_hand")
                break
        except: break
    if not found_hand: log_result(False, "Teacher missed student_raised_hand event")

    test_step("Simulate Attention Updates")
    scores = [85, 90, 88, 92]
    for score in scores:
        sio_student.emit('attention-update', {
            'student_id': student_id, # FIX: use student_id instead of userId
            'room': room_code,
            'attention': score,
            'status': 'Focused',
            'student_name': 'Verify Student'
        })
        time.sleep(0.5)
    
    # Check Dashboard Stats API during live session
    test_step("Dashboard Stats Check (Live)")
    r = teacher_session.get(f"{BASE_URL}/api/dashboard/stats?room={room_code}")
    data = r.json()
    log_result(data.get('success'), f"Dashboard Stats Live success: {data.get('success')}")
    if data.get('success'):
        log_result(data.get('classAvg') > 0, f"Live Class Avg: {data.get('classAvg')}%")
        log_result(data.get('activeStudents') == 1, f"Active Students: {data.get('activeStudents')}")

    # --- PHASE 4 & 5: End Class & Analytics ---
    test_step("End Class")
    sio_teacher.emit('end_class', {'room': room_code})
    time.sleep(3) # Give time for DB persistence

    test_step("Post-Class Dashboard Verification")
    r = teacher_session.get(f"{BASE_URL}/api/dashboard/stats")
    data = r.json()
    stats = data.get('lastClassStats', {})
    log_result(stats.get('studentsCount') == 1, f"Historical Student Count: {stats.get('studentsCount')}")
    # (85+90+88+92)/4 = 88.75 -> 89
    log_result(stats.get('avgAttention') == 89, f"Historical Avg: {stats.get('avgAttention')}% (Expected 89%)")
    log_result("Verify Student" in str(stats.get('bestStudent')), f"Best Student display: {stats.get('bestStudent')}")

    # --- PHASE 6: Report Generation ---
    test_step("Report Download Verification")
    r = teacher_session.get(f"{BASE_URL}/api/download_report")
    log_result(r.status_code == 200, f"Report download status: {r.status_code}")
    log_result('attachment' in r.headers.get('Content-Disposition', ''), "Content-Disposition header present")
    
    content = r.content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    log_result(len(rows) == 1, f"Rows in report: {len(rows)}")
    if len(rows) > 0:
        row = rows[0]
        log_result(row.get('Student Name') == "Verify Student", "Correct Student Name in report")
        # Check column name carefully (might be overall_attention_%) or space
        attn_val = row.get('Overall Attention (%)')
        log_result(attn_val == "89%", f"Correct Attention in report: {attn_val}")
        log_result(row.get('Performance') == "Good", f"Correct Performance classification: {row.get('Performance')}")

    # --- PHASE 7: Database Integrity ---
    test_step("Database Integrity Check (PostgreSQL)")
    import psycopg2
    try:
        conn = psycopg2.connect("postgresql://postgres:Nad95970@localhost:5432/edusense_db")
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM session_analytics WHERE student_name='Verify Student' ORDER BY timestamp DESC LIMIT 1")
        row = cursor.fetchone()
        if row:
            log_result(True, f"SessionAnalytics entry found for 'Verify Student'")
        else:
            log_result(False, "SessionAnalytics entry NOT found in database")
        conn.close()
    except Exception as e:
        log_result(False, f"PostgreSQL Connection/Query Failed: {e}")

    # Cleanup
    sio_teacher.disconnect()
    sio_student.disconnect()
    print("\n=== SYSTEM VERIFICATION COMPLETE ===")

if __name__ == "__main__":
    try:
        run_verification()
    except Exception as e:
        print(f"\nFATAL ERROR DURING VERIFICATION: {e}")
        import traceback
        traceback.print_exc()
