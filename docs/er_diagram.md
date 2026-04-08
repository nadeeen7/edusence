# LearnLens AI Classroom - Entity Relationship Diagram

This document provides a clear representation of the database schema for the LearnLens AI Classroom project.

## ER Diagram (Mermaid Format)

```mermaid
erDiagram
    TEACHER ||--o{ MEETING_LINK : creates
    TEACHER ||--o{ SESSION_ANALYTICS : views
    STUDENT ||--o{ MONITORING_SESSION : starts
    STUDENT ||--o{ ATTENTION_LOG : generates
    STUDENT ||--o{ ALERT : triggers
    MEETING_LINK ||--o{ MONITORING_SESSION : "associated with"
    MONITORING_SESSION ||--o{ ATTENTION_LOG : contains
    MONITORING_SESSION ||--o{ ALERT : records

    TEACHER {
        int id PK
        string name
        string email UK
        string password
        datetime created_at
    }

    STUDENT {
        string id PK "STUXXX"
        string name
        string email UK
        string password
        datetime created_at
    }

    MEETING_LINK {
        int id PK
        string link_code UK "Room Code"
        int teacher_id FK
        string class_name
        datetime created_at
        boolean is_active
    }

    MONITORING_SESSION {
        int id PK
        string student_id FK
        string room_code FK
        datetime start_time
        datetime end_time
        float avg_attention
        int alerts_count
    }

    ATTENTION_LOG {
        int id PK
        int session_id FK
        string student_id FK
        float attention_score
        float ear_value
        float mar_value
        string head_yaw
        string head_pitch
        datetime timestamp
    }

    ALERT {
        int id PK
        int session_id FK
        string student_id FK
        string alert_type
        string alert_message
        datetime timestamp
    }

    SESSION_ANALYTICS {
        int id PK
        int session_id "Ref MeetingLink.id"
        int teacher_id FK
        string student_name
        float overall_attention
        int class_duration
        int distraction_count
        datetime timestamp
    }
```

## Entities Description

### 1. Teacher
Stores information about educators who can create classes and view analytics.
- **id**: Unique identifier (Primary Key).
- **email**: Unique email for login.
- **password**: Hashed password.

### 2. Student
Stores information about students enrolled in the system.
- **id**: Custom ID string (e.g., STU001) (Primary Key).
- **email**: Unique email for login.

### 3. MeetingLink (Class)
Represents a class session created by a teacher.
- **link_code**: The code shared with students to join.
- **teacher_id**: Relationship to the teacher who created it.

### 4. MonitoringSession (Attendance)
Created when a student joins a class. It tracks their individual participation in a specific session.
- **room_code**: Links to the meeting link.
- **student_id**: Links to the student.

### 5. AttentionData (AttentionLog)
High-frequency logs recording attention metrics during a session.
- **attention_score**: Calculated percentage of attention.
- **ear_value/mar_value**: Eye and Mouth Aspect Ratios from MediaPipe.

### 6. Alert
Detailed logs of behavioral anomalies detected during a session.
- **alert_type**: Categorizes the alert (e.g., "Behavior" for status changes).
- **alert_message**: Describes the specific cause (e.g., "Status: Looking Away" or "Status: Distracted").
- **session_id/student_id**: Links the alert to the specific student and class session.

### 7. SessionAnalytics
Aggregated data saved after a class ends, used for generating reports and dashboard visualizations.
