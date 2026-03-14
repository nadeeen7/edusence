import { useEffect, useState } from 'react';

const Notification = ({ type, message, onClose }) => {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (message) {
            setVisible(true);
            setExiting(false);
        }
    }, [message]);

    useEffect(() => {
        if (message && onClose) {
            const timer = setTimeout(() => {
                setExiting(true);
                setTimeout(onClose, 300);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    const styles = {
        success: {
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            text: 'text-emerald-400',
            glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
            icon: (
                <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        error: {
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            text: 'text-red-400',
            glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
            icon: (
                <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        warning: {
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            text: 'text-amber-400',
            glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
            icon: (
                <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            )
        },
        info: {
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            text: 'text-blue-400',
            glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
            icon: (
                <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        }
    };

    const style = styles[type] || styles.info;

    return (
        <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${visible && !exiting
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 -translate-y-4 scale-95'
                }`}
        >
            <div className={`flex items-center ${style.bg} ${style.border} ${style.text} ${style.glow} border backdrop-blur-xl px-6 py-4 rounded-2xl min-w-[320px] max-w-md shadow-2xl animate-in fade-in zoom-in duration-300`}>
                <div className="flex-shrink-0">
                    {style.icon}
                </div>
                <div className="flex-1 text-sm font-semibold tracking-wide">
                    {message}
                </div>
                <button
                    onClick={() => { setExiting(true); setTimeout(onClose, 300); }}
                    className="ml-4 p-1 hover:bg-white/5 rounded-full transition-colors opacity-60 hover:opacity-100"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Notification;
