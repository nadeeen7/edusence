import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Notification from "../components/Notification";
import api from "../services/api";
import { useAuth } from "../services/AuthContext";

const StudentLogin = () => {
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setNotification(null);
        try {
            const res = await api.post("/login", { ...formData, role: 'student' });
            if (res.data.success) {
                setNotification({ type: "success", message: "Login successful!" });
                login(res.data.user, res.data.token);
                setTimeout(() => navigate("/student-dashboard"), 1000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Login failed. Please check your credentials.";
            setNotification({ type: "error", message: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            {notification && <Notification {...notification} />}
            <Card className="w-full max-w-md border-purple-500/20">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 mb-4">
                        <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">Student Portal</h2>
                    <p className="text-gray-400">Sign in to join your classroom</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            placeholder="alice@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </Card>
        </div>
    );
};

export default StudentLogin;
