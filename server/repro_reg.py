from app import app, db, Teacher, hash_password
import traceback

with app.app_context():
    try:
        email = "test@gmail.com"
        name = "test"
        password = "password"
        
        # Check if exists
        exists = Teacher.query.filter_by(email=email).first()
        print(f"Exists check: {exists}")
        
        if not exists:
            new_user = Teacher(name=name, email=email, password=hash_password(password))
            db.session.add(new_user)
            db.session.commit()
            print("Successfully registered test user")
    except Exception as e:
        print(f"Registration error in script: {e}")
        traceback.print_exc()
        db.session.rollback()
