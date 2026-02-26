# Edusence Project Study Guide

This document provides a detailed explanation of the **Edusence** codebase. It is designed to help you study and understand the architecture, logic, and implementation details of the application.

## 1. Project Overview

**Edusence** is an AI-powered classroom monitoring system. It allows teachers to create virtual classrooms where they can monitor student attention and engagement in real-time.

### Key Technologies
*   **Backend**: Python (Flask), SQLite (Database), Socket.IO (Real-time communication).
*   **Frontend**: HTML, CSS (Tailwind), JavaScript.
*   **AI/ML**: MediaPipe (Face Mesh), TensorFlow.js (Object Detection) - running entirely in the browser (Client-side).
*   **Video**: WebRTC (Peer-to-Peer video streaming).

---

## 2. Backend Architecture (`app.py`)

The `app.py` file is the heart of the server. It handles:
1.  **Web Request Routing**: Serving HTML pages.
2.  **API Endpoints**: Data handling (Login, Session Start, Logs).
3.  **Real-time Signaling**: WebSocket events for video calls and status updates.

### Key Components in `app.py`

#### Database Management (`init_db`)
The application uses SQLite (`classroom.db`). The `init_db` function sets up five main tables:
*   `teachers` & `students`: User credentials.
*   `monitoring_sessions`: Tracks a student's time in a specific class.
*   `attention_logs`: Stores granular AI data (attention scores, head pose).
*   `alerts`: Stores events like "Looking away" or "Phone detected".
*   `meeting_links`: Manages active class sessions for teachers.

#### Authentication
Routes like `/student_login` and `/register` handle standard user authentication using session-based auth. Passwords are hashed using SHA-256 (`hash_password`) before storage, which is a security best practice.

#### WebSocket Events (Socket.IO)
This is crucial for the "Live" features.
*   `@socketio.on('join_class')`: A student connects to a specific "room" (class).
*   `@socketio.on('teacher_offer')` / `student_answer`: These are **WebRTC Signaling** events. They help the teacher's browser and student's browser shake hands to establish a direct video connection.
*   `@socketio.on('log_attention')`: Receives live AI data from students and broadcasts updates to the teacher.

---

## 3. Frontend: Student Monitor (`student_monitor.html`)

This is the most complex file. It combines UI, AI, and Networking.

### The AI Loop (`startMonitoring`)
The `loop()` function runs continuously (using `requestAnimationFrame`).
1.  **FaceMesh**: It sends the video frame to MediaPipe to find facial landmarks.
    *   **Logic**: It checks the nose position relative to the eyes to determine if the student is looking at the screen (`onFaceResults`).
2.  **CocoSSD**: It runs object detection periodically (randomly 5% of frames) to check for "cell phones".
3.  **Audio Analysis**: Checks for high noise levels using the Web Audio API.

### Connection Logic (`connectSocket`)
*   It connects to the server via Socket.IO.
*   It asks for the webcam stream instantly (`getUserMedia`).
*   **WebRTC**: When a `teacher_offer` arrives, it creates an `RTCPeerConnection` to send the student's video to the teacher.

---

## 4. Frontend: Teacher Dashboard (`teacher_dashboard.html`)

The teacher's command center.

### Real-time Updates
*   It listens for `teacher_alert` events to pop up toast notifications (e.g., "Student X is looking away").
*   It polls `/api/get_students` every 3 seconds to update the main table with the latest attention scores.

### Video Grid
*   The dashboard creates a "Video Card" for each student.
*   It receives the video stream via WebRTC (`addVideoCard` function).
*   It allows the teacher to "Kick" students or mute them.

---

## 5. User Flow Summary

1.  **Login**: User logs in (`student_login.html`).
2.  **Lobby**: Student enters a code in `student_dashboard.html`.
3.  **Monitoring**:
    *   Student lands on `student_monitor.html`.
    *   Browser asks for Camera/Mic permissions.
    *   AI models load.
    *   Student joins the socket room.
4.  **Teacher View**:
    *   Teacher sees the student appear in `teacher_dashboard.html`.
    *   Teacher's browser sends a "Video Offer".
    *   Student's browser answers.
    *   **Result**: Two-way video connection + Live AI stats.

## Study Tips regarding this code
*   **Async/Await**: Notice how `async` is used heavily in `student_monitor.html`. Loading AI models and setting up cameras takes time, so we must wait for them before proceeding.
*   **Socket.IO Rooms**: The app uses "rooms" effectively. A class equals a room. Messages sent to `room='CLASS123'` only go to people in that class.
*   **Separation of Concerns**: `app.py` doesn't do any image processing. It just routes data. All the heavy AI work is done in the user's browser (Edge Computing). This makes the server very fast and cheap to run.
