import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../services/AuthContext";
import Card from "../components/Card";
import Notification from "../components/Notification";
import api from "../services/api";
import LiveSession from "./LiveSession";

const AttentionChart = ({ data }) => {
    const width = 300;
    const height = 100;
    const padding = 10;

    if (!data || data.length === 0 || data.every(v => v === 0)) {
        return (
            <div className="w-full h-32 mt-4 bg-slate-800/20 rounded-xl border border-dashed border-slate-700/50 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No Activity Yet</p>
            </div>
        );
    }

    const max = 100;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
        const y = height - (val / max) * (height - 2 * padding) - padding;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-32 mt-4 bg-slate-800/20 rounded-xl p-4 border border-slate-700/50 relative group">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path
                    d={`M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`}
                    fill="url(#lineGrad)"
                />
                <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    className="drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                />
            </svg>
        </div>
    );
};

const TeacherDashboard = () => {
    const { user: teacherInfo, logout } = useAuth();
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeStudents: 0,
        classAvg: 0,
        highestAttention: "N/A",
        lowestAttention: "N/A",
        classStatus: "Inactive",
        chartData: [],
        historicalAvg: 0,
        lastClassStats: {
            duration: "0 mins",
            studentsCount: 0,
            avgAttention: 0,
            focusedCount: 0,
            distractedCount: 0,
            bestStudent: "N/A",
            needsImprovement: "N/A"
        }
    });
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);
    const [view, setView] = useState("dashboard"); // 'dashboard' | 'live'
    const [roomCode, setRoomCode] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        if (!teacherInfo) return;
        const activeCode = localStorage.getItem("active_class_code");
        if (activeCode) {
            setRoomCode(activeCode);
            setView("live");
        }
    }, [teacherInfo]);

    const fetchDashboardData = async () => {
        try {
            const roomToFetch = localStorage.getItem("active_class_code");
            const url = roomToFetch ? `/api/dashboard/stats?room=${roomToFetch}` : "/api/dashboard/stats";
            const res = await api.get(url);

            if (res.data.success) {
                setStats({
                    totalStudents: res.data.totalStudents,
                    activeStudents: res.data.activeStudents,
                    classAvg: res.data.classAvg,
                    highestAttention: res.data.highestAttention,
                    lowestAttention: res.data.lowestAttention,
                    classStatus: res.data.classStatus,
                    chartData: res.data.chartData,
                    historicalAvg: res.data.historicalAvg || 0,
                    lastClassStats: res.data.lastClassStats || {
                        duration: "0 mins",
                        studentsCount: 0,
                        avgAttention: 0,
                        focusedCount: 0,
                        distractedCount: 0,
                        bestStudent: "N/A",
                        needsImprovement: "N/A"
                    }
                });
            } else {
                setNotification({ type: "error", message: res.data.message || "Failed to load dashboard data" });
            }
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            const msg = err.response?.data?.message || err.message || "Failed to load dashboard data";
            setNotification({ type: "error", message: msg });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!teacherInfo || view === "live") return;
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 10000);
        return () => clearInterval(interval);
    }, [teacherInfo, view]);

    const handleStartClass = async () => {
        try {
            setLoading(true);
            const res = await api.post("/api/generate_meeting_link", { teacher_id: teacherInfo.id });
            if (res.data.success) {
                const newCode = res.data.link_code;
                if (!newCode) return;
                localStorage.setItem("active_class_code", newCode);
                setRoomCode(newCode);
                setView("live");
            } else {
                setNotification({ type: "error", message: res.data.message || "Failed to start session" });
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Failed to start session. Please try again.";
            setNotification({ type: "error", message: msg });
        } finally {
            setLoading(false);
        }
    };

    const handleExitSession = () => {
        localStorage.removeItem("active_class_code");
        setRoomCode("");
        setView("dashboard");
        fetchDashboardData();
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    if (!teacherInfo) return null;

    if (view === "live") {
        return <LiveSession roomCode={roomCode} onExit={handleExitSession} />;
    }

    const handleDownloadReport = () => {
        const token = localStorage.getItem('token');
        window.open(`http://localhost:5000/api/download_report?token=${token}`, '_blank');
    };

    return (
        <div className="space-y-8 animate-fade-in p-4 lg:p-0">
            {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-4xl font-black text-white tracking-tight text-glow">Teacher <span className="text-blue-500">Dashboard</span></h1>
                        {stats.activeStudents > 0 && (
                            <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-red-500/20 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                Live
                            </span>
                        )}
                    </div>
                    <p className="text-slate-400 font-medium italic">Welcome back, {teacherInfo.name || teacherInfo.email}</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleDownloadReport}
                        className="bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/50 px-6 py-3 rounded-xl transition-all font-bold hover:text-white flex items-center gap-2 group"
                    >
                        <svg className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Export CSV
                    </button>
                    <button
                        onClick={handleStartClass}
                        disabled={loading}
                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-xl shadow-blue-600/40 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        Start New Class
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="bg-[#1e293b]/50 border-blue-500/10 p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2">Previous Class Attendance</h3>
                    <div className="flex items-end justify-between">
                        <p className="text-4xl font-black text-white">{stats.totalStudents}</p>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            Students
                        </span>
                    </div>
                </Card>

                <Card className="bg-[#1e293b]/50 border-blue-500/10 p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2">Class Average Attention</h3>
                    <div className="flex items-end justify-between">
                        <p className="text-4xl font-black text-blue-500">{stats.classAvg}%</p>
                        <div className="w-12 h-12 opacity-20">
                            <svg viewBox="0 0 36 36" className="w-full h-full"><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeDasharray={`${stats.classAvg}, 100`} stroke="currentColor" strokeWidth="3" fill="none" /></svg>
                        </div>
                    </div>
                </Card>

                <Card className="bg-[#1e293b]/50 border-blue-500/10 p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2">Best Student</h3>
                    <p className="text-xl font-black text-white truncate">{stats.highestAttention}</p>
                    <p className="text-[10px] text-green-500 font-bold mt-1">Performing Best</p>
                </Card>

                <Card className="bg-[#1e293b]/50 border-blue-500/10 p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2">Needs Improvement</h3>
                    <p className="text-xl font-black text-white truncate">{stats.lowestAttention}</p>
                    <p className="text-[10px] text-red-500 font-bold mt-1">Needs Support</p>
                </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-[#1e293b]/50 border-slate-800 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-white tracking-tight">Attention Trend</h3>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Last 10 updates</span>
                    </div>
                    <AttentionChart data={stats.chartData} />
                </Card>

                <Card className="bg-[#1e293b]/50 border-slate-800 p-6">
                    <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-4">Last Class Summary</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                            <span className="text-xs text-slate-400">Class Duration</span>
                            <span className="text-sm font-bold text-white">{stats.lastClassStats.duration}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                            <span className="text-xs text-slate-400">Number of Students</span>
                            <span className="text-sm font-bold text-white">{stats.lastClassStats.studentsCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Average Attention</span>
                            <span className="text-sm font-bold text-blue-500">{stats.lastClassStats.avgAttention}%</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default TeacherDashboard;
