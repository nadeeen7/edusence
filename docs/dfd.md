# EduSense AI Classroom - Data Flow Diagrams (DFD)

This document outlines the data flow within the EduSense AI Classroom system, moving from high-level context to detailed process-specific flows.

## Level 0: Context Diagram
The Context Diagram defines the system boundary and the interactions between the system and external entities.

```mermaid
graph LR
    subgraph System ["EduSense AI Classroom"]
    end

    Teacher ((Teacher))
    Student ((Student))

    %% Teacher Flows
    Teacher -- "Login Credentials / Class Name" --> System
    System -- "Auth Token / Room Code" --> Teacher
    System -- "Live Dashboard / Analytics Reports" --> Teacher

    %% Student Flows
    Student -- "Login Credentials / Room Code" --> System
    Student -- "Real-time Attention Data" --> System
    System -- "Auth Token / Media Stream" --> Student
```

---

## Level 1: System-Wide Data Flow
Level 1 breaks the system down into its primary functional processes and identifies the core data stores.

```mermaid
graph TD
    %% External Entities
    Teacher((Teacher))
    Student((Student))

    %% Processes
    P1[1.0 User Authentication]
    P2[2.0 Classroom Management]
    P3[3.0 Real-time Attention Monitoring]
    P4[4.0 Analytics & Reporting]

    %% Data Stores
    D1[(Teachers/Students)]
    D2[(MeetingLinks)]
    D3[(MonitoringSessions)]
    D4[(AttentionLogs/Alerts)]
    D5[(SessionAnalytics)]

    %% Connections
    Teacher -- Credentials --> P1
    Student -- Credentials --> P1
    P1 <--> D1
    P1 -- Auth Token --> Teacher
    P1 -- Auth Token --> Student

    Teacher -- Class Creation/Start --> P2
    P2 <--> D2
    P2 -- Room Code --> Teacher
    Student -- Room Code --> P2
    P2 --> D3

    P3 -- Attention Metrics --> D4
    P3 -- Real-time Stats --> P4
    P4 <--> D5
    P4 -- Dashboard Stats / CSV Report --> Teacher
    
    Student -- Raw Feed/Score --> P3
    P3 -- Live Grid --> Teacher
```

---

## Level 2: Attention Monitoring (Process 3.0)
Level 2 provides a detailed breakdown of the real-time monitoring pipeline, specifically the data movement from the student's facial capture to the backend storage and teacher's display.

```mermaid
graph TD
    %% Source
    StudentCamera((Student Webcam))

    %% Processes
    P3_1[3.1 Capture Face landmarks]
    P3_2[3.2 Calculate Attention Score]
    P3_3[3.3 Emit Socket.IO Event]
    P3_4[3.4 Validate & Broadcast Update]
    P3_5[3.5 Store Attention Log]

    %% Data Stores
    D4[(AttentionLogs/Alerts)]
    D_Session[(classroom_sessions - In-Memory)]

    %% External
    TeacherDashboard((Teacher Live View))

    %% Flow
    StudentCamera -- Frame Buffer --> P3_1
    P3_1 -- "Landmark (X,Y,Z)" --> P3_2
    P3_2 -- "Score (0-100)" --> P3_3
    P3_3 -- "attention_update" --> P3_4
    P3_4 <--> D_Session
    P3_4 -- "dashboard_update" --> TeacherDashboard
    P3_4 -- session_id + score --> P3_5
    P3_5 --> D4
```

## DFD Element Definitions

### External Entities
- **Teacher**: Creates classes, manages sessions, and views performance data.
- **Student**: Joins classes and provides real-time attention data via their device camera.

### Processes
- **User Authentication**: Validates user credentials and provides JWT for secure API access.
- **Classroom Management**: Handles the generation of room codes and the instantiation of monitoring sessions.
- **Real-time Attention Monitoring**: The core logic that processes AI-detected facial landmarks into actionable attention scores and broadcasts them via WebSockets.
- **Analytics & Reporting**: Aggregates session data and generates visualizations or downloadable reports.

### Data Stores
- **Teachers/Students**: User profiles and hashed credentials.
- **MeetingLinks**: Metadata for created class rooms.
- **MonitoringSessions**: Records of student presence and performance per class.
- **AttentionLogs/Alerts**: High-resolution time-series data of student metrics.
- **SessionAnalytics**: Grouped summaries used for historical reporting.
