<p align="center">
  <h1 align="center">🎓 EduSense</h1>
  <p align="center"><strong>AI-Powered Classroom Attention Monitoring System</strong></p>
  <p align="center">
    Real-time student engagement tracking using computer vision, WebRTC, and professional dashboard analytics.
  </p>
</p>

---

## 📖 About

**EduSense** is an intelligent classroom monitoring platform that uses AI-powered face tracking to measure student attention in real time during live online classes. Teachers can start a session, observe student engagement through a live dashboard, and review post-session analytics — all from a single unified interface.

The system solves a critical problem in online education: **teachers cannot see if students are actually paying attention**. EduSense uses MediaPipe Face Mesh to analyze facial landmarks (eye aspect ratio, mouth aspect ratio, head pose), compute an attention score, and stream it live to the teacher's dashboard.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Real-Time Attention Tracking** | Uses MediaPipe Face Mesh to detect student focus by analyzing head orientation (pitch) in real time |
| **Live Student Monitor** | Immersive student interface with AI-powered attention tracking and draggable PIP video |
| **Live Teacher Dashboard** | Real-time student video grid with individual attention percentages, status indicators, and controls |
| **Simple Dashboard Portal** | Minimalist teacher interface focused on session starts, attendance tracking and analytics download |
| **WebRTC Video Streaming** | Peer-to-peer video/audio between teacher and students with robust track management |
| **QR Code Joining** | Students can instantly join classes by scanning the teacher's QR code or clicking a mobile access link |
| **Raise Hand** | Students can raise their hand during class; teachers see professional notifications instantly via Socket.IO |
| **Mic & Camera Toggle** | Students can mute/unmute audio and enable/disable video, with state synced to the teacher's view |
| **Session Insights** | Post-class analytics showing duration, average engagement %, and student count per session |
| **CSV Report Download** | Teachers can download a CSV report of student performance after each session |
| **JWT Token Refresh** | Enhanced security with automatic session refresh and "Invalid Token" recovery logic |
| **Role-Based Auth** | Separate login portals for teachers and students with secure JWT-based authentication |
| **Mobile-Ready Design** | Responsive layout optimized for mobile browsers with stable Swap View functionality |
| **Persistent Sessions** | Active class sessions persist across page refreshes via `localStorage` |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│              React 19 + Vite + TailwindCSS              │
│                                                         │
│   ┌─────────────┐   ┌──────────────┐   ┌────────────┐  │
│   │  Teacher     │   │   Student    │   │  Student   │  │
│   │  Dashboard   │   │   Dashboard  │   │  Monitor   │  │
│   └──────┬──────┘   └──────┬───────┘   └─────┬──────┘  │
│          │                 │                  │         │
│          │          Socket.IO + WebRTC        │         │
└──────────┼─────────────────┼──────────────────┼─────────┘
           │                 │                  │
           ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                       BACKEND                           │
│              Flask + Flask-SocketIO + Eventlet           │
│                                                         │
│   ┌──────────┐  ┌─────────────┐  ┌──────────────────┐  │
│   │ REST API │  │  WebSocket  │  │  WebRTC Signaling │  │
│   │ (Auth,   │  │  (Rooms,    │  │  (Offer/Answer/   │  │
│   │  Stats)  │  │  Attention) │  │   ICE Candidates) │  │
│   └────┬─────┘  └──────┬──────┘  └──────────────────┘  │
│        │               │                                │
│        ▼               ▼                                │
│   ┌─────────────────────────┐                           │
│   │    SQLite Database      │                           │
│   │  (SQLAlchemy ORM)       │                           │
│   └─────────────────────────┘                           │
└─────────────────────────────────────────────────────────┘

AI Processing (Client-Side):
┌──────────────────────────────────┐
│  MediaPipe Face Mesh (468 pts)   │
│  → Head Pose (Pitch Analysis)    │
│  → Attention Status (Focused,    │
│    Looking Up/Down, etc.)        │
│  → Attention Score (0–100%)     │
└──────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite 7** | Build tool and dev server |
| **TailwindCSS 3** | Utility-first CSS styling |
| **Socket.IO Client** | Real-time bidirectional communication |
| **Axios** | HTTP client for REST API calls |
| **React Router v7** | Client-side routing |
| **Lucide React** | Icon library |
| **MediaPipe Face Mesh** | Client-side AI face landmark detection |
| **html5-qrcode** | High-performance QR code scanning library |
| **WebRTC** | Peer-to-peer video/audio streaming |

