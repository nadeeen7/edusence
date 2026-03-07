import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

import Home from "./pages/Home";
import Register from "./pages/Register";
import TeacherLogin from "./pages/TeacherLogin";
import StudentLogin from "./pages/StudentLogin";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudentMonitor from "./pages/StudentMonitor";
import LiveSession from "./pages/LiveSession";

function App() {
  const location = useLocation();
  const hideNavbar = ["/monitor"].some(path => location.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-blue-500/30">
      {!hideNavbar && <Navbar />}
      <main className={`${hideNavbar ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/teacher-login" element={<TeacherLogin />} />
          <Route path="/student-login" element={<StudentLogin />} />

          <Route path="/teacher-dashboard" element={
            <ProtectedRoute role="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          } />

          <Route path="/student-dashboard" element={
            <ProtectedRoute role="student">
              <StudentDashboard />
            </ProtectedRoute>
          } />

          <Route path="/monitor" element={
            <ProtectedRoute role="student">
              <ErrorBoundary>
                <StudentMonitor />
              </ErrorBoundary>
            </ProtectedRoute>
          } />

          <Route path="/teacher_dashboard" element={<Navigate to="/teacher-dashboard" replace />} />
          <Route path="/student_dashboard" element={<Navigate to="/student-dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;