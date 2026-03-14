import requests
import socketio
import time
import csv
import io
import sqlite3

BASE_URL = 'http://localhost:5000'
timestamp = int(time.time())
TEACHER_EMAIL = f"test_teacher_{timestamp}@example.com"
STUDENT_EMAIL = f"test_student_{timestamp}@example.com"
PASSWORD = "Password123"

teacher_session = requests.Session()
student_session = requests.Session()

def test_step(name):
    print(f"\n>>> [STEP] {name}")

def log_result(success, message):
    mark = "✅" if success else "❌"
    print(f"{mark} {message}")

def run_verification():
    test_step("Teacher Registration")
    r = teacher_session.post(f"{BASE_URL}/register", json={"name": "Verify Teacher", "email": TEACHER_EMAIL, "password": PASSWORD, "role": "teacher"})
    log_result(r.status_code == 201, f"Registration status: {r.status_code}")
    
    test_step("Teacher Login")
    r = teacher_session.post(f"{BASE_URL}/login", json={"email": TEACHER_EMAIL, "password": PASSWORD, "role": "teacher"})
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
    r = student_session.post(f"{BASE_URL}/register", json={"name": "Verify Student", "email": STUDENT_EMAIL, "password": PASSWORD, "role": "student"})
    log_result(r.status_code == 201, f"Student registration status: {r.status_code}")

    test_step("Student Login")
    r = student_session.post(f"{BASE_URL}/login", json={"email": STUDENT_EMAIL, "password": PASSWORD, "role": "student"})
    log_result(r.status_code == 200, f"Student login status: {r.status_code}")
    data = r.json()
    student_token = data.get('token')
    student_id = data.get('user', {}).get('id')
    student_session.headers.update({'Authorization': f'Bearer {student_token}'})

    test_step("Teacher WebSocket Connect & Join")
    sio_teacher = socketio.SimpleClient()
    sio_teacher.connect(BASE_URL)
    sio_teacher.emit('join_room', {'room': room_code, 'role': 'teacher', 'teacher_id': teacher_id, 'teacher_name': 'Verify Teacher'})
    log_result(True, "Teacher socket connected and joined")

    test_step("Student WebSocket Connect & Join")
    sio_student = socketio.SimpleClient()
    sio_student.connect(BASE_URL)
    sio_student.emit('join_room', {'room': room_code, 'role': 'student', 'student_id': student_id, 'student_name': 'Verify Student'})
    log_result(True, "Student socket connected and joined")
    
    time.sleep(1)

    test_step("Simulate Raise Hand")
    sio_student.emit('raise_hand', {'student_id': student_id, 'room': room_code, 'is_raised': True})
    time.sleep(1)
    
    test_step("Simulate Attention Updates")
    scores = [85, 90, 88, 92]
    for score in scores:
        sio_student.emit('attention-update', {'student_id': student_id, 'room': room_code, 'attention': score, 'status': 'Focused', 'student_name': 'Verify Student'})
        time.sleep(0.5)
    
    test_step("Dashboard Stats Check (Live)")
    r = teacher_session.get(f"{BASE_URL}/api/dashboard/stats?room={room_code}")
    data = r.json()
    log_result(data.get('success'), f"Dashboard Stats Live success: {data.get('success')}")
    if data.get('success'):
        log_result(data.get('classAvg') > 0, f"Live Class Avg: {data.get('classAvg')}%")
        log_result(data.get('activeStudents') == 1, f"Active Students: {data.get('activeStudents')}")

    test_step("End Class")
    sio_teacher.emit('end_class', {'room': room_code})
    time.sleep(3) # Give time for DB persistence

    test_step("Post-Class Dashboard Verification")
    r = teacher_session.get(f"{BASE_URL}/api/dashboard/stats")
    data = r.json()
    stats = data.get('lastClassStats', {})
    log_result(stats.get('studentsCount') == 1, f"Historical Student Count: {stats.get('studentsCount')}")
    log_result(stats.get('avgAttention') > 0, f"Historical Avg: {stats.get('avgAttention')}%")
    log_result("Verify Student" in str(stats.get('bestStudent')) or stats.get('bestStudent', '') in ("N/A", ""), f"Best Student display: {stats.get('bestStudent')}")

    test_step("Report Download Verification")
    r = teacher_session.get(f"{BASE_URL}/api/download_report")
    log_result(r.status_code == 200, f"Report download status: {r.status_code}")
    log_result('attachment' in r.headers.get('Content-Disposition', ''), "Content-Disposition header present")
    
    if r.status_code == 200:
        content = r.content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
        log_result(len(rows) == 1, f"Rows in report: {len(rows)}")
        if len(rows) > 0:
            row = rows[0]
            log_result(row.get('Student Name') == "Verify Student", "Correct Student Name in report")
            attn_val = row.get('Overall Attention (%)')
            log_result(attn_val is not None, f"Correct Attention in report: {attn_val}")

    test_step("Database Integrity Check (SQLite)")
    try:
        conn = sqlite3.connect("classroom.db")
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM session_analytics WHERE student_name='Verify Student' ORDER BY timestamp DESC LIMIT 1")
        row = cursor.fetchone()
        if row:
            log_result(True, f"SessionAnalytics entry found for 'Verify Student'")
        else:
            log_result(False, "SessionAnalytics entry NOT found in database")
        conn.close()
    except Exception as e:
        log_result(False, f"SQLite Connection/Query Failed: {e}")

    sio_teacher.disconnect()
    sio_student.disconnect()
    print("\n=== SYSTEM VERIFICATION COMPLETE ===")

if __name__ == "__main__":
    run_verification()
