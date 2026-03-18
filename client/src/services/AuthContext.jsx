import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Initialize state synchronously so protected routes don't flash loading/redirect
    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem('user');
            return stored && stored !== "undefined" ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const [token, setToken] = useState(() => localStorage.getItem('token') || null);
    const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refresh_token') || null);

    // Since we read entirely synchronously from local storage on mount, loading is false instantly.
    const [loading, setLoading] = useState(false);

    // Removed cross-tab storage listener as it caused unstable unmounts on same-tab storage changes

    const login = (userData, token, refresh_token) => {
        // Clear ALL previous auth data to prevent stale tokens across roles
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('teacher_info');
        localStorage.removeItem('student_info');
        localStorage.removeItem('active_class_code');

        setUser(userData);
        setToken(token);
        setRefreshToken(refresh_token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        if (refresh_token) {
            localStorage.setItem('refresh_token', refresh_token);
        }
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
    };

    return (
        <AuthContext.Provider value={{ user, token, refreshToken, loading, login, logout }}>
            {children}
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
