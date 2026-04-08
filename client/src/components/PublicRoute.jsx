import { Navigate } from "react-router-dom";
import { useAuth } from "../services/AuthContext";

const PublicRoute = ({ children }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) return null; // AuthProvider handles main loading, but safety first

    if (isAuthenticated && user) {
        // Logged in users should go to their respective dashboards
        const dashboard = user.role === "teacher" ? "/teacher-dashboard" : "/student-dashboard";
        return <Navigate to={dashboard} replace />;
    }

    return children;
};

export default PublicRoute;
