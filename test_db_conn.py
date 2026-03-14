import os
from server.app import app, db, Teacher, Student, MeetingLink

with app.app_context():
    print("SQLALCHEMY_DATABASE_URI:", app.config.get('SQLALCHEMY_DATABASE_URI'))
    try:
        teacher_count = Teacher.query.count()
        student_count = Student.query.count()
        meeting_link_count = MeetingLink.query.count()
        print(f"Teachers: {teacher_count}")
        print(f"Students: {student_count}")
        print(f"Meeting Links: {meeting_link_count}")
        
        # Test a write operation
        test_link = MeetingLink(teacher_id=1, link_code='TEST1234', class_name='Test Class')
        db.session.add(test_link)
        # db.session.commit() # Don't commit, just see if it runs
        print("Write dry-run successful")
    except Exception as e:
        print(f"DB Error: {e}")
