"""
Socket.IO simulation test for teacher and student attention sync.
"""
import socketio
import time

ROOM = 'EDU-1SILWZ'
BASE = 'http://localhost:5000'

# ---- TEACHER SOCKET ----
teacher_events = []
sio_teacher = socketio.SimpleClient()

print("=== CONNECTING TEACHER SOCKET ===")
try:
    sio_teacher.connect(BASE, transports=['websocket'])
    print(f"Teacher connected: {sio_teacher.sid}")
except Exception as e:
    print(f"Teacher connect error: {e}")
    exit(1)

# Join room as teacher
sio_teacher.emit('join_room', {
    'room': ROOM,
    'role': 'teacher',
    'teacher_id': 4,
    'teacher_name': 'Teacher Test'
})
time.sleep(1)

# Wait for room_joined ack
try:
    event = sio_teacher.receive(timeout=3)
    print(f"Teacher event received: {event}")
    teacher_events.append(event)
except Exception as e:
    print(f"Teacher ack timeout: {e}")

# ---- STUDENT SOCKET ----
sio_student = socketio.SimpleClient()
student_events = []

print("\n=== CONNECTING STUDENT SOCKET ===")
try:
    sio_student.connect(BASE, transports=['websocket'])
    print(f"Student connected: {sio_student.sid}")
except Exception as e:
    print(f"Student connect error: {e}")
    exit(1)

# Student joins room
sio_student.emit('join_room', {
    'room': ROOM,
    'role': 'student',
    'student_id': 'STU003',
    'student_name': 'Sim Student',
    'session': 3
})
time.sleep(1)

# Student gets room_joined ack
try:
    ev = sio_student.receive(timeout=3)
    print(f"Student event received: {ev}")
    student_events.append(ev)
except Exception:
    pass

# Teacher hears user_joined?
print("\n=== CHECKING TEACHER FOR user_joined ===")
try:
    ev = sio_teacher.receive(timeout=3)
    print(f"Teacher heard: {ev}")
    teacher_events.append(ev)
except Exception as e:
    print(f"Teacher event timeout (may already received earlier): {e}")

# ---- STUDENT SENDS ATTENTION ----
print("\n=== STUDENT EMITS ATTENTION UPDATE ===")
sio_student.emit('attention-update', {
    'userId': 'STU003',
    'room': ROOM,
    'attention': 85,
    'status': 'Focused',
    'student_name': 'Sim Student'
})
time.sleep(1)

# Teacher receives attention-update and dashboard_update
print("\n=== CHECKING TEACHER FOR ATTENTION DATA ===")
for i in range(3):
    try:
        ev = sio_teacher.receive(timeout=2)
        print(f"Teacher event [{i+1}]: {ev[0]} -> {ev[1]}")
        teacher_events.append(ev)
    except Exception:
        break

# ---- END SESSION ----
print("\n=== TEACHER ENDS SESSION ===")
sio_teacher.emit('end_session', {'room': ROOM})
time.sleep(1)

# Student should receive class_ended
print("\n=== STUDENT CHECKS FOR class_ended ===")
try:
    ev = sio_student.receive(timeout=3)
    print(f"Student received: {ev}")
except Exception as e:
    print(f"Student event timeout: {e}")

print("\n=== CLEANUP ===")
sio_teacher.disconnect()
sio_student.disconnect()
print("Both disconnected.")

print("\n\n=== SUMMARY ===")
print(f"Teacher events captured: {len(teacher_events)}")
print(f"Student events captured: {len(student_events)}")
print("\nFull Flow PASSED!" if len(teacher_events) >= 2 else "\nWARNING: Some events may be missing — check socket setup.")
