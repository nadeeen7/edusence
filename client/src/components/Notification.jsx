import { useEffect } from 'react';

const Notification = ({ type, message, onClose }) => {
    useEffect(() => {
        if (message && onClose) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    return (
        <div className={`fixed top-20 right-4 z-[200] p-4 rounded-xl backdrop-blur-md border shadow-2xl max-w-sm text-sm transition-all animate-slide-in ${type === "success"
            ? "bg-green-500/10 border-green-500/30 text-green-300 shadow-[0_4px_30px_rgba(34,197,94,0.1)]"
            : "bg-red-500/10 border-red-500/30 text-red-300 shadow-[0_4px_30px_rgba(239,68,68,0.1)]"
            }`}>
            <div className="flex items-center gap-3">
                {type === "success" ? (
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
                <p className="font-medium">{message}</p>
            </div>
        </div>
    );
};

export default Notification;
