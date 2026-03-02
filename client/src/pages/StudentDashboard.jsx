import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Notification from "../components/Notification";
import api from "../services/api";
import { useAuth } from "../services/AuthContext";

const StudentDashboard = () => {
    const { user, logout } = useAuth();
    const [joinRoomId, setJoinRoomId] = useState("");
    const [notification, setNotification] = useState(null);
    const [personalAttention, setPersonalAttention] = useState("---");
    const [loadingJoin, setLoadingJoin] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user?.id) return;

        const fetchStats = async () => {
            try {
                const res = await api.get(`/api/get_student_stats/${user.id}`);
                if (res.data && res.data.success && res.data.logs?.length > 0) {
                    setPersonalAttention(Math.round(res.data.logs[0].attention_score));
                } else {
                    setPersonalAttention("---");
                }
            } catch (error) {
                console.error("Failed to fetch student stats:", error);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, [user?.id]);

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const handleJoinClass = async (e) => {
        e.preventDefault();
        const roomId = joinRoomId.trim().toUpperCase();
        if (!roomId) return;

        setLoadingJoin(true);
        setNotification(null);
        try {
            const validateRes = await api.get(`/api/validate_room?code=${roomId}`);
            if (!validateRes.data || !validateRes.data.valid) {
                setNotification({ type: "error", message: validateRes.data.message || "Invalid Room ID." });
                setLoadingJoin(false);
                return;
            }

            const sessionRes = await api.post("/api/start_session", {
                student_id: user.id,
                room: roomId
            });

            if (sessionRes.data && sessionRes.data.success) {
                setNotification({ type: "success", message: "Connecting to Session..." });
                setTimeout(() => navigate(`/monitor?room=${roomId}&session=${sessionRes.data.session_id}`), 500);
            } else {
                setNotification({ type: "error", message: sessionRes.data.message || "Failed to start monitoring session." });
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || "Connection error. Please try again later.";
            setNotification({ type: "error", message: errorMsg });
            setLoadingJoin(false);
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-8 animate-fade-in">
            {notification && <Notification {...notification} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Student Dashboard</h1>
                    <p className="text-gray-400">Welcome, {user.name || "Student"}</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2 rounded-lg transition-colors font-medium"
                >
                    Logout
                </button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <h3 className="text-xl font-bold text-white mb-4">Join a Classroom</h3>
                    <form onSubmit={handleJoinClass} className="flex gap-4">
                        <input
                            type="text"
                            required
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono uppercase"
                            placeholder="Enter Room ID (e.g. CLASS-1234)"
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                        />
                        <button
                            type="submit"
                            disabled={loadingJoin}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] whitespace-nowrap"
                        >
                            {loadingJoin ? "Connecting..." : "Join Session"}
                        </button>
                    </form>
                    <p className="text-xs text-slate-500 mt-4">
                        By joining, you agree to share your camera feed for automated attention monitoring.
                    </p>
                </Card>

                <Card className="border-blue-500/20 text-center flex flex-col justify-center items-center">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Recent Attention Average</h3>
                    <p className="text-5xl font-extrabold text-blue-400">
                        {personalAttention}{personalAttention !== "---" && "%"}
                    </p>
                </Card>
            </div>

            <Card>
                <h3 className="text-xl font-bold text-white mb-4">Monitor Status</h3>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700">
                    <div className="w-3 h-3 rounded-full bg-slate-500 drop-shadow-md"></div>
                    <div>
                        <p className="text-white font-medium">Monitor is currently inactive</p>
                        <p className="text-sm text-gray-400">Join a classroom to activate camera monitoring via backend endpoints.</p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default StudentDashboard;
