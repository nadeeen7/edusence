import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def debug_teacher():
    DATABASE_URL = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    name_query = "teacherrr"
    print(f"--- Searching for Teacher: {name_query} ---")
    cursor.execute("SELECT id, name, email FROM teachers WHERE name ILIKE %s", (f"%{name_query}%",))
    teachers = cursor.fetchall()
    for t in teachers:
        tid = t[0]
        print(f"Found Teacher: {t}")
        
        print(f"\n  SESSIONS for Teacher {tid}:")
        cursor.execute("SELECT id, link_code, is_active, created_at FROM meeting_links WHERE teacher_id = %s ORDER BY created_at DESC", (tid,))
        links = cursor.fetchall()
        for l in links:
            print(f"    Link: {l}")
            
        print(f"\n  ANALYTICS for Teacher {tid}:")
        cursor.execute("SELECT id, session_id, student_name, overall_attention, timestamp FROM session_analytics WHERE teacher_id = %s ORDER BY timestamp DESC", (tid,))
        analytics = cursor.fetchall()
        for a in analytics:
            print(f"    Analytic: {a}")
            
    conn.close()

if __name__ == "__main__":
    debug_teacher()
