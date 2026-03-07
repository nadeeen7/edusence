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
                    lastClassStats: data.lastClassStats
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
        <div className="space-y-10 animate-fade-in p-4 lg:p-0">
            {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Teacher <span className="text-blue-500">Dashboard</span></h1>
                        {stats.activeStudents > 0 && (
                            <span className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-red-500/20 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.6)]"></span>
                                Live
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Welcome back, <span className="text-slate-300">{teacherInfo.name || teacherInfo.email}</span></p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleDownloadReport}
                        className="bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 border border-slate-700/50 px-5 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold hover:text-white flex items-center gap-2 group hover:border-slate-600"
                    >
                        <svg className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Download Report
                    </button>
                    <button
                        onClick={handleStartClass}
                        disabled={loading}
                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                    >
                        {loading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        Start New Class
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-[#0d1320]/70 border-slate-800/50 p-7 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300 backdrop-blur-sm">
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-500/60 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="flex items-start justify-between mb-6">
                        <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/10">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-500 border border-slate-700/40 uppercase tracking-widest">
                            Last Class
                        </span>
                    </div>
                    <h3 className="text-slate-500 font-semibold uppercase tracking-[0.15em] text-[10px] mb-1.5">Attendance</h3>
                    <div className="flex items-baseline gap-2">
                        <p className="text-5xl font-black text-white">{stats.totalStudents}</p>
                        <p className="text-xs text-slate-500 font-medium">students joined</p>
                    </div>
                </Card>

                <Card className="bg-[#0d1320]/70 border-slate-800/50 p-7 relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300 backdrop-blur-sm">
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500/60 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="flex items-start justify-between mb-6">
                        <div className="p-2.5 bg-indigo-500/10 rounded-lg border border-indigo-500/10">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        </div>
                        <div className="w-11 h-11">
                            <svg viewBox="0 0 36 36" className="w-full h-full"><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeDasharray={`${stats.classAvg}, 100`} stroke="#818cf8" strokeWidth="2.5" fill="none" strokeOpacity="0.15" /><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeDasharray={`${stats.classAvg}, 100`} stroke="#818cf8" strokeWidth="2.5" fill="none" strokeLinecap="round" /></svg>
                        </div>
                    </div>
                    <h3 className="text-slate-500 font-semibold uppercase tracking-[0.15em] text-[10px] mb-1.5">Average Attention</h3>
                    <p className="text-5xl font-black text-white">{stats.classAvg}<span className="text-3xl text-slate-400">%</span></p>
                </Card>
            </div>

            {/* Session Insights */}
            <Card className="bg-[#0d1320]/50 border-slate-800/50 p-8 lg:p-10 relative overflow-hidden backdrop-blur-md group hover:border-slate-700/60 transition-all duration-300">
                <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/[0.03] blur-[80px] rounded-full -mr-36 -mt-36 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/[0.03] blur-[60px] rounded-full -ml-24 -mb-24 pointer-events-none"></div>
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800/60 rounded-full border border-slate-700/40">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.6)]"></span>
                            <span className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[9px]">Last Session</span>
                        </div>
                        <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Session <span className="text-blue-500">Insights</span></h2>
                        <p className="text-slate-500 text-xs max-w-sm font-medium leading-relaxed">Key metrics from your most recent class.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-6 md:gap-10 border-t lg:border-t-0 lg:border-l border-slate-800/60 pt-6 lg:pt-0 lg:pl-10 w-full lg:w-auto">
                        <div className="flex flex-col items-center lg:items-start gap-1">
                            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-[0.15em]">Duration</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl lg:text-3xl font-black text-white">{stats.lastClassStats.duration}</span>
                                <span className="text-[10px] text-slate-600 font-bold uppercase">min</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center lg:items-start gap-1">
                            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-[0.15em]">Engagement</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl lg:text-3xl font-black text-blue-400">{stats.lastClassStats.avgAttention}<span className="text-lg text-blue-400/60">%</span></span>
                                <span className="text-[10px] text-slate-600 font-bold uppercase">avg</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center lg:items-start gap-1">
                            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-[0.15em]">Students</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl lg:text-3xl font-black text-white">{stats.lastClassStats.studentsCount}</span>
                                <span className="text-[10px] text-slate-600 font-bold uppercase">pax</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default TeacherDashboard;