### Backend
| Technology | Purpose |
|---|---|
| **Flask 3.0** | Python web framework |
| **Flask-SocketIO** | WebSocket support with room management |
| **Flask-SQLAlchemy** | ORM for database operations |
| **Flask-Migrate** | Database migration management |
| **Flask-CORS** | Cross-Origin Resource Sharing |
| **Eventlet** | Async networking for WebSocket support |
| **PyJWT** | JSON Web Token authentication |
| **Werkzeug** | Password hashing and security utilities |

### Database
| Technology | Purpose |
|---|---|
| **SQLite** | Lightweight relational database (development) |
| **PostgreSQL** | Production database (supported via `psycopg2`) |

---

## 📁 Project Structure

```
edusense/
├── client/                          # React Frontend
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   │   ├── Card.jsx             # Glassmorphic card component
│   │   │   ├── ErrorBoundary.jsx    # React error boundary
│   │   │   ├── Login.jsx            # Shared login form component
│   │   │   ├── Navbar.jsx           # Navigation bar
│   │   │   ├── Notification.jsx     # Toast notification system
│   │   │   └── ProtectedRoute.jsx   # Role-based route guard
│   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── useMediaStream.js    # Camera/mic stream management
│   │   │   └── useSocketSession.js  # Socket.IO room connection
│   │   ├── pages/                   # Application pages
│   │   │   ├── Home.jsx             # Landing page
│   │   │   ├── Register.jsx         # User registration
│   │   │   ├── TeacherLogin.jsx     # Teacher login portal
│   │   │   ├── StudentLogin.jsx     # Student login portal
│   │   │   ├── TeacherDashboard.jsx # Teacher analytics dashboard
│   │   │   ├── StudentDashboard.jsx # Student class join interface
│   │   │   ├── LiveSession.jsx      # Teacher live class view
│   │   │   └── StudentMonitor.jsx   # Student monitoring + AI
│   │   ├── services/                # API and auth services
│   │   │   ├── api.js               # Axios instance with JWT
│   │   │   ├── AuthContext.jsx      # React context for auth state
│   │   │   └── socketService.js     # Socket.IO client singleton
│   │   ├── App.jsx                  # Root component with routing
│   │   └── main.jsx                 # Application entry point
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                          # Flask Backend
│   ├── app.py                       # Main application (routes + sockets)
│   ├── auth.py                      # JWT token generation & validation
│   ├── config.py                    # App configuration
│   ├── models.py                    # SQLAlchemy database models
│   └── migrations/                  # Database migration files
│
├── requirements.txt                 # Python dependencies
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites

- **Node.js** ≥ 18.x
- **Python** ≥ 3.9
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/nadeeen7/edusence.git
cd edusence
```

### 2. Backend Setup

```bash
# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

Create a `.env` file inside the `server/` directory:

```env
DATABASE_URL=sqlite:///classroom.db
SECRET_KEY=your_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_here
FRONTEND_URL=http://localhost:5173
```

Start the backend server:

```bash
cd server
python app.py
```

The server will run on `http://localhost:5000`.

### 3. Frontend Setup

```bash
cd client

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will run on `http://localhost:5173`.

---

## 🚀 How It Works

### 1. Teacher Starts a Class
The teacher logs in and clicks **"Start New Class"**. A unique room code is generated and stored in the database. The teacher enters the Live Session view with their camera feed.

### 2. Students Join
Students log in, enter the room code on their dashboard, and join the class. Their browser requests camera and microphone permissions.

### 3. AI Analyzes Attention
On the student's device, **MediaPipe Face Mesh** runs locally in the browser:
- Detects **468 facial landmarks** per frame
- Calculates **Eye Aspect Ratio (EAR)** to detect drowsiness or closed eyes
- Calculates **Mouth Aspect Ratio (MAR)** to detect yawning
- Estimates **head pose** (yaw and pitch) to detect looking away
- Computes a composite **attention score (0–100%)** every second
- Streams the score to the server via Socket.IO

