import sqlite3

def create_table():
    conn = sqlite3.connect('classroom.db')
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS session_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        teacher_id INTEGER NOT NULL,
        student_name VARCHAR NOT NULL,
        overall_attention FLOAT NOT NULL,
        class_duration INTEGER,
        distraction_count INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()
    print("Table session_analytics created/verified.")
    conn.close()

if __name__ == "__main__":
    create_table()
