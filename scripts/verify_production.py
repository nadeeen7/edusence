import requests
import socketio
import time
import sys
import os

# Config
BASE_URL = "http://localhost:5000"
TEST_TEACHER = {"name": "Audit Teacher", "email": "audit_teacher@test.com", "password": "password123", "role": "teacher"}
TEST_STUDENT = {"name": "Audit Student", "email": "audit_student@test.com", "password": "password123", "role": "student"}

def test_api():
    print("\n--- Testing API Endpoints ---")
    
    # 1. Register Teacher
    print("Registering Teacher...")
    res = requests.post(f"{BASE_URL}/register", json=TEST_TEACHER)
    print(f"Register Teacher: {res.status_code} {res.json().get('message')}")

    # 2. Register Student
    print("Registering Student...")
    res = requests.post(f"{BASE_URL}/register", json=TEST_STUDENT)
    print(f"Register Student: {res.status_code} {res.json().get('message')}")

    # 3. Login Teacher
    print("Logging in Teacher...")
    res = requests.post(f"{BASE_URL}/login", json={"email": TEST_TEACHER["email"], "password": TEST_TEACHER["password"], "role": "teacher"})
    teacher_data = res.json()
    teacher_token = teacher_data.get('token')
    teacher_id = teacher_data.get('user', {}).get('id')
    print(f"Teacher Login: {res.status_code} (Token: {teacher_token[:10]}...)")

    # 4. Login Student
    print("Logging in Student...")
    res = requests.post(f"{BASE_URL}/login", json={"email": TEST_STUDENT["email"], "password": TEST_STUDENT["password"], "role": "student"})
    student_data = res.json()
    student_token = student_data.get('token')
    student_id = student_data.get('user', {}).get('id')
    print(f"Student Login: {res.status_code} (Token: {student_token[:10]}...)")

    if not teacher_token or not student_token:
        print("Login failed, skipping further tests.")
        return None, None, None, None

    # 5. Generate Meeting Link
    print("Generating Meeting Link...")
    headers = {"Authorization": f"Bearer {teacher_token}"}
    res = requests.post(f"{BASE_URL}/api/generate_meeting_link", json={"class_name": "Audit Class"}, headers=headers)
    room_code = res.json().get('link_code')
    print(f"Room Created: {room_code}")

    return teacher_token, student_token, teacher_id, student_id, room_code

def test_socket(teacher_id, student_id, room_code):
    print("\n--- Testing Socket.io Flow ---")
    sio_teacher = socketio.Client()
    sio_student = socketio.Client()

    results = {"teacher_joined": False, "student_joined": False, "attention_received": False, "class_ended": False}

    @sio_teacher.on('room_joined')
    def on_teacher_joined(data):
        print(f"[Teacher] Joined room {data['room']}")
        results["teacher_joined"] = True

    @sio_student.on('room_joined')
    def on_student_joined(data):
        print(f"[Student] Joined room {data['room']}")
        results["student_joined"] = True

    @sio_teacher.on('attention-update')
    def on_attn_update(data):
        print(f"[Teacher] Received attention update: {data['attention']}% from {data['student_id']}")
        results["attention_received"] = True

    @sio_student.on('class_ended')
    def on_class_ended(data):
        print(f"[Student] Class ended notification received: {data['message']}")
        results["class_ended"] = True

    try:
        sio_teacher.connect(BASE_URL)
        sio_student.connect(BASE_URL)

        # Teacher Joins
        sio_teacher.emit('join_room', {'room': room_code, 'role': 'teacher', 'teacher_id': teacher_id, 'teacher_name': 'Audit Teacher'})
        time.sleep(1)

        # Student Joins
        sio_student.emit('join_room', {'room': room_code, 'role': 'student', 'student_id': student_id, 'student_name': 'Audit Student'})
        time.sleep(1)

        # Student Sends Attention
        sio_student.emit('attention-update', {'room': room_code, 'student_id': student_id, 'attention': 85, 'status': 'Focused'})
        time.sleep(1)

        # Teacher Ends Class
        sio_teacher.emit('end_class', {'room': room_code})
        time.sleep(1)

    finally:
        sio_teacher.disconnect()
        sio_student.disconnect()

    print("\n--- Simulation Results ---")
    for key, value in results.items():
        print(f"{key}: {'PASS' if value else 'FAIL'}")

if __name__ == "__main__":
    t_token, s_token, t_id, s_id, room = test_api()
    if room:
        test_socket(t_id, s_id, room)
