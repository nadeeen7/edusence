This document provides a detailed explanation of the **LearnLens** codebase. It is designed to help you study and understand the architecture, logic, and implementation details of the application.

## 🌟 The Mental Model (For Newcomers)
If you need to explain LearnLens in 30 seconds: 
> "It's a digital classroom where the **browser acts as an AI observer**. Instead of just sending video, the student's device analyzes their face locally to see if they are paying attention, then tells the teacher's dashboard. It uses **WebRTC** for video and **Socket.IO** for the 'brain' (AI data) flow."

---

## 🕒 The 3-Step Lifecycle of a Session

### 1. The Setup (Admin/Teacher)
- **Action**: Teacher logs in and creates a "Room".
- **Code Flow**: `MeetingLink` entry is created in the DB. A unique 8-character code is generated.
- **Key File**: `TeacherDashboard.jsx` + `api/generate_meeting_link`.

### 2. The Live Monitoring (User/Student)
- **Action**: Student enters the code and joins.
- **Logic**: 
    1. **MediaPipe** loads in the browser.
    2. **EAR & Pitch** are calculated every few milliseconds.
    3. Every 2 seconds, a `socket.emit('attention-update')` sends the score to the server.
- **Key File**: `StudentMonitor.jsx` (where the AI loop lives).

### 3. The Analytics (Post-Session)
- **Action**: Teacher ends the class.
- **Data Flow**: The server takes all the memory-cached scores, calculates the **true average** for each student, and saves a final snapshot to the `SessionAnalytics` table.
- **Key File**: `app.py` (`handle_end_class` function).

---

## 1. Project Overview

**LearnLens** is a state-of-the-art AI-powered classroom monitoring system. It leverages real-time computer vision and WebRTC to provide teachers with deep insights into student engagement during virtual sessions.

### Key Technologies
*   **Frontend**: React 19 + Vite + TailwindCSS (Modern SPA architecture).
*   **Backend**: Python (Flask) + Flask-SocketIO (Real-time signaling).
*   **Database**: PostgreSQL (Production) or SQLite (Development) via **SQLAlchemy ORM**.
*   **AI/ML**: **MediaPipe Face Mesh** running client-side (468 facial landmarks) for precise attention tracking.
*   **Video/Audio**: **WebRTC** for peer-to-peer media streaming.
*   **Security**: **JWT (JSON Web Tokens)** for role-based authentication and secure API access.

---

## 2. Backend Architecture (`server/app.py`)

The backend serves as a secure REST API and a real-time signaling server.

### Core Responsibilities
1.  **Authentication**: Validates users, issues JWTs, and handles token refreshes.
2.  **Classroom State**: Manages an in-memory dictionary (`classroom_sessions`) of live class states (active students, attention levels, hand-raises).
3.  **Data Persistence**: Uses SQLAlchemy models to save session history and analytics.
4.  **Signaling**: Facilitates the "handshake" between teacher and student browsers to initiate WebRTC video streams.

### Key Models (`server/models.py`)
The system consists of 7 interconnected entities:
- **Teacher/Student**: Core user profiles with hashed credentials.
- **MeetingLink**: Records of created class rooms (the "Room Code").
- **MonitoringSession**: Individual records of a student's participation in a class.
- **AttentionLog**: High-frequency time-series data of attention scores.
- **Alert**: Behavioral anomalies (e.g., student looking away).
- **SessionAnalytics**: Aggregated summaries generated when a class ends.

---

## 3. Frontend Architecture (React)

The frontend is a single-page application (SPA) built for performance and responsiveness.

### Centralized State Management
- **AuthContext**: Manages login state, user roles, and JWT persistence.
- **Hooks**:
    - `useMediaStream`: Encapsulates camera and microphone logic.
    - `useSocketSession`: Manages the Socket.IO connection and event listeners.

### The AI Pipeline (`StudentMonitor.jsx`)
The student's browser performs heavy lifting using MediaPipe:
1.  **Capture**: Local webcam stream is fed to the Face Mesh model.
2.  **Analyze**: 
    - **EAR (Eye Aspect Ratio)**: Detects drowsiness or closed eyes.
    - **Head Pose**: Uses nose and eye landmarks to calculate **Pitch** and **Yaw** (detecting if the student is looking up, down, or sideways).
    - **Iris Tracking**: Monitors pupil position to detect precise gaze direction.
3.  **Emit**: An attention score (0-100%) and a status string (e.g., "Focused") are calculated and sent to the server every 2 seconds.

---

## 4. Real-time Communication Flow

### 1. Joining a Class
- Student scans a QR code or enters a Room Code.
- Server validates the code and adds the student to a specific Socket.IO "room".
- Teacher's dashboard updates in real-time to show the new student's card.

### 2. WebRTC Video Streaming
- Once joined, the server signals the **Teacher** to send a "Video Offer".
- The **Student** receives the offer, creates an "Answer", and they exchange **ICE Candidates**.
- Result: A peer-to-peer video stream is established without the video data ever passing through the server (reducing latency and server load).

