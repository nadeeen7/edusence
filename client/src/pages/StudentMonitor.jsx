import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/AuthContext';
import { useMediaStream } from '../hooks/useMediaStream';
import { useSocketSession } from '../hooks/useSocketSession';
import { useLocation, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import api from '../services/api';

// ─── Draggable PIP Hook ──────────────────────────────────────────────────────
const useDraggable = (initialPos = { x: 24, y: null }, containerRef) => {
    const [pos, setPos] = useState(initialPos);
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const pipRef = useRef(null);

    const getContainerBounds = () => {
        if (containerRef?.current) {
            return containerRef.current.getBoundingClientRect();
        }
        return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    };

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    const handleStart = useCallback((clientX, clientY) => {
        if (!pipRef.current) return;
        const rect = pipRef.current.getBoundingClientRect();
        dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
        setIsDragging(true);
    }, []);

    const handleMove = useCallback((clientX, clientY) => {
        if (!isDragging || !pipRef.current) return;
        const bounds = getContainerBounds();
        const pipRect = pipRef.current.getBoundingClientRect();

        const newX = clamp(clientX - bounds.left - dragOffset.current.x, 0, bounds.width - pipRect.width);
        const newY = clamp(clientY - bounds.top - dragOffset.current.y, 0, bounds.height - pipRect.height);

        setPos({ x: newX, y: newY });
    }, [isDragging]);

    const handleEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (!isDragging) return;

        const onMouseMove = (e) => { e.preventDefault(); handleMove(e.clientX, e.clientY); };
        const onTouchMove = (e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };
        const onEnd = () => handleEnd();

        window.addEventListener('mousemove', onMouseMove, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onEnd);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onEnd);
        };
    }, [isDragging, handleMove, handleEnd]);

    const onMouseDown = (e) => { e.preventDefault(); handleStart(e.clientX, e.clientY); };
    const onTouchStart = (e) => { handleStart(e.touches[0].clientX, e.touches[0].clientY); };

    return { pos, isDragging, pipRef, onMouseDown, onTouchStart };
};

