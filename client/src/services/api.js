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
                    // If refresh fails, clear all and redirect to login
                    localStorage.clear();
                    window.location.href = '/student-login';
                }
            } else {
                // No refresh token available
                localStorage.clear();
                window.location.href = '/student-login';
            }
        }

        const errorMessage = error.response?.data?.message || error.message || 'Server connection failed';
        console.error(`API Error details:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
            url: error.config?.url
        });

        if (!error.response) {
            // Only show alert for network-level errors (server down)
            // alert(`Network Error: ${errorMessage}. Check if both backend and frontend servers are running.`);
        }
        return Promise.reject(error);
    }
);

export default api;
