# EduSense - AI-Powered Classroom Monitor

EduSense is a modern, real-time classroom monitoring system that leverages AI to track student attention and engagement during live sessions. It provides teachers with actionable insights into student focus while maintaining a distraction-free environment for students.

## 🚀 Key Features

- **Real-time Attention Tracking**: Uses MediaPipe FaceMesh to monitor gaze, head orientation, and eye-opening ratios.
- **Dynamic Teacher Dashboard**: Real-time view of all students with live attention scores and focus status.
- **WebRTC Integration**: Low-latency video streaming between teachers and students.
- **Robust Authentication**: JWT-based login with role-detection and case-insensitive email handling.
- **Alert System**: Automatic alerts for "Looking Away", "Drowsiness Detection", and "Distraction".

## 🛠️ Tech Stack

### Backend
- **Framework**: Flask (Python 3.10+)
- **Real-time**: Flask-SocketIO (with Eventlet)
- **Database**: PostgreSQL (SQLAlchemy ORM)
- **Security**: JWT (PyJWT), Werkzeug Hashing
- **Environment**: Python-Dotenv

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS
- **AI/ML**: Google MediaPipe (FaceMesh)
- **Icons**: Lucide React
- **API**: Axios

## 📂 Project Structure

```text
ai_class/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI Components (Cards, Notifications)
│   │   ├── pages/          # Full Views (LiveSession, StudentMonitor)
│   │   ├── services/       # API (Axios) and Auth Context
│   │   └── App.jsx         # Main Routing
│   └── package.json
├── server/                 # Flask Backend
│   ├── app.py              # Main Entry Point & Socket Handlers
│   ├── models.py           # Database Schema (Teacher, Student, Logs)
│   ├── auth.py             # JWT & Auth Decorators
│   └── config.py           # Application Configuration
└── scripts/                # Utility & Verification Scripts
```

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- PostgreSQL Database

### 1. Backend Setup
```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install flask flask-sqlalchemy flask-socketio flask-cors flask-migrate psycopg2-binary pyjwt python-dotenv eventlet
```
Create a `.env` file in the `server` directory:
```env
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your_secret_key
JWT_SECRET_KEY=your_jwt_secret
DATABASE_URL=postgresql://user:pass@localhost:5432/edusense_db
```

### 2. Frontend Setup
```bash
cd client
npm install
```

## 🏃 Running the Application

1. **Start Backend**:
   ```bash
   cd server
   python app.py
   ```
2. **Start Frontend**:
   ```bash
   cd client
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## 👥 User Stories

### For Teachers
- **Login**: Secure access via the Teacher Portal.
- **Class Creation**: Generate a unique Room ID to share with students.
- **Monitoring**: Switch between 'Gallery' view (all videos) and 'Dashboard' view (detailed analytics).
- **Engagement**: Receive real-time alerts if a student is losing focus or looking away.

### For Students
- **Login**: Joining the classroom with a simplified, minimal interface.
- **Focus**: Participate in class without seeing distracting attention scores (only the teacher sees them).
- **Interaction**: Use "Raise Hand" to notify the teacher without interrupting the flow.

## 🧱 Key Modules

- **LiveSession.jsx**: Orchestrates the teacher's multi-view monitoring system.
- **StudentMonitor.jsx**: Runs the local MediaPipe ML loop and emits attention data via Socket.io.
- **app.py**: Handles WebRTC signaling, Socket.io event routing, and API endpoints.