// ─── Main StudentMonitor Component ───────────────────────────────────────────
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
    const [endBanner, setEndBanner] = useState(null);
    const [handRaised, setHandRaised] = useState(false);
    const [swapped, setSwapped] = useState(false); // false = teacher big, student PIP

    const pcRef = useRef(null);
    const faceMeshRef = useRef(null);
    const mlLoopRef = useRef(null);
    const hiddenVideoRef = useRef(null);
    const previewVideoRef = useRef(null);
    const mainVideoRef = useRef(null);
    const lastEmitRef = useRef(0);
    const attentionHistoryRef = useRef([]);
    const studentStreamRef = useRef(null);
    const tracksAddedRef = useRef(false);
    const mainAreaRef = useRef(null);

    // Draggable PIP
    const { pos: pipPos, isDragging, pipRef, onMouseDown: pipMouseDown, onTouchStart: pipTouchStart } = useDraggable({ x: 24, y: null }, mainAreaRef);

    // 1. Media Management
    const {
        stream: studentStream,
        hasStream: hasStudentStream,
        startStream,
        videoEnabled,
        audioEnabled,
        toggleVideo,
        toggleAudio
    } = useMediaStream();

    // 2. Socket Management
    const { connected, emit, on } = useSocketSession(roomCode, user, 'student');

    const toggleHand = () => {
        const newState = !handRaised;
        setHandRaised(newState);
        emit('raise_hand', { room: roomCode, student_id: user.id, is_raised: newState });
    };

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

        if (score === 0) {
            console.warn("Attention score is 0 - Face not detected or MediaPipe failing");
        }

        attentionHistoryRef.current.push(score);
        if (attentionHistoryRef.current.length > 5) attentionHistoryRef.current.shift();
        const smoothed = Math.round(attentionHistoryRef.current.reduce((a, b) => a + b) / attentionHistoryRef.current.length);

        setAttentionLevel(smoothed);
        setIsWarning(smoothed < 60);

        const now = Date.now();
        if (now - lastEmitRef.current > 2000 && connected) {
            console.log(`[ML] Emitting focus data: ${smoothed}% (${status})`);
            emit('attention-update', {
                userId: user.id,
                student_id: user.id,
                room: roomCode,
                attention: smoothed,
                status: status,
                student_name: user?.name
            });
            lastEmitRef.current = now;
        }
    }, [connected, roomCode, user, emit]);

    const initML = useCallback(async () => {
        if (faceMeshRef.current || mlLoopRef.current) return;

        const waitForFaceMesh = async (timeoutMs = 15000) => {
            const startedAt = Date.now();
            while (typeof window.FaceMesh === 'undefined') {
                if (Date.now() - startedAt > timeoutMs) return false;
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
            return true;
        };

        const loaded = await waitForFaceMesh();
        if (!loaded) {
            console.warn("Attention model unavailable");
            return;
        }

        const faceMesh = new window.FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
        faceMesh.onResults(onFaceResults);
        await faceMesh.initialize();
        faceMeshRef.current = faceMesh;

        mlLoopRef.current = window.setInterval(async () => {
            if (!faceMeshRef.current || !hiddenVideoRef.current) return;

            const vid = hiddenVideoRef.current;
            if (vid.readyState >= 2) {
                try {
                    if (Math.random() < 0.1) {
                        console.log(`[ML] Frame Check: ${vid.videoWidth}x${vid.videoHeight}, ready=${vid.readyState}`);
                    }
                    await faceMesh.send({ image: vid });
                } catch (e) {
                    console.error("ML processing failed:", e);
                }
            } else {
                if (vid.paused) vid.play().catch(() => { });
            }
        }, 500);
    }, [onFaceResults]);

    // Sync local studentStream to Ref and Video Elements (re-runs on swap)
    useEffect(() => {
        if (hasStudentStream && studentStream) {
            studentStreamRef.current = studentStream;

            // Always keep hidden video fed for ML processing
            if (hiddenVideoRef.current && hiddenVideoRef.current.srcObject !== studentStream) {
                hiddenVideoRef.current.srcObject = studentStream;
            }

            // Attach student stream to the correct video element based on swap state
            if (swapped) {
                // Student camera is big → mainVideoRef
                if (mainVideoRef.current) {
                    mainVideoRef.current.srcObject = studentStream;
                    mainVideoRef.current.play().catch(() => { });
                }
            } else {
                // Student camera is PIP → previewVideoRef
                if (previewVideoRef.current) {
                    previewVideoRef.current.srcObject = studentStream;
                    previewVideoRef.current.play().catch(() => { });
                }
            }

            if (pcRef.current && !tracksAddedRef.current) {
                console.log("Adding student tracks to existing PC (Post-Stream Load)...");
                studentStream.getTracks().forEach(track => {
                    pcRef.current.addTrack(track, studentStream);
                });
                tracksAddedRef.current = true;
            }
        }
    }, [hasStudentStream, studentStream, swapped]);

    // Initial media setup
    useEffect(() => {
        if (!studentStreamRef.current) {
            console.log("Starting camera on mount...");
            startStream();
        }
    }, [startStream]);

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

        init();
    }, [connected, roomCode, user, navigate, initML]);

    useEffect(() => {
        if (!connected) return;

        on('room_joined', () => setStatusMessage("Connected to Live Class"));
        on('teacher_joined', (data) => setStatusMessage(`Teacher ${data.teacher_name} Joined`));
        on('join_denied', (data) => {
            setStatusMessage(data.message || "Join Denied");
            setTimeout(() => navigate('/student-dashboard'), 3000);
        });

        on('teacher_offer', async (data) => {
            console.log("Teacher offer received, creating student answer...");
            if (pcRef.current) {
                pcRef.current.close();
                tracksAddedRef.current = false;
            }
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            pcRef.current = pc;

            pc.ontrack = (event) => {
                console.log("Student received teacher track");
                setTeacherStream(event.streams[0]);
            };

            if (studentStreamRef.current) {
                console.log("Adding local tracks to PC during handshake");
                studentStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, studentStreamRef.current);
                });
                tracksAddedRef.current = true;
            } else {
                console.error("No student stream available for handshake!");
            }

            pc.onicecandidate = (event) => {
                if (event.candidate) emit('ice_candidate', { room: roomCode, student_id: user.id, candidate: event.candidate });
            };
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                emit('student_answer', { room: roomCode, student_id: user.id, answer: answer });
                console.log("Student answer sent to teacher");
            } catch (err) {
                console.error("Error creating student answer:", err);
            }
        });

        on('ice_candidate', async (data) => {
            if (pcRef.current && data.candidate) {
                try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); }
                catch (err) { console.error("Error adding ice candidate:", err); }
            }
        });

        const handleClassEnded = () => {
            console.log("Class ended notification received");
            setEndBanner("Class has ended. Redirecting...");
            setTimeout(() => {
                navigate('/student-dashboard');
            }, 3000);
        };
        on('class_ended', handleClassEnded);
        on('kicked', () => {
            setEndBanner("You have been removed from this session.");
            setTimeout(() => navigate('/student-dashboard'), 3000);
        });

        return () => { if (pcRef.current) pcRef.current.close(); };
    }, [connected, emit, navigate, on, roomCode, user.id, user.name]);

    useEffect(() => {
        return () => {
            console.log("Cleaning up StudentMonitor - stopping ML loop and FaceMesh");
            if (mlLoopRef.current) {
                clearInterval(mlLoopRef.current);
                mlLoopRef.current = null;
            }
            if (faceMeshRef.current) {
                faceMeshRef.current = null;
            }
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
        };
    }, []);

    // Compute PIP style (defaults to bottom-left when no y is set)
    const pipStyle = pipPos.y !== null
        ? { position: 'absolute', left: pipPos.x, top: pipPos.y, zIndex: 30 }
        : { position: 'absolute', left: pipPos.x, bottom: 24, zIndex: 30 };

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
                <div className="text-[10px] font-medium text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
                    ID: {user?.id}
                </div>
            </header>

            {/* Immersive Main Area */}
            <main ref={mainAreaRef} className="flex-1 flex p-4 gap-4 overflow-hidden relative">
                {/* Large Video Area */}
                <div className="flex-1 bg-black rounded-3xl overflow-hidden relative shadow-2xl border border-white/5 ring-1 ring-white/10 group">
                    {swapped ? (
                        /* Student Camera is Big */
                        <>
                            <video
                                ref={mainVideoRef}
                                autoPlay playsInline muted
                                className={`w-full h-full object-contain bg-slate-950 scale-x-[-1] ${!videoEnabled ? 'hidden' : ''}`}
                            />
                            {!videoEnabled && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                        <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                    </div>
                                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Camera Off</span>
                                </div>
                            )}
                            <div className="absolute top-3 right-3 bg-purple-600/90 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg text-white border border-white/10 shadow-lg">Your Camera</div>
                        </>
                    ) : (
                        /* Teacher Video is Big (default) */
                        <>
                            <TeacherVideo stream={teacherStream} />
                            {!teacherStream && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-900/80 backdrop-blur-md">
                                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Waiting for Teacher Stream...</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Draggable PIP */}
                <div
                    ref={pipRef}
                    style={pipStyle}
                    onMouseDown={pipMouseDown}
                    onTouchStart={pipTouchStart}
                    className={`w-48 lg:w-64 aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-2 ring-black/50 transition-shadow duration-300 select-none ${isDragging ? 'shadow-blue-500/30 ring-blue-500/50 cursor-grabbing scale-105' : 'cursor-grab hover:shadow-xl hover:ring-white/20'}`}
                >
                    {swapped ? (
                        /* Teacher is PIP when swapped */
                        <>
                            <PipTeacherVideo stream={teacherStream} />
                            {!teacherStream && (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 space-y-1">
                                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                    <span className="text-[7px] font-black uppercase text-slate-500">Waiting...</span>
                                </div>
                            )}
                            <div className="absolute top-2 left-2 bg-black/50 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white tracking-widest border border-white/5">Teacher</div>
                        </>
                    ) : (
                        /* Student Camera is PIP (default) */
                        <>
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
                            <div className="absolute top-2 left-2 bg-black/40 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white tracking-widest border border-white/5">You</div>
                        </>
                    )}

                    {/* Drag Handle Indicator */}
                    <div className="absolute bottom-1.5 right-1.5 flex gap-0.5 opacity-40 pointer-events-none">
                        <div className="w-1 h-1 rounded-full bg-white"></div>
                        <div className="w-1 h-1 rounded-full bg-white"></div>
                        <div className="w-1 h-1 rounded-full bg-white"></div>
                    </div>
                    <div className="absolute bottom-3.5 right-1.5 flex gap-0.5 opacity-40 pointer-events-none">
                        <div className="w-1 h-1 rounded-full bg-white"></div>
                        <div className="w-1 h-1 rounded-full bg-white"></div>
                        <div className="w-1 h-1 rounded-full bg-white"></div>
                    </div>
                </div>
            </main>

            {/* Bottom Control Bar — Google Meet Style */}
            <footer className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center shrink-0">
                <div className="flex items-center gap-4 bg-slate-800/80 p-2 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md">
                    <ControlButton
                        onClick={toggleAudio}
                        active={audioEnabled}
                        label={audioEnabled ? 'Mic On' : 'Mic Off'}
                        icon={audioEnabled ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 1v3m0 18v3m8.5-12.5h-3m-13 0h-3m15.89-6.39l-2.12 2.12m-10.77 10.77l-2.12 2.12m10.77-10.77l2.12 2.12M6.34 6.34l-2.12 2.12"></path></svg>}
                    />

                    <ControlButton
                        onClick={toggleVideo}
                        active={videoEnabled}
                        label={videoEnabled ? 'Video On' : 'Video Off'}
                        icon={videoEnabled ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>}
                    />

                    <ControlButton
                        onClick={toggleHand}
                        active={handRaised}
                        label={handRaised ? 'Hand Up' : 'Raise Hand'}
                        icon={<svg className={`w-5 h-5 ${handRaised ? 'text-yellow-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0V12m3 .5V15m0-2.5v-6a1.5 1.5 0 113 0V12m3 .5V15m0-2.5v-6a1.5 1.5 0 113 0V12m-12 0H3a2 2 0 00-2 2v2a2 2 0 002 2h2m13-6h2a2 2 0 012 2v2a2 2 0 01-2 2h-2m-9 4a5 5 0 01-5-5"></path></svg>}
                    />

                    {/* Swap Layout Button */}
                    <ControlButton
                        onClick={() => setSwapped(s => !s)}
                        active={true}
                        label="Swap View"
                        icon={
                            <svg className={`w-5 h-5 transition-transform ${swapped ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                        }
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
                        End Class
                    </button>
                </div>
            </footer>

            {/* Hidden Video for ML processing */}
            <video
                ref={hiddenVideoRef}
                autoPlay
                playsInline
                muted
                className="opacity-0 pointer-events-none absolute left-0 top-0 z-[-1]"
                style={{
                    visibility: 'visible',
                    width: '160px',
                    height: '120px',
                    position: 'fixed'
                }}
            />
        </div>
    );
};

// ─── Sub-Components ──────────────────────────────────────────────────────────

const TeacherVideo = React.memo(({ stream }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        if (videoRef.current && stream) videoRef.current.srcObject = stream;
    }, [stream]);
    return stream ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain bg-slate-950" />
    ) : null;
});

const PipTeacherVideo = React.memo(({ stream }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        if (videoRef.current && stream) videoRef.current.srcObject = stream;
    }, [stream]);
    return stream ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover bg-slate-950" />
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
