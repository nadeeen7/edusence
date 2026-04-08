import React from 'react';

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
            fetch('http://localhost:5000/api/log_error', {
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
                <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mb-8">
                        <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-4">Something went wrong</h1>
                    <p className="text-slate-400 max-w-md mb-8">
                        The application encountered an unexpected error. We've logged the details and our team will look into it.
                    </p>
                    <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl mb-8 w-full max-w-2xl overflow-auto text-left">
                        <pre className="text-pink-500 font-mono text-xs">
                            {this.state.error?.toString()}
                        </pre>
                    </div>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                    >
                        Return to Home
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
