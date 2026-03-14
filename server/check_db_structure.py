import sqlite3

def check_structure():
    conn = sqlite3.connect('classroom.db')
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(session_analytics)")
    columns = cursor.fetchall()
    print("Columns in session_analytics:")
    for col in columns:
        print(col)
    conn.close()

if __name__ == "__main__":
    check_structure()
