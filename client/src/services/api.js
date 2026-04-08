import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    withCredentials: true,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add JWT token
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
}, error => {
    return Promise.reject(error);
});

// Response interceptor for global error handling and auto-token refresh
api.interceptors.response.use(
    response => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    async error => {
        const originalRequest = error.config;
        const message = error.response?.data?.message || '';

        // Handle 401 "Token has expired" and prevent infinite loops
        if (error.response?.status === 401 && (message.includes('Token has expired') || message.includes('expired')) && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');

            if (refreshToken) {
                try {
                    console.log("Token expired. Attempting to refresh...");
                    // Using axios directly to avoid the interceptor loop
                    const res = await axios.post(`${api.defaults.baseURL}/api/refresh`, {
                        refresh_token: refreshToken
                    });

                    if (res.data.success && res.data.token) {
                        const newToken = res.data.token;
                        localStorage.setItem('token', newToken);
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        console.log("Token refreshed successfully. Retrying request.");
                        return api(originalRequest);
                    }
                } catch (refreshError) {
                    console.error("Refresh token failed or expired:", refreshError);
                    
                    // Intelligent redirect: check role before clearing
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    const redirectPath = user.role === 'teacher' ? '/teacher-login' : '/student-login';
                    
                    localStorage.clear();
                    window.location.href = redirectPath;
                }
            } else {
                // No refresh token available
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const redirectPath = user.role === 'teacher' ? '/teacher-login' : '/student-login';
                
                localStorage.clear();
                window.location.href = redirectPath;
            }
        }

        let errorMessage = 'Server connection failed';
        
        if (error.response) {
            errorMessage = error.response.data?.message || `Error: ${error.response.status}`;
        } else if (error.request) {
            // Request was made but no response received
            if (error.code === 'ECONNABORTED') {
                errorMessage = 'Request timed out. Please try again.';
            } else {
                errorMessage = 'Cannot reach the server. Please ensure the backend is running.';
            }
        } else {
            errorMessage = error.message;
        }

        console.error(`API Error details:`, {
            status: error.response?.status,
            code: error.code,
            message: errorMessage,
            url: error.config?.url
        });

        if (!error.response && !originalRequest._retry) {
            // Log network errors specifically
            console.error("Network Error - Possible Backend Down:", error);
        }
        return Promise.reject(error);
    }
);

export default api;
