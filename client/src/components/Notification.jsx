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
                setTimeout(onClose, 250);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    const colors = {
        success: 'bg-emerald-500/90 text-white',
        error: 'bg-red-500/90 text-white',
        warning: 'bg-amber-500/90 text-white',
        info: 'bg-blue-500/90 text-white'
    };

    const color = colors[type] || colors.info;

    return (
        <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-250 ease-out ${visible && !exiting
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-3'
                }`}
        >
            <div className={`${color} backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg text-sm font-bold whitespace-nowrap`}>
                {message}
            </div>
        </div>
    );
};

export default Notification;
