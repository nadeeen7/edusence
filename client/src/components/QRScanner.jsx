import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const QRScanner = ({ onScan, onClose }) => {
    const scannerRef = useRef(null);
    const html5QrRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const startScanner = async () => {
            try {
                const html5Qr = new Html5Qrcode("qr-reader");
                html5QrRef.current = html5Qr;

                await html5Qr.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        // Extract class code from QR data
                        let code = decodedText;
                        if (code.startsWith("CLASS:")) {
                            code = code.replace("CLASS:", "").trim();
                        }
                        // Stop scanner and pass code back
                        html5Qr.stop().catch(() => {});
                        onScan(code.toUpperCase());
                    },
                    () => {} // Ignore scan failures (normal during scanning)
                );
            } catch (err) {
                console.error("QR Scanner Error:", err);
                setError("Camera access denied or not available.");
            }
        };

        startScanner();

        return () => {
            if (html5QrRef.current) {
                html5QrRef.current.stop().catch(() => {});
            }
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
            <div className="w-full max-w-sm mx-auto px-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold text-lg">Scan QR Code</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-500/20">
                    <div id="qr-reader" ref={scannerRef} className="w-full" />
                </div>

                {error && (
                    <p className="text-red-400 text-sm text-center mt-4">{error}</p>
                )}

                <p className="text-slate-500 text-xs text-center mt-4">
                    Point your camera at the teacher's QR code
                </p>
            </div>
        </div>
    );
};

export default QRScanner;