### 4. Teacher Observes
The teacher monitors the class through a live dashboard:
- **Live Student Grid** — Immersive gallery of all connected students
- **Real-time Metrics** — Per-student attention % and class average updates
- **Session Controls** — Persistent room code share, hand-raise alerts, and session management
- **Audio/Video Sync** — Mute icons and camera status indicators updated in real-time

### 5. Post-Session Review
After ending the class, the **Teacher Dashboard** provides:
- **Attendance** — Accurate unique student count from the most recent session
- **Analytics Export** — Direct CSV download of session performance data
- **Classy Interface** — Simplified, distraction-free portal for teachers

---

## 📊 Database Models

| Model | Purpose |
|---|---|
| `Teacher` | Stores teacher accounts (name, email, hashed password) |
| `Student` | Stores student accounts with auto-generated IDs |
| `MeetingLink` | Tracks each class session with a unique room code |
| `MonitoringSession` | Per-student session record with start/end time |
| `AttentionLog` | Timestamped attention scores per student per session |
| `Alert` | Behavioral alerts (drowsiness, distraction, etc.) |
| `SessionAnalytics` | Aggregated post-session performance per student |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Register a new teacher or student |
| `POST` | `/login` | Authenticate and receive JWT token |
| `GET` | `/api/validate_room` | Check if a room code is valid and active |
| `POST` | `/api/generate_meeting_link` | Create a new class session |
| `GET` | `/api/dashboard/stats` | Fetch teacher dashboard statistics |
| `GET` | `/api/download_report` | Download CSV report for the last session |

---

## 🔧 Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `join_room` | Client → Server | Join a class session room |
| `student_joined` | Server → Client | Notify teacher of new student |
| `attention-update` | Client → Server | Student sends attention score |
| `dashboard_update` | Server → Client | Broadcast updated class stats |
| `raise_hand` | Client → Server | Student raises/lowers hand |
| `media_state_change` | Client → Server | Mic/camera toggle sync |
| `teacher_offer` | Server → Client | WebRTC offer relay |
| `student_answer` | Server → Client | WebRTC answer relay |
| `ice_candidate` | Server → Client | ICE candidate relay |
| `end_class` | Client → Server | Teacher ends the session |
| `class_ended` | Server → Client | Notify all students class ended |
| `kick_student` | Client → Server | Teacher removes a student |

---

## 🖼️ Screenshots

> Add screenshots of your application here:

<!-- 
![Teacher Dashboard](./screenshots/teacher-dashboard.png)
![Live Session](./screenshots/live-session.png)
![Student Monitor](./screenshots/student-monitor.png) 
-->

| View | Description |
|---|---|
| **Teacher Dashboard** | Analytics overview with attendance, attention %, and session insights |
| **Live Session** | Real-time student video grid with attention scores and controls |
| **Student Monitor** | Student's view with camera feed, AI processing, and mic/camera toggles |
| **Student Dashboard** | Clean interface to enter room code and join a class |

---

## 🗺️ Roadmap

- [ ] **Multi-class History** — Browse analytics from all past sessions, not just the last one
- [ ] **Emotion Detection** — Extend AI to detect student emotions (confused, bored, engaged)
- [ ] **Screen Recording** — Record class sessions for later review
- [ ] **Chat System** — In-class text chat between teacher and students
- [ ] **Advanced Student Analytics** — Show students their own trends over time
- [ ] **PostgreSQL Production** — Full migration to PostgreSQL for concurrent access
- [ ] **Deployment Pipeline** — automated CI/CD for cloud hosting
- [x] **Deployment Guide** — [Detailed instructions](file:///c:/Users/Nadeen/Documents/ai_class/docs/deployment_guide.md) for production hosting

---

## 👥 Authors

- **Nadeen** — Full-stack development, AI integration, and system architecture

---

## 📄 License

This project is developed for educational purposes. All rights reserved.




