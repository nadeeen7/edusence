import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../services/AuthContext";
import Card from "../components/Card";
import Notification from "../components/Notification";
import api from "../services/api";
import LiveSession from "./LiveSession";



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
        totalClasses: 0,
        lastClassDate: "N/A",
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
                const data = res.data;
                setStats({
                    totalStudents: data.totalStudents,
                    activeStudents: data.activeStudents,
                    classAvg: data.activeStudents > 0 ? data.classAvg : data.historicalAvg,
                    highestAttention: data.activeStudents > 0 ? data.highestAttention : data.lastClassStats.bestStudent,
                    lowestAttention: data.activeStudents > 0 ? data.lowestAttention : data.lastClassStats.needsImprovement,
                    classStatus: data.classStatus,
                    chartData: data.chartData,
                    historicalAvg: data.historicalAvg,
                    lastClassStats: data.lastClassStats,
                    totalClasses: data.totalClasses || 0,
                    lastClassDate: data.lastClassDate || "N/A"
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
            const errMsg = err.response?.data?.message || err.message || "Failed to start session. Please try again.";
            setNotification({ type: "error", message: errMsg });
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

    const handleDownloadReport = async () => {
        try {
            setNotification({ type: "info", message: "Generating report..." });
            const response = await api.get('/api/download_report', {
                responseType: 'blob',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            // Extract filename from content-disposition
            let filename = `class_report_${new Date().toISOString().split('T')[0]}.csv`;
            const disposition = response.headers['content-disposition'];
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/[ '"]/g, '');
                }
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            setNotification({ type: "success", message: "Report downloaded successfully" });
        } catch (err) {
            console.error("Report download error:", err);
            let msg = "Failed to download report";

            if (err.response?.data instanceof Blob) {
                // If it's a blob, we need to read it as text to see the JSON error
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const errorData = JSON.parse(reader.result);
                        setNotification({ type: "error", message: errorData.message || msg });
                    } catch {
                        setNotification({ type: "error", message: msg });
                    }
                };
                reader.readAsText(err.response.data);
                return;
            }

            msg = err.response?.data?.message || msg;
            setNotification({ type: "error", message: msg });
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-blue-500/30 flex flex-col">
            <div className="fixed inset-0 bg-[#0b1120] text-white flex flex-col z-[9999] pointer-events-none opacity-0"></div>
            {notification && (
                <div className="fixed top-4 right-4 z-50">
                    <Notification {...notification} onClose={() => setNotification(null)} />
                </div>
            )}

            {/* Standard Dashboard Header */}
            <header className="w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-40">
                <div className="w-full px-8 flex items-center justify-between h-20">
                    {/* Left: Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 14l9-5-9-5-9 5 9 5z"></path></svg>
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            Edu<span className="text-blue-500">sence</span>
                        </h1>
                    </div>

                    {/* Right: Logout */}
                    <button
                        onClick={handleLogout}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Dashboard Content */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12 lg:py-20 flex flex-col items-center animate-fade-in relative z-10">

                {/* Titles */}
                <div className="text-center space-y-3 mb-12">
                    <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
                        Teacher Portal
                    </h2>
                    <p className="text-slate-400 text-lg font-medium tracking-wide">
                        Welcome back, <span className="text-slate-200 font-bold">{teacherInfo.name || teacherInfo.email}</span>
                    </p>
                </div>

                {/* Actions Row */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 w-full sm:w-auto">
                    <button
                        onClick={handleStartClass}
                        disabled={loading}
                        className="w-full sm:w-auto group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all duration-300 shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        )}
                        Start Live Session
                    </button>
                    <button
                        onClick={handleDownloadReport}
                        className="w-full sm:w-auto px-8 py-4 bg-slate-800/50 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-sm uppercase tracking-widest rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Download Report
                    </button>
                </div>

                {/* Minimalist Stat Card */}
                <div className="w-full max-w-md">
                    <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[2rem] shadow-2xl backdrop-blur-md relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-24 h-24 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <div className="relative z-10 text-center space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Last Class Attendance</h3>
                            <div className="flex items-center justify-center gap-3">
                                <div className="text-7xl font-black text-white tracking-tighter">
                                    {stats.totalStudents}
                                </div>
                                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-6">Students</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TeacherDashboard;
