import requests
import json
import time

BASE_URL = "http://localhost:5000"

def test_report_download():
    # 1. Login to get token
    login_data = {
        "email": "teacher@example.com",
        "password": "password123", # Assuming this exists or I'll need to create it
        "role": "teacher"
    }
    
    # Try to login, if fails, register first
    print("Attempting login...")
    try:
        response = requests.post(f"{BASE_URL}/login", json=login_data, timeout=10)
        if response.status_code != 200:
            print("Login failed, registering teacher...")
            reg_data = {
                "name": "Teacher",
                "email": "teacher@example.com",
                "password": "password123",
                "role": "teacher"
            }
            requests.post(f"{BASE_URL}/register", json=reg_data, timeout=10)
            response = requests.post(f"{BASE_URL}/login", json=login_data, timeout=10)
        
        token = response.json().get('token')
        headers = {'Authorization': f'Bearer {token}'}
        print(f"Token obtained: {token[:10]}...")
        
        # Create a dummy student and session
        print("Creating dummy session data...")
        room = "TESTROOM123"
        # 1. Start class (as teacher) - wait, start_class is not an endpoint, generate_meeting_link is
        resp = requests.post(f"{BASE_URL}/api/generate_meeting_link", json={"class_name": "Test Class"}, headers=headers, timeout=10)
        room = resp.json().get('link_code')
        print(f"Room created: {room}")

        # 2. Register/Login Student
        student_data = {"name": "Rahul", "email": "rahul@test.com", "password": "password123", "role": "student"}
        requests.post(f"{BASE_URL}/register", json=student_data, timeout=10)
        s_login = requests.post(f"{BASE_URL}/login", json=student_data, timeout=10).json()
        s_token = s_login['token']
        s_headers = {'Authorization': f'Bearer {s_token}'}

        # 3. Start Session (as student)
        s_resp = requests.post(f"{BASE_URL}/api/start_session", json={"room": room}, headers=s_headers, timeout=10)
        session_id = s_resp.json().get('session_id')
        print(f"Session created: {session_id}")

        # 4. Add logs directly to DB? No, I'll use the socket update if possible, but simpler to just test the endpoint with what's there.
        # However, the endpoint calculates from AttentionLog. I'll need some logs.
        # I'll manually check the app.py if there's an endpoint to add logs.
        # log_attention_to_db is internal. There's no direct REST endpoint for logging.
        # SocketIO is used.
        
        # Let's just try to download the report first to see the headers and if it works with empty data or existing data.
        print(f"Downloading report for room {room}...")
        report_url = f"{BASE_URL}/api/download_report?token={token}&room={room}"
        response = requests.get(report_url, timeout=15)
        
        if response.status_code == 200:
            print("Report download successful!")
            print("--- Content ---")
            print(response.text)
            print("----------------")
            # Verify headers
            headers = response.text.split('\n')[0].strip()
            expected_headers = "Student Name,Overall Attention (%),Performance"
            if headers == expected_headers:
                print("SUCCESS: Headers match expected.")
            else:
                print(f"FAILURE: Headers mismatch. Got: {headers}")
        else:
            print(f"Report download failed with status {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"Error during test: {e}")

if __name__ == "__main__":
    test_report_download()
