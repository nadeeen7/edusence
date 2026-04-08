import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../services/AuthContext";

const ProtectedRoute = ({ children, role }) => {
    const { user, loading, isAuthenticated } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[#8A2BE2]/30 border-t-[#8A2BE2] rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        // If we know the required role, we can pre-select the login portal
        const redirectPath = role === "teacher" ? "/teacher-login" : "/student-login";
        // Store the attempted URL so we can redirect back after login
        return <Navigate to={redirectPath} state={{ from: location }} replace />;
    }

    if (role && user.role !== role) {
        // User is logged in but has the wrong role for this page
        const fallbackPath = user.role === "teacher" ? "/teacher-dashboard" : "/student-dashboard";
        return <Navigate to={fallbackPath} replace />;
    }

    return children;
};

export default ProtectedRoute;