### 3. Ending a Class
- When the teacher clicks "End Class", the server:
    1.  Marks the `MeetingLink` as inactive.
    2.  Calculates final averages for all students.
    3.  Stores records in `SessionAnalytics`.
    4.  Triggers a `class_ended` event to redirect all students.

---

## 5. Study Tips & Key Concepts

*   **Edge AI**: Notice how no video data is sent to the server for processing. This protects privacy and makes the system highly scalable.
*   **JWT Security**: The app uses short-lived access tokens and refresh tokens to ensure sessions are secure and can be recovered if the page is refreshed.
*   **WebRTC Signaling**: Remember that WebRTC needs a middleman (Socket.IO) only to exchange credentials; once connected, the media is peer-to-peer.
*   **Database Normalization**: Look at how `Alerts` and `AttentionLogs` are linked to `MonitoringSessions` rather than directly to `Students`. This allows us to track history across many different classes.

---

## ❓ Frequently Asked Questions (FAQ)

### 1. Does the server process the student's video frames?
**No.** All AI image processing (MediaPipe) happens directly in the student's browser. The server only receives the final **Attention Score** (a simple number). This ensures privacy and keeps the server fast.

### 2. How does the system handle page refreshes?
We use a combination of **JWT (JSON Web Tokens)** stored in `localStorage` and a React `AuthContext`. If a user refreshes, the app checks for a valid token and automatically restores their session and room connection.

### 3. What is the difference between Socket.IO and WebRTC here?
- **Socket.IO** is for "Small Data": Attention scores, hand-raises, and "handshake" messages (signaling).
- **WebRTC** is for "Big Data": The actual video and audio streams between people.

### 4. Why is the database count 7 models?
We split data logically to stay organized:
- 2 for users (**Teacher/Student**)
- 1 for the room (**MeetingLink**)
- 1 for the connection instance (**MonitoringSession**)
- 2 for high-detail logs (**AttentionLog/Alert**)
- 1 for the final summary (**SessionAnalytics**)

---

## 💻 Deep Code Details (What the lines do)
Here are the specific code blocks an examiner might point to and ask: *"Explain what this line is doing."*

### 1. `StudentMonitor.jsx` (The AI Engine)
**Coordinates & Scaling:**
```javascript
const earL = Math.abs(landmarks[159].y - landmarks[145].y) / Math.max(0.01, Math.abs(landmarks[33].x - landmarks[133].x));
```
*   **Simple Explanation**: We take the height of the eye and divide it by the width. This **normalizes** the data so it works correctly regardless of whether the student is close to or far from the camera.

**Head Pose (Pitch) Logic:**
```javascript
const pitch = (nose.y - midEyes.y) / dist - 0.4;
```
*   **Simple Explanation**: We measure where the nose is relative to the eyes. If the nose moves too far down, the "pitch" increases, and the system knows the student is looking down at their phone or desk.

### 2. `server/app.py` (The Central Controller)
**Socket.IO "join_room" Logic:**
```python
@socketio.on('join_room')
def handle_join_room(data):
    join_room(room)
```
*   **Simple Explanation**: This is like joining a private WhatsApp group. Data is only sent to the people in that specific class (Room), which keeps the information private and the network fast.

**The "Final Snapshot" (End Class):**
```python
overall_avg = sum(l.attention_score for l in logs) / len(logs)
```
*   **Simple Explanation**: When the class ends, we don't just guess. We take every single score saved during the class, find the **mathematical average**, and save that as the final result for that student.

### 3. `client/src/services/AuthContext.jsx` (Security)
**JWT & Axios Interceptor:**
```javascript
if (token) config.headers.Authorization = `Bearer ${token}`;
```
*   **Simple Explanation**: This is like an "Admission Card." It automatically attaches the user's secret ID (Token) to every request they make, so the server always knows they have permission to be there.

### 4. `server/models.py` (The Blueprint)
**Relationships:**
```python
session_id = db.Column(db.Integer, db.ForeignKey('monitoring_sessions.id'))
```
*   **Simple Explanation**: This connects different tables together. It ensures that every "Attention Log" belongs to a specific "Monitoring Session," so we don't mix up data between different classes.

### 5. `client/src/hooks/useMediaStream.js` (Webcam)
**Media Constraints:**
```javascript
video: { frameRate: { max: 15 } }
```
*   **Simple Explanation**: We limit the camera to **15 frames per second**. 
*   **Why?**: If we used 60 FPS, the AI would work so hard it would make the student's laptop too hot and lag the class. 15 FPS is the "sweet spot" for accuracy and performance.

---

## 🏆 Master Viva Phrases to use:
*   "We implemented **Stateless JWT Authentication** for security—it means the server doesn't have to 'remember' every user, saving memory."
*   "The logic uses **Geometric Landmark Analysis**—we calculate the physical distance between points on the face to detect focus."
*   "The system follows a **Decentralized AI architecture**—the hard work is done by the student's computer, not our server."
