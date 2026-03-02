import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/AuthContext';
import { useMediaStream } from '../hooks/useMediaStream';
import { useSocketSession } from '../hooks/useSocketSession';
import { useLocation, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import api from '../services/api';

const StudentMonitor = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const roomCode = (params.get("room") || "").trim().toUpperCase();

    const [attentionLevel, setAttentionLevel] = useState(100);
    const [statusMessage, setStatusMessage] = useState("Initializing...");
    const [isWarning, setIsWarning] = useState(false);
    const [teacherStream, setTeacherStream] = useState(null);
    const [endBanner, setEndBanner] = useState(null); // Non-blocking session end notification

    const pcRef = useRef(null);
    const faceMeshRef = useRef(null);
    const hiddenVideoRef = useRef(null);
    const previewVideoRef = useRef(null);
    const lastEmitRef = useRef(0);
    const attentionHistoryRef = useRef([]);
    const studentStreamRef = useRef(null);



    // 1. Media Management (Mandatory Cleanup handled by hook)
    const {
        stream: studentStream,
        hasStream: hasStudentStream,
        startStream,
        videoEnabled,
        audioEnabled,
        toggleVideo,
        toggleAudio
    } = useMediaStream();

    // 2. Socket Management (Empty dependency array optimization in hook)
    const { connected, emit, on } = useSocketSession(roomCode, user, 'student');

    const onFaceResults = useCallback((results) => {
        let score = 0;
        let status = "Not Detected";
        const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks[0];

        if (hasFace) {
            const landmarks = results.multiFaceLandmarks[0];
            score = 100;
            status = "Focused";

            const nose = landmarks[4];
            const eyeL = landmarks[33];
            const eyeR = landmarks[263];
            const dist = Math.abs(eyeR.x - eyeL.x);
            const pitch = (nose.y - (eyeL.y + eyeR.y) / 2) / dist - 0.4;

            if (pitch > 0.15) { score = 30; status = "Looking Down"; }
            else if (pitch < -0.15) { score = 50; status = "Looking Up"; }
        }

        attentionHistoryRef.current.push(score);
        if (attentionHistoryRef.current.length > 5) attentionHistoryRef.current.shift();
        const smoothed = Math.round(attentionHistoryRef.current.reduce((a, b) => a + b) / attentionHistoryRef.current.length);

        setAttentionLevel(smoothed);
        setIsWarning(smoothed < 60);

        const now = Date.now();
        if (now - lastEmitRef.current > 2000 && connected) {
            emit('attention-update', {
                userId: user.id,
                room: roomCode,
                attention: smoothed,
                status: status,
                student_name: user.name
            });
            lastEmitRef.current = now;
        }
    }, [connected, roomCode, user.id, user.name, emit]);

    const initML = useCallback(async () => {
        if (typeof window.FaceMesh === 'undefined') return;

        const faceMesh = new window.FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
        faceMesh.onResults(onFaceResults);
        await faceMesh.initialize();
        faceMeshRef.current = faceMesh;

        const loop = async () => {
            if (!faceMeshRef.current) return;
            if (hiddenVideoRef.current && hiddenVideoRef.current.readyState >= 2) {
                try {
                    await faceMesh.send({ image: hiddenVideoRef.current });
                } catch (e) {
                    console.error("ML processing failed:", e);
                }
            }
            setTimeout(loop, 500); // Reduced from 2000ms for smoother tracking
        };
        loop();
    }, [onFaceResults]);

    const tracksAddedRef = useRef(false);

    // Sync local studentStream to Ref and Video Elements
    useEffect(() => {
        if (hasStudentStream && studentStream) {
            studentStreamRef.current = studentStream;
            [hiddenVideoRef, previewVideoRef].forEach(vRef => {
                if (vRef.current && vRef.current.srcObject !== studentStream) {
                    vRef.current.srcObject = studentStream;
                }
            });

            if (pcRef.current && !tracksAddedRef.current) {
                console.log("Adding student tracks to existing PC...");
                studentStream.getTracks().forEach(track => {
                    pcRef.current.addTrack(track, studentStream);
                });
                tracksAddedRef.current = true;
            }
        }
    }, [hasStudentStream, studentStream]);

    useEffect(() => {
        if (!user || !roomCode) {
            navigate('/student-dashboard');
            return;
        }

        const init = async () => {
            try {
                const res = await api.get(`/api/validate_room?code=${roomCode}`);
                if (!res.data.valid) {
                    setStatusMessage(res.data.message || "Invalid Session");
                    setTimeout(() => navigate('/student-dashboard'), 3000);
                    return;
                }

                if (!studentStreamRef.current) {
                    const stream = await startStream();
                    if (stream && hiddenVideoRef.current) {
                        hiddenVideoRef.current.srcObject = stream;
                    }
                }

                if (connected) {
                    setStatusMessage("Connected to Live Class");
                    initML();
                } else {
                    setStatusMessage("Connecting to Socket...");
                }
            } catch (err) {
                console.error("Monitor Init Error:", err);
                setStatusMessage("Join Error");
            }
        };

        if (connected) init();
    }, [connected, roomCode, user, navigate, startStream, initML]);

    useEffect(() => {
        if (!connected) return;

        on('room_joined', () => setStatusMessage("Connected to Live Class"));
        on('teacher_joined', (data) => setStatusMessage(`Teacher ${data.teacher_name} Joined`));
        on('join_denied', (data) => {
            setStatusMessage(data.message || "Join Denied");
            setTimeout(() => navigate('/student-dashboard'), 3000);
        });

        on('teacher_offer', async (data) => {
            if (pcRef.current) {
                pcRef.current.close();
                tracksAddedRef.current = false;
            }
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            pcRef.current = pc;
            pc.ontrack = (event) => setTeacherStream(event.streams[0]);
            if (studentStreamRef.current) {
                studentStreamRef.current.getTracks().forEach(track => pc.addTrack(track, studentStreamRef.current));
                tracksAddedRef.current = true;
            }
            pc.onicecandidate = (event) => {
                if (event.candidate) emit('ice_candidate', { room: roomCode, student_id: user.id, candidate: event.candidate });
            };
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                emit('student_answer', { room: roomCode, student_id: user.id, answer: answer });
            } catch (err) { console.error("Error creating student answer:", err); }
        });

        on('ice_candidate', async (data) => {
            if (pcRef.current && data.candidate) {
                try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); }
                catch (err) { console.error("Error adding ice candidate:", err); }
            }
        });

        const handleClassEnded = () => {
            setEndBanner("Class has ended. Redirecting...");
            setTimeout(() => navigate('/student-dashboard'), 3000);
        };
        on('class_ended', handleClassEnded);
        on('session_ended', handleClassEnded);
        on('kicked', () => {
            setEndBanner("You have been removed from this session.");
            setTimeout(() => navigate('/student-dashboard'), 3000);
        });

        return () => { if (pcRef.current) pcRef.current.close(); };
    }, [connected, emit, navigate, on, roomCode, user.id, user.name]);

    return (
        <div className="fixed inset-0 bg-[#0b1120] text-white flex flex-col z-[100] animate-fade-in">

            {/* Session End Banner */}
            {endBanner && (
                <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30 mb-2">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">{endBanner}</h2>
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
            )}

            {/* Minimal Student Header */}
            <header className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{statusMessage}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">My Attention</span>
                        <span className={`text-xs font-black ${isWarning ? 'text-red-400' : 'text-blue-400'}`}>{attentionLevel}%</span>
                    </div>
                </div>
            </header>

            {/* Immersive Main Area */}
            <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden">
                {/* Large Teacher Video */}
                <div className="flex-1 bg-black rounded-3xl overflow-hidden relative shadow-2xl border border-white/5 ring-1 ring-white/10 group">
                    <TeacherVideo stream={teacherStream} />

                    {/* Floating PIP Local Feed */}
                    <div className="absolute bottom-6 right-6 w-48 lg:w-64 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-2 ring-black/50 z-20 group-hover:scale-105 transition-transform duration-500">
                        <video
                            ref={previewVideoRef}
                            autoPlay playsInline muted
                            className={`w-full h-full object-cover scale-x-[-1] ${!videoEnabled ? 'hidden' : ''}`}
                        />
                        {!videoEnabled && (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 space-y-2">
                                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-600">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                                </div>
                                <span className="text-[8px] font-black uppercase text-slate-500">Camera Hidden</span>
                            </div>
                        )}
                        <div className="absolute top-2 left-2 bg-black/40 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white tracking-widest border border-white/5">Preview</div>
                    </div>

                    {!teacherStream && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-900/80 backdrop-blur-md">
                            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                            <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Waiting for Teacher Stream...</p>
                        </div>
                    )}
                </div>

                {/* Right Side Stats Panel (Optional/Removable for ultra-clean look) */}
                <aside className="lg:w-80 flex flex-col gap-4">
                    <Card className="bg-slate-900/50 border-slate-800 p-6 flex-1 flex flex-col items-center justify-center text-center space-y-6">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Analysis</h3>

                        <div className="relative w-32 h-32">
                            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                <circle cx="18" cy="18" r="16" fill="none" className="text-slate-800" stroke="currentColor" strokeWidth="2" />
                                <circle cx="18" cy="18" r="16" fill="none"
                                    className={`${isWarning ? 'text-red-500' : 'text-blue-500'} transition-all duration-1000`}
                                    stroke="currentColor" strokeWidth="2"
                                    strokeDasharray={`${attentionLevel}, 100`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-3xl font-black">{attentionLevel}%</span>
                            </div>
                        </div>

                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border transition-all ${isWarning ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                            {isWarning ? 'Low Attention' : 'Focused'}
                        </div>
                    </Card>

                    <Card className="bg-blue-600 border-transparent p-6 text-white text-center shadow-blue-600/20 shadow-2xl">
                        <h4 className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Class Tip</h4>
                        <p className="text-xs font-bold leading-relaxed">Stay looking at the teacher for the best score and optimal learning!</p>
                    </Card>
                </aside>
            </main>

            {/* Bottom Control Bar */}
            <footer className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center shrink-0">
                <div className="flex items-center gap-4 bg-slate-800/80 p-2 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md">
                    <ControlButton
                        onClick={toggleAudio}
                        active={audioEnabled}
                        label={audioEnabled ? 'Mic On' : 'Mic Off'}
                        icon={audioEnabled ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>}
                    />

                    <ControlButton
                        onClick={toggleVideo}
                        active={videoEnabled}
                        label={videoEnabled ? 'Video On' : 'Video Off'}
                        icon={videoEnabled ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>}
                    />

                    <div className="w-px h-8 bg-slate-700 mx-2"></div>

                    <button
                        onClick={() => {
                            if (window.confirm("Leave the class?")) {
                                emit('leave_room', { room: roomCode, role: 'student', student_id: user?.id });
                                navigate('/student-dashboard');
                            }
                        }}
                        className="bg-red-600 hover:bg-red-500 text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-red-600/20 transition-all border border-red-400/20"
                    >
                        Leave Class
                    </button>
                </div>
            </footer>

            <video ref={hiddenVideoRef} autoPlay playsInline muted className="hidden" />
        </div>
    );
};

const TeacherVideo = React.memo(({ stream }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        if (videoRef.current && stream) videoRef.current.srcObject = stream;
    }, [stream]);
    return stream ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain bg-slate-950" />
    ) : null;
});

const ControlButton = ({ onClick, active, icon, label }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-1.5 p-2.5 min-w-[72px] rounded-2xl transition-all ${active ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
    >
        {icon}
        <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{label}</span>
    </button>
);

export default StudentMonitor;
