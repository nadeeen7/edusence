from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Teacher(db.Model):
    __tablename__ = 'teachers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    email = db.Column(db.String, unique=True, nullable=False)
    password = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    email = db.Column(db.String, unique=True, nullable=False)
    password = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class MonitoringSession(db.Model):
    __tablename__ = 'monitoring_sessions'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String, db.ForeignKey('students.id'), nullable=False)
    room_code = db.Column(db.String)
    start_time = db.Column(db.DateTime, default=db.func.current_timestamp())
    end_time = db.Column(db.DateTime)
    avg_attention = db.Column(db.Float)
    alerts_count = db.Column(db.Integer, default=0)

class AttentionLog(db.Model):
    __tablename__ = 'attention_logs'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('monitoring_sessions.id'), nullable=False)
    student_id = db.Column(db.String, db.ForeignKey('students.id'), nullable=False)
    attention_score = db.Column(db.Float, nullable=False)
    ear_value = db.Column(db.Float)
    mar_value = db.Column(db.Float)
    head_yaw = db.Column(db.String)
    head_pitch = db.Column(db.String)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

class Alert(db.Model):
    __tablename__ = 'alerts'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('monitoring_sessions.id'), nullable=False)
    student_id = db.Column(db.String, db.ForeignKey('students.id'), nullable=False)
    alert_type = db.Column(db.String, nullable=False)
    alert_message = db.Column(db.String, nullable=False)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

class MeetingLink(db.Model):
    __tablename__ = 'meeting_links'
    id = db.Column(db.Integer, primary_key=True)
    link_code = db.Column(db.String, unique=True, nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False)
    class_name = db.Column(db.String)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    is_active = db.Column(db.Boolean, default=True)

class SessionAnalytics(db.Model):
    __tablename__ = 'session_analytics'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, nullable=False)
    teacher_id = db.Column(db.Integer, nullable=False)
    student_name = db.Column(db.String, nullable=False)
    overall_attention = db.Column(db.Float, nullable=False)
    class_duration = db.Column(db.Integer) # Duration in minutes
    distraction_count = db.Column(db.Integer, default=0)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())
