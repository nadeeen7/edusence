import sqlite3
from datetime import datetime

def populate_test_data():
    conn = sqlite3.connect('classroom.db')
    cursor = conn.cursor()
    
    # Check if we have a meeting_link that is not active
    cursor.execute("SELECT id, teacher_id FROM meeting_links WHERE is_active = 0 ORDER BY created_at DESC LIMIT 1")
    meeting = cursor.fetchone()
    
    if not meeting:
        print("No completed meeting found. Creating one...")
        cursor.execute("INSERT INTO meeting_links (link_code, teacher_id, is_active) VALUES ('TEST-ROOM', 1, 0)")
        meeting_id = cursor.lastrowid
        teacher_id = 1
    else:
        meeting_id, teacher_id = meeting
    
    # Insert a test record into session_analytics
    cursor.execute("""
    INSERT INTO session_analytics (session_id, teacher_id, student_name, overall_attention, class_duration, distraction_count)
    VALUES (?, ?, 'Test Student', 85.5, 45, 2)
    """, (meeting_id, teacher_id))
    
    conn.commit()
    print(f"Populated test data for meeting {meeting_id}")
    conn.close()

if __name__ == "__main__":
    populate_test_data()
