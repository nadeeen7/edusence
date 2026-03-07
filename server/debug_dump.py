import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def dump_db():
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        print("DATABASE_URL not found in .env")
        return
        
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("--- TEACHERS ---")
        cursor.execute("SELECT id, name, email FROM teachers ORDER BY id DESC LIMIT 5")
        for row in cursor.fetchall():
            print(row)
            
        print("\n--- MEETING LINKS ---")
        cursor.execute("SELECT id, teacher_id, link_code, is_active FROM meeting_links ORDER BY id DESC LIMIT 5")
        for row in cursor.fetchall():
            print(row)
            
        print("\n--- SESSION ANALYTICS ---")
        cursor.execute("SELECT id, session_id, teacher_id, student_name, overall_attention FROM session_analytics ORDER BY id DESC LIMIT 10")
        for row in cursor.fetchall():
            print(row)
            
        conn.close()
    except Exception as e:
        print(f"Error connecting to database: {e}")

if __name__ == "__main__":
    dump_db()
