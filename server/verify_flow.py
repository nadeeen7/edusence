import requests

BASE = 'http://localhost:5000'
sess = requests.Session()

print("=== TEACHER LOGIN ===")
r = sess.post(f'{BASE}/teacher_login', json={'email': 'teacher@test.com', 'password': 'Test1234'})
d = r.json()
print(f"Status: {r.status_code} | {d}")
teacher_id = d.get('user', {}).get('id') if d.get('success') else None

if not teacher_id:
    print("Trying m@gmail.com...")
    r = sess.post(f'{BASE}/teacher_login', json={'email': 'm@gmail.com', 'password': '123456'})
    d = r.json()
    print(f"Status: {r.status_code} | {d}")
    teacher_id = d.get('user', {}).get('id') if d.get('success') else None

if not teacher_id:
    print("All logins failed")
    exit(1)

print(f"\nTeacher ID: {teacher_id}")

print("\n=== GENERATE MEETING LINK ===")
r2 = sess.post(f'{BASE}/api/generate_meeting_link', json={'teacher_id': teacher_id})
d2 = r2.json()
print(f"Status: {r2.status_code} | {d2}")
room_code = d2.get('link_code')

if not room_code:
    print("Could not generate room code")
    exit(1)

print(f"Room Code: {room_code}")

print("\n=== VALIDATE ROOM ===")
r3 = sess.get(f'{BASE}/api/validate_room?code={room_code}')
d3 = r3.json()
print(f"Status: {r3.status_code} | {d3}")

print("\n=== DASHBOARD STATS ===")
r4 = sess.get(f'{BASE}/api/dashboard/stats')
d4 = r4.json()
print(f"Status: {r4.status_code} | success={d4.get('success')}, total={d4.get('total_students')}")

# Student flow
print("\n\n=== STUDENT REGISTRATION ===")
sess2 = requests.Session()
r5 = sess2.post(f'{BASE}/register', json={'name':'Sim Student','email':'sim2student@test.com','password':'Pass123','role':'student'})
d5 = r5.json()
print(f"Status: {r5.status_code} | {d5}")

print("\n=== STUDENT LOGIN ===")
r6 = sess2.post(f'{BASE}/student_login', json={'email':'sim2student@test.com','password':'Pass123'})
d6 = r6.json()
print(f"Status: {r6.status_code} | {d6}")
student_id = d6.get('user', {}).get('id') if d6.get('success') else None

if student_id:
    print(f"\nStudent ID: {student_id}")
    
    print("\n=== VALIDATE ROOM (Student) ===")
    r7 = sess2.get(f'{BASE}/api/validate_room?code={room_code}')
    d7 = r7.json()
    print(f"Status: {r7.status_code} | {d7}")
    
    print("\n=== START MONITORING SESSION ===")
    r8 = sess2.post(f'{BASE}/api/start_session', json={'student_id': student_id, 'room': room_code})
    d8 = r8.json()
    print(f"Status: {r8.status_code} | {d8}")
    session_id = d8.get('session_id')
    
    if session_id:
        print(f"\nSession ID: {session_id}")
        
        print("\n=== GET STUDENTS (Teacher Check) ===")
        r9 = sess.get(f'{BASE}/api/get_students?room={room_code}')
        d9 = r9.json()
        print(f"Status: {r9.status_code} | students={len(d9.get('students', []))}")
        for s in d9.get('students', []):
            print(f"  - {s.get('name')} | attention: {s.get('attention')}")

print("\n\n=== ALL CHECKS COMPLETE ===")
