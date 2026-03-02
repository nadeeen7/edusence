from app import app, db, Teacher, Student
with app.app_context():
    try:
        teachers = Teacher.query.all()
        students = Student.query.all()
        print(f"Teachers: {len(teachers)}")
        print(f"Students: {len(students)}")
        for t in teachers:
            print(f"Teacher: {t.name}, {t.email}")
    except Exception as e:
        print(f"DB Check Error: {e}")
