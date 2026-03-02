import requests
import json

BASE_URL = "http://localhost:5000"

def test_flow():
    # 1. Login
    login_data = {
        "email": "auto_teacher_2@test.com",
        "password": "password123",
        "role": "teacher"
    }
    print(f"Logging in as {login_data['email']}...")
    resp = requests.post(f"{BASE_URL}/login", json=login_data)
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} - {resp.text}")
        return

    data = resp.json()
    token = data.get('token')
    print(f"Login successful. Token: {token[:10]}...{token[-10:]}")

    # 2. Access dashboard stats
    headers = {"Authorization": f"Bearer {token}"}
    print("Fetching dashboard stats...")
    resp = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
    print(f"Stats Response: {resp.status_code} - {resp.text}")

    # 3. Generate meeting link
    print("Generating meeting link...")
    resp = requests.post(f"{BASE_URL}/api/generate_meeting_link", json={"teacher_id": data['user']['id']}, headers=headers)
    print(f"Link Response: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    test_flow()
