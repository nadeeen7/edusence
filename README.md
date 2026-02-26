# EduSense – AI Classroom Attention Detection System

EduSense is an AI-based classroom monitoring system that detects student attention levels using computer vision and machine learning. In an era of increasing online education, maintaining student engagement is a significant challenge. EduSense addresses this by using real-time webcam input to analyze facial orientation, eye movement, and head position to determine whether a student is attentive or distracted.

---

## 1. Project Overview

### **Brief Explanation**
EduSense integrates advanced computer vision models into a web-based platform to provide teachers with live insights into their classroom's engagement. It serves as a bridge between remote students and educators, ensuring that the human element of "paying attention" is monitored and supported through technology.

### **Purpose of the System**
The primary purpose of EduSense is to provide a non-intrusive, automated way to track student focus. By analyzing behavioral cues like gaze direction and head pose, the system generates "attention scores" that help educators identify when a student might need more support or when the lesson pace needs adjustment.

### **Problem it Solves**
- **Passive Learning**: Prevents students from "tuning out" during long sessions.
- **Limited Feedback**: Solves the issue where teachers cannot visually scan a remote classroom to gauge interest.
- **Distraction Management**: Detects looking away, phone usage, and other off-task behaviors automatically.

---

## 2. Technologies / Framework Used

- **Python**: Core programming language for backend and AI logic.
- **Flask**: Lightweight WSGI web application framework for the server.
- **OpenCV**: Open-source computer vision library for image processing.
- **MediaPipe**: Used for high-fidelity facial landmark detection and head pose estimation.
- **TensorFlow.js**: Enables client-side object detection (e.g., cell phone detection) directly in the browser.
- **HTML, CSS (Tailwind), JavaScript**: Powers the responsive and dynamic front-end dashboard.
- **Socket.IO**: Facilitates real-time, bi-directional communication between the student and teacher dashboards.
- **WebRTC**: Enables peer-to-peer live video streaming for the teacher's classroom view.

---

## 3. System Requirements

- **Python Version**: 3.8 or higher.
- **Hardward**: A functional webcam (internal or external).
- **Browser**: Modern web browser with WebRTC and JavaScript support (Google Chrome or Microsoft Edge recommended).
- **Core Dependencies**: Flask, Flask-SocketIO, Eventlet, OpenCV-Python.

---

## 4. How to Install Prerequisites

### **Step 1: Install Python**
Download and install Python 3.8+ from the [official website](https://www.python.org/downloads/). Ensure you check the box **"Add Python to PATH"** during installation.

### **Step 2: Create a Virtual Environment**
Open your terminal/command prompt and navigate to the project root:
```bash
python -m venv venv
```

### **Step 3: Activate the Virtual Environment**
- **Windows**:
  ```bash
  venv\Scripts\activate
  ```
- **macOS/Linux**:
  ```bash
  source venv/bin/activate
  ```

### **Step 4: Install Dependencies**
Install all required libraries, including Flask, OpenCV, and others listed in the requirements file:
```bash
pip install -r requirements.txt
```

---

## 5. How to Run the Application

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   ```

2. **Navigate to the Project Folder**
   ```bash
   cd ai_class
   ```

3. **Activate the Virtual Environment**
   (See Step 3 in the Installation section)

4. **Run the Application**
   ```bash
   python server/app.py
   ```

5. **Open in Browser**
   Once the server starts, navigate to:
   `http://127.0.0.1:5000`

---

## 6. Project Modules

- **Authentication Module**: Secure login and registration flows for both Teachers and Students.
- **Room Creation Module**: Allows teachers to generate unique, secure classroom room codes.
- **Room Join Module**: Enables students to enter a classroom using a valid session Room ID.
- **Attention Detection Module**: The AI engine that processes video frames to calculate attention scores based on face mesh and head pose.
- **Dashboard Module**: 
  - **Teacher**: Real-time grid view of students with live attention meters.
  - **Student**: Focused learning interface with background monitoring.
- **Error Handling Module**: Integrated system to manage invalid room IDs, camera permission denials, and connection drops.

---

## 7. Code Structure

- **`app.py`**: The main entry point of the application; handles routing, socket events, and database interactions.
- **`templates/`**: Contains HTML templates for all views (Login, Dashboard, Monitor).
- **`static/`**: Houses CSS styles (Tailwind), client-side JavaScript, and local AI model assets.
- **`models/`**: (If present) Dedicated directory for pre-trained machine learning models used for detection.
- **`utils/`**: Helper scripts for tasks like database initialization and SSL certificate generation.

---

## 8. Software User Stories

- **As a teacher**, I want to create a room so that my students can join a private, monitored session.
- **As a student**, I want to join using a room ID so I can participate in the live lesson.
- **As a teacher**, I want to monitor student attention in real-time to adjust my teaching strategy.
- **As a system**, I should show an error message if an invalid or inactive room ID is entered.
- **As a user**, I want clear camera permission handling to ensure I know when my camera is being used for monitoring.

---

## 9. Features

- ✅ **Real-time Attention Monitoring**: Constant tracking of engagement through facial landmarks.
- ✅ **Automatic Distraction Detection**: Visual and audio alerts for looking away or using a phone.
- ✅ **Professional Error Handling**: Graceful recovery from network issues or invalid inputs.
- ✅ **Live Webcam Integration**: High-performance video streaming with low latency.
- ✅ **Mobile Responsive**: Dashboard accessible from both desktop and mobile devices.

---

## 10. Future Enhancements

- **Deep Analytics**: Long-term attendance and attention reports with data visualization.
- **Cloud Deployment**: Migration to AWS/Azure for global scalability.
- **Improved AI Models**: Integration of emotion detection to gauge student understanding.
- **LMS Integration**: Seamless connection with Google Classroom or Moodle.

---

## 11. License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for more details.
