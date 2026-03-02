import { Navigate } from "react-router-dom";
import { useAuth } from "../services/AuthContext";

const ProtectedRoute = ({ children, role }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[#8A2BE2]/30 border-t-[#8A2BE2] rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to={role === "teacher" ? "/teacher-login" : "/student-login"} replace />;
    }

    if (role && user.role !== role) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;
