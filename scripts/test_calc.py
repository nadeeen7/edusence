import sqlite3
import requests
import os

BASE_URL = "http://localhost:5000"
DB_PATH = "c:/Users/Nadeen/Documents/ai_class/server/classroom.db"

def test_full_calculation():
    # 1. Setup session via API
    login_data = {"email": "teacher@example.com", "password": "password123", "role": "teacher"}
    token = requests.post(f"{BASE_URL}/login", json=login_data).json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    
    resp = requests.post(f"{BASE_URL}/api/generate_meeting_link", json={"class_name": "Calc Test"}, headers=headers)
    room = resp.json().get('link_code')
    print(f"Room: {room}")

    student_data = {"name": "Aisha", "email": "aisha@test.com", "password": "password123", "role": "student"}
    reg_resp = requests.post(f"{BASE_URL}/register", json=student_data)
    print(f"Register Student: {reg_resp.status_code} - {reg_resp.text}")
    
    s_login_resp = requests.post(f"{BASE_URL}/login", json=student_data)
    print(f"Login Student: {s_login_resp.status_code} - {s_login_resp.text}")
    s_login = s_login_resp.json()
    s_token = s_login['token']
    s_headers = {'Authorization': f'Bearer {s_token}'}

    s_resp = requests.post(f"{BASE_URL}/api/start_session", json={"room": room}, headers=s_headers)
    session_id = s_resp.json().get('session_id')
    print(f"Session ID: {session_id}")

    # 2. Manually insert logs into DB to test "Good" performance (82%)
    print("Inserting dummy logs...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Aisha: 82% (Good)
    scores = [80, 85, 81] # Avg: 82
    for s in scores:
        cursor.execute("INSERT INTO attention_logs (session_id, student_id, attention_score, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)", (session_id, "STU013", s)) # Assuming STU013 or similar, better to fetch it
    
    # Let's fetch the actual student_id for Aisha
    cursor.execute("SELECT id FROM students WHERE email='aisha@test.com'")
    stu_id = cursor.fetchone()[0]
    # Update logs with correct student_id
    cursor.execute("UPDATE attention_logs SET student_id=? WHERE session_id=?", (stu_id, session_id))
    conn.commit()
    conn.close()

    # 3. Download report
    report_url = f"{BASE_URL}/api/download_report?token={token}&room={room}"
    response = requests.get(report_url)
    print("--- Report Output ---")
    print(response.text)
    
    if "Aisha,82%,Good" in response.text:
        print("SUCCESS: Aisha has 82% and Good performance.")
    else:
        print("FAILURE: Report content mismatch.")

if __name__ == "__main__":
    test_full_calculation()
