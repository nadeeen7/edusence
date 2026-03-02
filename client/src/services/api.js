import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    withCredentials: true,
    timeout: 10000,
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

// Response interceptor for global error handling
api.interceptors.response.use(
    response => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    error => {
        const message = error.response?.data?.message || 'Server connection failed';
        console.error(`API Error: ${message}`, error);

        // You could trigger a global toast/notification here
        if (error.response?.status === 401) {
            // Handle unauthorized (redirect to login)
            // window.location.href = '/';
        }

        return Promise.reject(error);
    }
);

export default api;
