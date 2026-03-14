const Card = ({ children, className = "" }) => {
    return (
        <div className={`bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 shadow-2xl ${className}`}>
            {children}
        </div>
    );
};

export default Card;
