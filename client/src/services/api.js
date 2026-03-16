import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
    baseURL: API_BASE_URL,
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

// Response interceptor for global error handling
api.interceptors.response.use(
    response => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    error => {
        const message = error.response?.data?.message || error.message || 'Server connection failed';
        console.error(`API Error details:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
            url: error.config?.url
        });

        if (!error.response) {
            console.warn(`Network Error: ${message}. This is likely a transient connection issue.`);
        }
        return Promise.reject(error);
    }
);

export default api;
