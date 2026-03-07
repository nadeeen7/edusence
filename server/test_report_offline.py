import os
import sqlite3
import csv
import io

def test_download_report_logic():
    conn = sqlite3.connect('classroom.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    teacher_id = 12 # From previous check
    
    try:
        # Find the most recently completed session for this teacher
        cursor.execute("""
            SELECT id, created_at FROM meeting_links 
            WHERE teacher_id = ? AND is_active = 0 
            ORDER BY created_at DESC LIMIT 1
        """, (teacher_id,))
        last_meeting = cursor.fetchone()
        
        print(f"[DEBUG] Last Meeting: {dict(last_meeting) if last_meeting else 'None'}")
            
        if not last_meeting:
            print("No completed sessions found")
            return
            
        # Get analytics for this specific session
        cursor.execute("""
            SELECT * FROM session_analytics 
            WHERE session_id = ? AND teacher_id = ?
        """, (last_meeting['id'], teacher_id))
        records = cursor.fetchall()
        
        if not records:
            print("No data found for the latest session")
            return
            
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Student Name', 'Overall Attention (%)', 'Performance'])
        
        for r in records:
            attn = round(r['overall_attention'])
            if attn >= 80: perf = "Good"
            elif attn >= 50: perf = "Average"
            else: perf = "Needs Improvement"
            writer.writerow([r['student_name'], f"{attn}%", perf])
            
        print("CSV Generated successfully:")
        print(output.getvalue())
        
    except Exception as e:
        print(f"[ERROR] Logic Error: {str(e)}")
    finally:
        conn.close()

if __name__ == "__main__":
    test_download_report_logic()
