import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const roomFromUrl = params.get("room");
        if (roomFromUrl) {
            setJoinRoomId(roomFromUrl.toUpperCase());
        }
    }, [location]);

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
        <div className="flex items-center justify-center min-h-[80vh] animate-fade-in">
            {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-5">
                        <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">
                        Welcome, <span className="text-purple-400">{user.name || "Student"}</span>
                    </h1>
                    <p className="text-slate-500 text-sm">Enter your classroom code to join a live session</p>
                </div>

                <Card className="border-purple-500/10 bg-[#1e293b]/50">
                    <form onSubmit={handleJoinClass} className="space-y-5">
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Room ID</label>
                            <input
                                type="text"
                                required
                                className={`w-full bg-slate-900/50 border rounded-xl px-5 py-4 text-white text-lg focus:outline-none transition-all font-mono uppercase tracking-wider placeholder:text-slate-600 ${joinRoomId ? 'border-purple-500 ring-1 ring-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'border-slate-700/50 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'}`}
                                placeholder="e.g. CLASS-1234"
                                value={joinRoomId}
                                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                            />
                            {new URLSearchParams(location.search).get("room") && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-purple-500/20 px-2 py-1 rounded text-[10px] font-black text-purple-400 uppercase tracking-widest border border-purple-500/20">
                                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                                    From Link
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loadingJoin || !joinRoomId.trim()}
                            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-xl shadow-purple-600/30 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3 text-lg"
                        >
                            {loadingJoin ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                    Join Class
                                </>
                            )}
                        </button>
                    </form>
                    <p className="text-[10px] text-slate-600 mt-4 text-center">
                        By joining, you agree to share your camera feed for automated attention monitoring.
                    </p>
                </Card>
            </div>
        </div >
    );
};

export default StudentDashboard;
