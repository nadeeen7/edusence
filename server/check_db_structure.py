import sqlite3
import os

db_path = 'c:/Users/Nadeen/Documents/ai_class/server/classroom.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tables:", [t[0] for t in tables])

for table in [t[0] for t in tables]:
    print(f"\nStructure of {table}:")
    cursor.execute(f"PRAGMA table_info({table});")
    for col in cursor.fetchall():
        print(col)

conn.close()
