import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScanner = ({ onScanSuccess, onScanError }) => {
    const [facingMode, setFacingMode] = useState("user");
    const [isStopping, setIsStopping] = useState(false);
    // Use a unique ID for each instance to prevent multiple cameras in the same DOM element
    const [scannerId] = useState(() => `qr-reader-${Math.random().toString(36).substr(2, 9)}`);
    const html5QrCodeRef = useRef(null);

    const stopScanner = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            try {
                setIsStopping(true);
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
                setIsStopping(false);
            } catch (err) {
                console.error("Error stopping scanner:", err);
                setIsStopping(false);
            }
        }
    };

    const startScanner = useCallback(async (mode) => {
        try {
            await stopScanner();
            
            // Re-check if element exists (might have unmounted)
            const container = document.getElementById(scannerId);
            if (!container) return;
            container.innerHTML = "";

            const html5QrCode = new Html5Qrcode(scannerId);
            html5QrCodeRef.current = html5QrCode;

            const config = { 
                fps: 15, 
                aspectRatio: 1.0
            };

            await html5QrCode.start(
                { facingMode: mode },
                config,
                (decodedText, decodedResult) => {
                    onScanSuccess(decodedText, decodedResult);
                },
                (errorMessage) => {
                    // Ignore transient errors
                }
            );
        } catch (err) {
            console.error("Scanner Start Error:", err);
        }
    }, [onScanSuccess, scannerId]);

    const toggleCamera = async () => {
        if (isStopping) return;
        const newMode = facingMode === "user" ? "environment" : "user";
        setFacingMode(newMode);
        await startScanner(newMode);
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => startScanner(facingMode), 100);
        return () => {
            clearTimeout(timeoutId);
            if (html5QrCodeRef.current) {
                html5QrCodeRef.current.stop()
                    .then(() => {
                        const container = document.getElementById(scannerId);
                        if (container) container.innerHTML = "";
                    })
                    .catch(e => console.error("Cleanup Error", e));
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="relative bg-[#020617] rounded-[2rem] overflow-hidden border border-purple-500/40 shadow-[0_0_50px_rgba(168,85,247,0.2)] animate-fade-in mb-6">
            {/* Unique scanner container */}
            <div id={scannerId} className="w-full aspect-square bg-black"></div>
            
            {/* Camera Toggle Button */}
            <button
                type="button"
                onClick={toggleCamera}
                disabled={isStopping}
                className="absolute top-4 right-4 z-40 p-4 bg-purple-600/95 backdrop-blur-2xl border border-white/30 rounded-full text-white hover:bg-purple-500 hover:scale-110 active:scale-90 transition-all shadow-2xl disabled:opacity-50"
                title="Switch Camera"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            </button>

            {/* Custom Scanning Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="w-72 h-72 relative">
                    <div className="absolute top-0 left-0 w-14 h-14 border-t-4 border-l-4 border-purple-500 rounded-tl-3xl shadow-[-5px_-5px_15px_rgba(168,85,247,0.3)]"></div>
                    <div className="absolute top-0 right-0 w-14 h-14 border-t-4 border-r-4 border-purple-500 rounded-tr-3xl shadow-[5px_-5px_15px_rgba(168,85,247,0.3)]"></div>
                    <div className="absolute bottom-0 left-0 w-14 h-14 border-b-4 border-l-4 border-purple-500 rounded-bl-3xl shadow-[-5px_5px_15px_rgba(168,85,247,0.3)]"></div>
                    <div className="absolute bottom-0 right-0 w-14 h-14 border-b-4 border-r-4 border-purple-500 rounded-br-3xl shadow-[5px_5px_15px_rgba(168,85,247,0.3)]"></div>
                    
                    {/* Scanning line animation */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-[scan_2.5s_ease-in-out_infinite] shadow-[0_0_15px_rgba(168,85,247,0.8)]"></div>
                </div>
            </div>

            <div className="p-6 bg-slate-950/95 border-t border-purple-500/30 text-center relative z-20 backdrop-blur-xl">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping"></div>
                    <p className="text-sm font-black text-white uppercase tracking-[0.3em]">
                        {facingMode === "user" ? "Front" : "Rear"} Camera
                    </p>
                </div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Fast Scan Active</p>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes scan {
                    0%, 100% { top: 5%; opacity: 0.5; }
                    50% { top: 95%; opacity: 1; }
                }
                #${scannerId} video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                    border-radius: 2rem !important;
                }
            `}} />
        </div>
    );
};

export default QRScanner;
