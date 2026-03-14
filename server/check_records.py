import sqlite3

def check_records():
    conn = sqlite3.connect('classroom.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM session_analytics")
    records = cursor.fetchall()
    print("Records in session_analytics:")
    for r in records:
        print(r)
    conn.close()

if __name__ == "__main__":
    check_records()
