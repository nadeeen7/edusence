#!/bin/bash
# =============================================================
# DB ACTIONS — LearnLens Project
# Run all commands from the project ROOT directory:
#   /Users/afsalazeez/Projects/nazeem/learnlens
# =============================================================

DB="classroom.db"

# -------------------------------------------------------------
# ACTION: Flush all tables (wipe data, keep structure)
# -------------------------------------------------------------
flush_db() {
  echo "Flushing all tables in $DB..."
  sqlite3 $DB "
    DELETE FROM attention_logs;
    DELETE FROM alerts;
    DELETE FROM monitoring_sessions;
    DELETE FROM meeting_links;
    DELETE FROM students;
    DELETE FROM teachers;
    VACUUM;
  "
  echo "Done. All tables cleared."
}

# -------------------------------------------------------------
# ACTION: Show all tables
# -------------------------------------------------------------
list_tables() {
  echo "Tables in $DB:"
  sqlite3 $DB ".tables"
}

# -------------------------------------------------------------
# ACTION: Show all teachers
# -------------------------------------------------------------
show_teachers() {
  echo "Teachers:"
  sqlite3 $DB "SELECT * FROM teachers;"
}

# -------------------------------------------------------------
# ACTION: Show all students
# -------------------------------------------------------------
show_students() {
  echo "Students:"
  sqlite3 $DB "SELECT * FROM students;"
}

# -------------------------------------------------------------
# ACTION: Drop all tables (requires server restart to recreate)
# -------------------------------------------------------------
drop_all_tables() {
  echo "Dropping all tables in $DB..."
  # sqlite3 $DB "
  #   DROP TABLE IF EXISTS attention_logs;
  #   DROP TABLE IF EXISTS alerts;
  #   DROP TABLE IF EXISTS monitoring_sessions;
  #   DROP TABLE IF EXISTS meeting_links;
  #   DROP TABLE IF EXISTS students;
  #   DROP TABLE IF EXISTS teachers;
  # "
  echo "Done. Restart the server to recreate tables."
}

# -------------------------------------------------------------
# CLI entry point
# Usage: bash scripts/db.sh <action>
#   flush        — wipe all data
#   tables       — list all tables
#   teachers     — show all teachers
#   students     — show all students
#   drop         — drop all tables
# -------------------------------------------------------------
case "$1" in
  flush)     flush_db ;;
  tables)    list_tables ;;
  teachers)  show_teachers ;;
  students)  show_students ;;
  drop)      drop_all_tables ;;
  *)
    echo "Usage: bash scripts/db.sh {flush|tables|teachers|students|drop}"
    exit 1
    ;;
esac
