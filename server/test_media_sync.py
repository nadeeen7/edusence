import requests
import socketio
import time
import os

BASE_URL = 'http://localhost:5000'
timestamp = int(time.time())
TEACHER_EMAIL = f"test_teacher_{timestamp}@example.com"
STUDENT1_EMAIL = f"test_student1_{timestamp}@example.com"
STUDENT2_EMAIL = f"test_student2_{timestamp}@example.com"
PASSWORD = "Password123"

teacher_session = requests.Session()
s1_session = requests.Session()
s2_session = requests.Session()

def test_step(name):
    print(f"\n>>> [STEP] {name}")

def log_result(success, message):
    mark = "✅" if success else "❌"
    print(f"{mark} {message}")

def run_verification():
    # 1. Register and Login Teacher
    test_step("Teacher Registration")
    r = teacher_session.post(f"{BASE_URL}/register", json={"name": "Ms. Alice", "email": TEACHER_EMAIL, "password": PASSWORD, "role": "teacher"})
    r = teacher_session.post(f"{BASE_URL}/login", json={"email": TEACHER_EMAIL, "password": PASSWORD, "role": "teacher"})
    teacher_token = r.json().get('token')
    teacher_id = r.json().get('user', {}).get('id')
    teacher_session.headers.update({'Authorization': f'Bearer {teacher_token}'})

    # Start Class
    test_step("Start Class")
    r = teacher_session.post(f"{BASE_URL}/api/generate_meeting_link", json={"teacher_id": teacher_id})
    room_code = r.json().get('link_code')
    print(f"Room Code: {room_code}")

    # Teacher Socket Join
    sio_teacher = socketio.SimpleClient()
    sio_teacher.connect(BASE_URL)
    sio_teacher.emit('join_room', {'room': room_code, 'role': 'teacher', 'teacher_id': teacher_id, 'teacher_name': 'Ms. Alice'})
    
    # 2. Register and Login Students
    test_step("Student 1 & 2 Join")
    # S1
    s1_session.post(f"{BASE_URL}/register", json={"name": "Bob", "email": STUDENT1_EMAIL, "password": PASSWORD, "role": "student"})
    r1 = s1_session.post(f"{BASE_URL}/login", json={"email": STUDENT1_EMAIL, "password": PASSWORD, "role": "student"})
    s1_id = r1.json().get('user', {}).get('id')
    sio_s1 = socketio.SimpleClient()
    sio_s1.connect(BASE_URL)
    sio_s1.emit('join_room', {'room': room_code, 'role': 'student', 'student_id': s1_id, 'student_name': 'Bob'})
    
    # S2
    s2_session.post(f"{BASE_URL}/register", json={"name": "Charlie", "email": STUDENT2_EMAIL, "password": PASSWORD, "role": "student"})
    r2 = s2_session.post(f"{BASE_URL}/login", json={"email": STUDENT2_EMAIL, "password": PASSWORD, "role": "student"})
    s2_id = r2.json().get('user', {}).get('id')
    sio_s2 = socketio.SimpleClient()
    sio_s2.connect(BASE_URL)
    sio_s2.emit('join_room', {'room': room_code, 'role': 'student', 'student_id': s2_id, 'student_name': 'Charlie'})
    
    time.sleep(1)
    
    # Verify Teacher Receives Student Joins
    test_step("Active Students Check")
    sio_teacher.emit('request_sync', {'room': room_code})
    time.sleep(1)
    # Receive events
    for _ in range(5):
        try:
            event = sio_teacher.receive(timeout=1)
            if event[0] == 'dashboard_update':
                active = event[1]['active_count']
                log_result(active == 2, f"Teacher sees {active} active students (Expected 2)")
                break
        except: pass

    # 3. Simulate Media Toggling and Attention Updates
    test_step("Media Toggling (S1 mutes audio, S2 stops video)")
    sio_s1.emit('media_state_change', {'room': room_code, 'student_id': s1_id, 'videoEnabled': True, 'audioEnabled': False})
    sio_s2.emit('media_state_change', {'room': room_code, 'student_id': s2_id, 'videoEnabled': False, 'audioEnabled': True})
    
    time.sleep(1)
    for _ in range(5):
        try:
            event = sio_teacher.receive(timeout=1)
            if event[0] == 'media_state_change':
                sid = event[1]['student_id']
                if sid == s1_id: log_result(not event[1]['audioEnabled'], "S1 Audio disabled event received")
                if sid == s2_id: log_result(not event[1]['videoEnabled'], "S2 Video disabled event received")
        except: pass

    test_step("Attention Updates (S1 Focused, S2 Camera Off)")
    sio_s1.emit('attention-update', {'student_id': s1_id, 'room': room_code, 'attention': 90, 'status': 'Focused'})
    # S2 implies Camera Off logic sending 100
    sio_s2.emit('attention-update', {'student_id': s2_id, 'room': room_code, 'attention': 100, 'status': 'Camera Off'})
    
    time.sleep(1)
    sio_teacher.emit('request_sync', {'room': room_code})
    time.sleep(1)
    for _ in range(5):
        try:
            event = sio_teacher.receive(timeout=1)
            if event[0] == 'dashboard_update':
                avg = event[1]['class_avg']
                log_result(avg == 95, f"Class Average is {avg}% (Expected 95%)")
                break
        except: pass

    # 4. End class
    sio_teacher.emit('end_class', {'room': room_code})
    
    sio_s1.disconnect()
    sio_s2.disconnect()
    sio_teacher.disconnect()
    print("\n=== VERIFICATION COMPLETE ===")

if __name__ == "__main__":
    run_verification()
