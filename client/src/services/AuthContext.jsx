import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('token') || null);

    useEffect(() => {
        // Just in case of external changes, but usually not needed with synchronous init
        // We'll keep it empty for now or remove if possible.
    }, []);

    const login = (userData, token) => {
        // Clear ALL previous auth data to prevent stale tokens across roles
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('teacher_info');
        localStorage.removeItem('student_info');
        localStorage.removeItem('active_class_code');

        setUser(userData);
        setToken(token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        if (userData.role === 'teacher') {
            localStorage.setItem('teacher_info', JSON.stringify(userData));
        } else {
            localStorage.setItem('student_info', JSON.stringify(userData));
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.clear();
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
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
