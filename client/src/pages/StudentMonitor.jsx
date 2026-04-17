import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../services/AuthContext';
import { useMediaStream } from '../hooks/useMediaStream';
import { useSocketSession } from '../hooks/useSocketSession';
import { useLocation, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Notification from '../components/Notification';
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
    const roomCode = (params.get("room") || localStorage.getItem("active_class_code") || "").trim().toUpperCase();

    const [attentionLevel, setAttentionLevel] = useState(100);
    const [statusMessage, setStatusMessage] = useState("Initializing...");
    const [isWarning, setIsWarning] = useState(false);
    const [teacherStream, setTeacherStream] = useState(null);
    const [endBanner, setEndBanner] = useState(null);
    const [handRaised, setHandRaised] = useState(false);
    const [swapped, setSwapped] = useState(false); // false = teacher big, student PIP
    const [notification, setNotification] = useState(null);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenStream, setScreenStream] = useState(null);

    const pcRef = useRef(null);
    const screenPcRef = useRef(null);
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
    const eyesClosedStartRef = useRef(null);
    const lookingDownStartRef = useRef(null);
    const prevNoseRef = useRef(null);
    const faceLossStartRef = useRef(null);


    // Draggable PIP - Update initial position for mobile
    const { pos: pipPos, isDragging, pipRef, onMouseDown: pipMouseDown, onTouchStart: pipTouchStart } = useDraggable({ x: 16, y: 16 }, mainAreaRef);

    // 1. Media Management
    const {
        stream: studentStream,
        hasStream: hasStudentStream,
        error: mediaError,
        startStream,
        videoEnabled,
        audioEnabled,
        toggleVideo,
        toggleAudio,
        clearError
    } = useMediaStream();

    // 2. Socket Management
    // Delay joining until we at least tried to get media (prevents track-less PC)
    const activeRoomCode = (hasStudentStream || mediaError) ? roomCode : null;
    const { connected, emit, on, socket } = useSocketSession(activeRoomCode, user, 'student');

    const videoEnabledRef = useRef(videoEnabled);

    useEffect(() => {
        videoEnabledRef.current = videoEnabled;
    }, [videoEnabled]);

    const toggleHand = () => {
        const newState = !handRaised;
        setHandRaised(newState);
        emit('raise_hand', { room: roomCode, student_id: user?.id, is_raised: newState });
    };

    const handleToggleVideo = useCallback(() => {
        const newState = toggleVideo();
        emit('media_state_change', {
            room: roomCode,
            student_id: user?.id,
            videoEnabled: newState,
            audioEnabled: audioEnabled
        });
    }, [toggleVideo, audioEnabled, emit, roomCode, user?.id]);

    const handleToggleAudio = useCallback(() => {
        const newState = toggleAudio();
        emit('media_state_change', {
            room: roomCode,
            student_id: user?.id,
            videoEnabled: videoEnabled,
            audioEnabled: newState
        });
    }, [toggleAudio, videoEnabled, emit, roomCode, user?.id]);

    const onFaceResults = useCallback((results) => {
        const now = Date.now();
        const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks[0];

        // 1. Handle Face Loss (Gradual decay)
        if (!hasFace) {
            if (!faceLossStartRef.current) faceLossStartRef.current = now;
            
            const lastScore = attentionHistoryRef.current.length > 0 ? attentionHistoryRef.current[attentionHistoryRef.current.length - 1] : 0;
            const decayedScore = Math.max(0, lastScore - 8); // Decay by ~8% per 300ms
            attentionHistoryRef.current.push(decayedScore);
            if (attentionHistoryRef.current.length > 20) attentionHistoryRef.current.shift();
            
            const smoothed = Math.round(attentionHistoryRef.current.reduce((a, b) => a + b) / attentionHistoryRef.current.length);
            setAttentionLevel(smoothed);
            
            if (now - lastEmitRef.current > 2000 && connected) {
                emit('attention-update', {
                    userId: user?.id, room: roomCode, attention: smoothed, status: "Not Detected"
                });
                lastEmitRef.current = now;
            }
            return;
        }

        faceLossStartRef.current = null;
        const landmarks = results.multiFaceLandmarks[0];

        // --- STRICT WEIGHTED SCORING MODEL (30/30/30/10) ---
        let faceScore = 30;     
        let eyeScore = 0;       
        let headScore = 0;      
        let stabilityScore = 0; 
        let status = "Focused";

        // 2. Head Pose (30pt) - STRICT
        const nose = landmarks[4];
        const eyeLCenter = landmarks[468] || landmarks[133];
        const eyeRCenter = landmarks[473] || landmarks[362];
        const dist = Math.sqrt(Math.pow(eyeRCenter.x - eyeLCenter.x, 2) + Math.pow(eyeRCenter.y - eyeLCenter.y, 2));
        const midEyes = { x: (eyeLCenter.x + eyeRCenter.x) / 2, y: (eyeLCenter.y + eyeRCenter.y) / 2 };
        
        const yaw = Math.abs((nose.x - midEyes.x) / dist);
        const pitch = Math.abs((nose.y - midEyes.y) / dist - 0.35); 
        
        if (yaw < 0.22 && pitch < 0.22) {
            headScore = 30 - (yaw * 70 + pitch * 70); 
            headScore = Math.max(0, headScore);
        } else {
            headScore = 0;
            status = yaw > 0.22 ? "Looking Sideways" : "Looking Away";
        }

        // 3. Eye Gaze (30pt) - STRICT
        if (landmarks.length > 473) {
            const irisR = landmarks[468]; 
            const irisL = landmarks[473];
            const eyeWidthR = Math.max(0.005, Math.abs(landmarks[133].x - landmarks[33].x));
            const eyeWidthL = Math.max(0.005, Math.abs(landmarks[263].x - landmarks[362].x));

            const gazeH = ((irisR.x - landmarks[33].x) / eyeWidthR + (irisL.x - landmarks[362].x) / eyeWidthL) / 2;
            const gazeV = ((irisR.y - landmarks[159].y) / Math.abs(landmarks[145].y - landmarks[159].y) + 
                           (irisL.y - landmarks[386].y) / Math.abs(landmarks[374].y - landmarks[386].y)) / 2;
            
            const hDev = Math.abs(gazeH - 0.5);
            const vDev = Math.abs(gazeV - 0.5);
            
            if (hDev < 0.15 && vDev < 0.2) {
                eyeScore = 30 - (hDev * 100 + vDev * 100);
            } else {
                eyeScore = 0;
                if (status === "Focused") status = "Eyes Away";
            }
        }

        // 4. Stability (10pt)
        if (prevNoseRef.current) {
            const movement = Math.sqrt(Math.pow(nose.x - prevNoseRef.current.x, 2) + Math.pow(nose.y - prevNoseRef.current.y, 2));
            if (movement < 0.005) stabilityScore = 10;
            else stabilityScore = Math.max(0, 10 - movement * 2000);
        } else stabilityScore = 10;
        prevNoseRef.current = { x: nose.x, y: nose.y };

        // 5. Final Calculation
        let frameScore = faceScore + eyeScore + headScore + stabilityScore;
        
        const ear = (Math.abs(landmarks[159].y - landmarks[145].y) / Math.max(0.01, Math.abs(landmarks[33].x - landmarks[133].x)) + 
                    Math.abs(landmarks[386].y - landmarks[374].y) / Math.max(0.01, Math.abs(landmarks[362].x - landmarks[263].x))) / 2;
        if (ear < 0.16) {
            if (!eyesClosedStartRef.current) eyesClosedStartRef.current = now;
            if (now - eyesClosedStartRef.current > 1200) { frameScore *= 0.2; status = "Sleepy"; }
        } else eyesClosedStartRef.current = null;

        if (!videoEnabledRef.current) { frameScore = 0; status = "Camera Off"; }

        // 6. Smoothing
        attentionHistoryRef.current.push(frameScore);
        if (attentionHistoryRef.current.length > 20) attentionHistoryRef.current.shift();
        
        const smoothed = Math.round(attentionHistoryRef.current.reduce((a, b) => a + b) / attentionHistoryRef.current.length);
        setAttentionLevel(smoothed);
        setIsWarning(smoothed < 60);

        if (now - lastEmitRef.current > 2000 && connected) {
            emit('attention-update', {
                userId: user?.id, student_id: user?.id, room: roomCode,
                attention: smoothed, status, student_name: user?.name,
                audioEnabled, videoEnabled
            });
            lastEmitRef.current = now;
        }
    }, [connected, roomCode, user, emit, audioEnabled, videoEnabled]);

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
                    await faceMesh.send({ image: vid });
                } catch (e) {
                    console.error("ML processing failed:", e);
                }
            } else {
                if (vid.paused) vid.play().catch(() => { });
            }
        }, 300);
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
                console.log("Adding student tracks to existing PC (Stream became available later)...");
                studentStream.getTracks().forEach(track => {
                    console.log(`Adding delayed track: ${track.kind} (Enabled: ${track.enabled})`);
                    const senders = pcRef.current.getSenders();
                    const trackExists = senders.some(sender => sender.track === track);
                    if (!trackExists) {
                        pcRef.current.addTrack(track, studentStream);
                    }
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
            navigate('/student-dashboard', { replace: true });
            return;
        }

        const init = async () => {
            try {
                const res = await api.get(`/api/validate_room?code=${roomCode}`);
                if (!res.data.valid) {
                    setStatusMessage(res.data.message || "Invalid Session");
                    setTimeout(() => navigate('/student-dashboard', { replace: true }), 3000);
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

        on('room_joined', (data) => {
            setStatusMessage("Connected to Live Class");
            if (data.is_screen_sharing) {
                setIsScreenSharing(true);
                // The teacher will likely send an offer anyway, but we can also signal that we are ready
                emit('request_screen_share', { room: roomCode, studentId: user?.id, socketId: socket.id });
            }
        });
        on('teacher_joined', (data) => setStatusMessage(`Teacher ${data.teacher_name} Joined`));
        on('teacher_reconnected', () => {
            console.log("[WebRTC] Teacher reconnected. Resetting local PC to wait for fresh offer.");
            setTeacherStream(null);
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
            tracksAddedRef.current = false;
        });
        on('join_denied', (data) => {
            setStatusMessage(data.message || "Join Denied");
            setTimeout(() => navigate('/student-dashboard'), 3000);
        });

        on('teacher_offer', async (data) => {
            console.log(`[WebRTC] Received teacher offer (${roomCode}). Creating answer...`);
            if (pcRef.current) {
                console.log("[WebRTC] Closing existing PC before creating new one");
                pcRef.current.close();
            }
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ],
                iceCandidatePoolSize: 10
            });
            pcRef.current = pc;
            pc.pendingCandidates = [];

            pc.oniceconnectionstatechange = () => console.log(`[WebRTC] ICE state: ${pc.iceConnectionState}`);
            pc.onconnectionstatechange = () => console.log(`[WebRTC] Connection state: ${pc.connectionState}`);

            pc.ontrack = (event) => {
                console.log(`[WebRTC] Received teacher track: ${event.track.kind}`);
                const track = event.track;
                setTeacherStream(prev => {
                    const stream = prev || new MediaStream();
                    if (!stream.getTracks().some(t => t.id === track.id)) {
                        stream.addTrack(track);
                    }
                    return new MediaStream(stream.getTracks());
                });
            };

            if (studentStreamRef.current) {
                console.log("[WebRTC] Adding local student tracks to PC");
                studentStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, studentStreamRef.current);
                });
                tracksAddedRef.current = true;
            }

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log("[WebRTC] student generated ICE candidate");
                    emit('ice_candidate', { room: roomCode, student_id: user.id, candidate: event.candidate });
                }
            };

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                console.log("[WebRTC] Sending student answer to teacher");
                emit('student_answer', { room: roomCode, student_id: user.id, answer: answer });

                // Process any queued candidates accumulated while setting up
                if (pc.pendingCandidates.length > 0) {
                    console.log(`[WebRTC] Processing ${pc.pendingCandidates.length} queued candidates`);
                    for (const candidate of pc.pendingCandidates) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding queued candidate:", e));
                    }
                    pc.pendingCandidates = [];
                }
            } catch (err) {
                console.error("Error handling teacher offer:", err);
            }
        });

        on('ice_candidate', async (data) => {
            if (data.student_id === user?.id) return; // Ignore our own candidate if it bounced back

            const pc = pcRef.current;
            if (pc && data.candidate) {
                try {
                    if (pc.remoteDescription && pc.remoteDescription.type) {
                        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } else {
                        console.log("[WebRTC] Queuing teacher candidate (remoteDescription not ready)");
                        if (!pc.pendingCandidates) pc.pendingCandidates = [];
                        pc.pendingCandidates.push(data.candidate);
                    }
                } catch (err) {
                    console.error("Error adding ice candidate from teacher:", err);
                }
            }
        });

        // --- Screen Share Signaling ---
        on('screen_share_started', (data) => {
            setNotification({ type: 'info', message: `${data.teacher_name} started screen sharing` });
            setIsScreenSharing(true);
        });

        on('screen_share_stopped', () => {
            setIsScreenSharing(false);
            setScreenStream(null);
            if (screenPcRef.current) {
                screenPcRef.current.close();
                screenPcRef.current = null;
            }
        });

        on('screen_offer', async (data) => {
            console.log("Teacher screen offer received...");
            if (screenPcRef.current) screenPcRef.current.close();

            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            screenPcRef.current = pc;

            pc.ontrack = (event) => {
                console.log("Received screen track");
                setScreenStream(event.streams[0]);
                setIsScreenSharing(true);
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) emit('screen_ice_candidate', { room: roomCode, student_id: user.id, candidate: event.candidate });
            };

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                emit('screen_answer', { room: roomCode, student_id: user.id, answer: answer });
            } catch (err) {
                console.error("Error answering screen offer:", err);
            }
        });

        on('screen_ice_candidate', async (data) => {
            if (screenPcRef.current && data.candidate) {
                try { await screenPcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); }
                catch (err) { console.error("Error adding screen ice candidate:", err); }
            }
        });

        const handleClassEnded = () => {
            console.log("Class ended notification received");
            setEndBanner("Class has ended. Redirecting...");
            setTimeout(() => {
                navigate('/student-dashboard', { replace: true });
            }, 3000);
        };
        on('class_ended', handleClassEnded);
        on('kicked', () => {
            setEndBanner("You have been removed from this session.");
            setTimeout(() => navigate('/student-dashboard', { replace: true }), 3000);
        });
        on('notification', (data) => setNotification(data));

        return () => {
            if (pcRef.current) pcRef.current.close();
            if (screenPcRef.current) screenPcRef.current.close();
        };
    }, [connected, emit, navigate, on, roomCode, user?.id, user?.name, socket?.id]);

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
            if (screenPcRef.current) {
                screenPcRef.current.close();
                screenPcRef.current = null;
            }
        };
    }, []);

    // Compute PIP style - Improved for mobile
    const pipStyle = {
        position: 'absolute',
        left: pipPos.x,
        top: pipPos.y,
        zIndex: 30,
        touchAction: 'none'
    };

    return (
        <div className="fixed inset-0 bg-[#0b1120] text-white flex flex-col z-[100] animate-fade-in">
            {(notification || mediaError) && (
                <div className="absolute top-20 right-6 z-[110]">
                    {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
                    {mediaError && <Notification type="error" message={mediaError.toString()} onClose={clearError} />}
                </div>
            )}
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
            <header className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-lg gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest truncate max-w-[150px] sm:max-w-none">{statusMessage}</span>
                </div>
                <div className="text-[9px] sm:text-[10px] font-medium text-slate-500 bg-slate-800/50 px-2 sm:px-3 py-1.5 rounded-full border border-slate-700 whitespace-nowrap">
                    ID: {user?.id}
                </div>
            </header>

            {/* Immersive Main Area */}
            <main ref={mainAreaRef} className="flex-1 flex flex-col sm:flex-row p-0 sm:p-4 gap-4 overflow-hidden relative">
                {/* Large Video Area - Always Full Screen */}
                <div className="flex-1 bg-black rounded-none sm:rounded-3xl overflow-hidden relative shadow-2xl border-b sm:border border-white/5 ring-1 ring-white/10 group">
                    <div className="w-full h-full relative flex items-center justify-center">
                        {swapped ? (
                            /* Student is Big */
                            <>
                                <video
                                    ref={mainVideoRef}
                                    autoPlay playsInline muted
                                    className={`w-full h-full object-cover bg-slate-950 scale-x-[-1] ${!videoEnabled ? 'hidden' : ''}`}
                                />
                                <div className="absolute top-2 left-2 z-30">
                                    {handRaised && (
                                        <div className="bg-amber-400 text-slate-950 p-1.5 rounded-full shadow-lg border-2 border-white">
                                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                <path d="M12 2c.6 0 1 .4 1 1v7h1V4c0-.6.4-1 1-1s1 .4 1 1v6h1V6c0-.6.4-1 1-1s1 .4 1 1v9c0 2.2-1.8 4-4 4h-3c-2.8 0-5-2.2-5-5V8c0-.6.4-1 1-1s1 .4 1 1v6h1V3c0-.6.4-1 1-1z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
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
                            /* Teacher is Big */
                            <>
                                {isScreenSharing && screenStream ? (
                                    <div className="w-full h-full flex flex-col">
                                        <div className="flex-1 min-h-0 relative">
                                            <video
                                                ref={(el) => { if (el && screenStream) el.srcObject = screenStream; }}
                                                autoPlay playsInline
                                                className="w-full h-full object-contain bg-slate-900"
                                            />
                                            <div className="absolute top-3 left-3 bg-emerald-600/90 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg text-white border border-white/10 shadow-lg z-20">Teacher Screen</div>
                                        </div>
                                        {/* Move teacher camera to a small overlay if screen sharing */}
                                        <div className="absolute bottom-4 right-4 w-32 sm:w-48 aspect-video rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl z-20">
                                            <TeacherVideo stream={teacherStream} />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <TeacherVideo stream={teacherStream} />
                                        {!teacherStream && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 bg-slate-900/80 backdrop-blur-md">
                                                <div className="relative">
                                                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                                    <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-purple-500/40 rounded-full animate-spin-reverse"></div>
                                                </div>
                                                <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Syncing Teacher Feed...</p>
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3 bg-blue-600/90 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg text-white border border-white/10 shadow-lg">Teacher</div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Draggable PIP */}
                <div
                    ref={pipRef}
                    style={pipStyle}
                    onMouseDown={pipMouseDown}
                    onTouchStart={pipTouchStart}
                    className={`w-36 sm:w-60 lg:w-80 aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 ring-2 ring-black/50 transition-shadow duration-300 select-none ${isDragging ? 'shadow-blue-500/30 ring-blue-500/50 cursor-grabbing scale-105' : 'cursor-grab hover:shadow-xl hover:ring-white/20'}`}
                >
                    <div className="w-full h-full relative">
                        {swapped ? (
                            /* Teacher is PIP when swapped */
                            <>
                                <PipTeacherVideo stream={teacherStream} />
                                {!teacherStream && (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 space-y-2">
                                        <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                        <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest">Bridging...</span>
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
                    </div>

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
            <footer className="h-24 sm:h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center shrink-0 px-2">
                <div className="flex items-center gap-2 sm:gap-4 bg-slate-800/80 p-2 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md w-full sm:w-auto justify-center">
                    <ControlButton
                        onClick={handleToggleAudio}
                        active={audioEnabled}
                        label={audioEnabled ? 'Mic On' : 'Mic Off'}
                        icon={audioEnabled ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 1v3m0 18v3m8.5-12.5h-3m-13 0h-3m15.89-6.39l-2.12 2.12m-10.77 10.77l-2.12 2.12m10.77-10.77l2.12 2.12M6.34 6.34l-2.12 2.12"></path></svg>}
                    />

                    <ControlButton
                        onClick={handleToggleVideo}
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

                    <div className="hidden xs:block w-px h-8 bg-slate-700 mx-1 sm:mx-2"></div>

                    <button
                        onClick={() => {
                            if (window.confirm("Leave the class?")) {
                                emit('leave_room', { room: roomCode, role: 'student', student_id: user?.id });
                                navigate('/student-dashboard');
                            }
                        }}
                        className="bg-slate-700/50 hover:bg-slate-700 text-white px-4 sm:px-8 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest sm:tracking-[0.2em] transition-all border border-white/10"
                    >
                        Leave Class
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
                    width: '640px',
                    height: '480px',
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
        <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded-xl bg-slate-950"
        />
    ) : null;
});

const PipTeacherVideo = React.memo(({ stream }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        if (videoRef.current && stream) videoRef.current.srcObject = stream;
    }, [stream]);
    return stream ? (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-slate-950"
        />
    ) : null;
});

const ControlButton = ({ onClick, active, icon, label }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 min-w-[60px] sm:min-w-[72px] rounded-2xl transition-all ${active ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
    >
        {icon}
        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter leading-none">{label}</span>
    </button>
);

export default StudentMonitor;
