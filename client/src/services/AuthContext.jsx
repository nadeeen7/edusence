import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Initialize state synchronously so protected routes don't flash loading/redirect
    const [user, setUser] = useState(() => {
        try {
            const storedUser = localStorage.getItem('user');
            const token = localStorage.getItem('token');
            // Only consider authenticated if BOTH user and token exist
            if (storedUser && token && storedUser !== "undefined") {
                return JSON.parse(storedUser);
            }
            return null;
        } catch (error) {
            console.error("Auth initialization error:", error);
            return null;
        }
    });

    const [token, setToken] = useState(() => localStorage.getItem('token') || null);
    const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token') || null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // This ensures any complex initialization (like potential token validation)
        // is accounted for. For now, it just signals that we've read from storage.
        setLoading(false);
    }, []);

    const login = (userData, token, refresh_token) => {
        // Clear all session specific data first
        localStorage.clear();

        setUser(userData);
        setToken(token);
        setRefreshToken(refresh_token);

        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        if (refresh_token) {
            localStorage.setItem('refresh_token', refresh_token);
        }
        
        // Store role-specific info for easy access
        if (userData.role === 'teacher') {
            localStorage.setItem('teacher_info', JSON.stringify(userData));
        } else {
            localStorage.setItem('student_info', JSON.stringify(userData));
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setRefreshToken(null);
        localStorage.clear();
        // Force removal of cookies if any (extra security)
        document.cookie.split(";").forEach((c) => {
            document.cookie = c
                .replace(/^ +/, "")
                .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            token, 
            refreshToken, 
            loading, 
            login, 
            logout,
            isAuthenticated: !!user && !!token 
        }}>
            {loading ? (
                <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-sm font-black uppercase tracking-[0.3em] text-white">LearnLens</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 animate-pulse">Initializing Secure Session...</span>
                    </div>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
