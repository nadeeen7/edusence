import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../services/AuthContext";
import Card from "../components/Card";
import Notification from "../components/Notification";
import api from "../services/api";

const Register = () => {
    const { user, isAuthenticated } = useAuth();
    const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "teacher" });
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null);
    const navigate = useNavigate();

    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isAuthenticated && user) {
            const dashboard = user.role === "teacher" ? "/teacher-dashboard" : "/student-dashboard";
            navigate(dashboard, { replace: true });
        }
    }, [isAuthenticated, user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setNotification(null);
        try {
            console.log("Submitting registration:", formData);
            const res = await api.post("/register", formData);
            console.log("Registration Response:", res.data);
            if (res.data.success) {
                setNotification({ type: "success", message: res.data.message || "Registration successful! Redirecting to login..." });
                setTimeout(() => {
                    navigate(formData.role === "teacher" ? "/teacher-login" : "/student-login");
                }, 2000);
            } else {
                setNotification({ type: "error", message: res.data.message || "Registration failed." });
            }
        } catch (err) {
            console.error("Registration full error object:", err);
            const msg = err.response?.data?.message || err.message || "Registration failed. Please check if server is running.";
            setNotification({ type: "error", message: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            {notification && <Notification {...notification} />}
            <Card className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
                    <p className="text-gray-400">Join LearnLens and start monitoring</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                        <select
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                            <option value="teacher">Teacher</option>
                            <option value="student">Student</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                        <input
                            type="text"
                            name="name"
                            required
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            placeholder=""
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                        <input
                            type="email"
                            name="email"
                            required
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            placeholder=""
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                required
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                placeholder=""
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                    >
                        {loading ? "Creating Account..." : "Sign Up"}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-400">
                    Already have an account? <Link to="/teacher-login" className="text-blue-400 hover:text-blue-300 font-medium">Log in</Link>
                </p>
            </Card>
        </div>
    );
};

export default Register;
