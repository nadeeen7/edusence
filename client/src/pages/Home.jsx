import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../services/AuthContext";
import Card from "../components/Card";

const Home = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-12">
            <div className="space-y-6 max-w-3xl">
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
                    LearnLens: <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Focus, made visible.</span>
                </h1>
                <p className="text-xl text-gray-400">
                    Real-time student engagement tracking using computer vision, WebRTC, and professional analytics.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
                <Card className="hover:border-blue-500/50 transition-colors group">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">For Teachers</h2>
                        <p className="text-gray-400">Monitor student attention in real-time and manage your virtual classrooms effectively.</p>
                        <div className="flex gap-4 pt-4">
                            <Link to="/teacher-login" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-center transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                                Login
                            </Link>
                            <Link to="/register" className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg text-center border border-gray-600 hover:border-gray-500 transition-all">
                                Register
                            </Link>
                        </div>
                    </div>
                </Card>

                <Card className="hover:border-purple-500/50 transition-colors group">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">For Students</h2>
                        <p className="text-gray-400">Join a class session and let the AI assist you in maintaining focus during lectures.</p>
                        <div className="flex gap-4 pt-4">
                            <Link to="/student-login" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-center transition-all shadow-[0_0_15px_rgba(147,51,234,0.4)]">
                                Join Classroom
                            </Link>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Home;
