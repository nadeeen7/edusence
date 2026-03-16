import React from 'react';
import { API_BASE_URL } from '../config/api';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        try {
            fetch(`${API_BASE_URL}/api/log_error`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: error.toString(),
                    stack: errorInfo.componentStack
                })
            }).catch(err => console.error(err));
        } catch (e) {
            console.error(e);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', background: 'red', color: 'white', zIndex: 99999, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                    <h1>Something went wrong.</h1>
                    <pre>{this.state.error?.toString()}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
