import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { useMediaStream } from '../hooks/useMediaStream';
import { useSocketSession } from '../hooks/useSocketSession';
import api from "../services/api";
import Card from '../components/Card';
import Notification from '../components/Notification';

const AttentionChart = ({ data }) => {
    const width = 300;
    const height = 100;
    const padding = 10;

    if (!data || data.length === 0 || data.every(v => v === 0)) {
        return (
            <div className="w-full h-32 mt-4 bg-slate-800/20 rounded-xl border border-dashed border-slate-700/50 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No Activity Yet</p>
            </div>
        );
    }

    const max = 100;
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
        const y = height - (val / max) * (height - 2 * padding) - padding;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-32 mt-4 bg-slate-800/20 rounded-xl p-4 border border-slate-700/50 relative group">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path
                    d={`M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`}
                    fill="url(#lineGrad)"
                />
                <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    className="drop-shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                />
            </svg>
        </div>
    );
};

// ─── Share Class Modal ───────────────────────────────────────────────────
const ShareModal = ({ roomCode, onClose }) => {
    const joinUrl = `${window.location.origin}/student-dashboard?room=${roomCode}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;

    const copyLink = () => {
        navigator.clipboard.writeText(joinUrl);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative animate-scale-in">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l18 18"></path></svg>
                </button>

                <div className="text-center space-y-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-2">
                        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                    </div>

                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">Invite Students</h3>
                        <p className="text-slate-500 text-xs mt-1">Students can scan this code or use the link to join.</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl inline-block shadow-inner">
                        <img src={qrUrl} alt="QR Code" className="w-40 h-40" />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                            <span className="text-[10px] font-mono text-slate-400 truncate flex-1">{joinUrl}</span>
                            <button onClick={copyLink} className="text-blue-400 hover:text-blue-300 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Focused Student Video (Large View) ─────────────────────────────────────
const FocusedStudentVideo = React.memo(({ student, stream }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.log('Focused Video play prevented:', e));
        }
    }, [stream]);

    const attn = student.attention || 0;
    const borderColor = attn < 40 ? 'ring-red-500' : attn < 70 ? 'ring-yellow-500' : 'ring-green-500';
    const attnColor = attn < 40 ? 'from-red-500 to-red-600' : attn < 70 ? 'from-yellow-500 to-amber-600' : 'from-emerald-500 to-green-600';

    return (
        <div className={`relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden ring-2 ${borderColor} shadow-2xl`}>
            {stream ? (
                <video ref={videoRef} autoPlay playsInline muted={student?.audioEnabled === false} className="w-full h-full object-contain" />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Establishing Link...</span>
                </div>
            )}

            {/* Student Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-black uppercase shadow-lg border-2 border-white/20">
                            {student.name ? student.name[0] : '?'}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white">{student.name}</h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student Feed</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {student.hand_raised && (
                            <div className="bg-yellow-500 text-black p-2 rounded-full shadow-lg animate-bounce border-2 border-white/30">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1v3a1 1 0 01-1 1h-3v1a1 1 0 01-2 0v-1H6a1 1 0 01-1-1v-3H4a1 1 0 01-1-1V5a1 1 0 011-1h3V3a1 1 0 011-1h2z"></path></svg>
                            </div>
                        )}
                        <div className={`bg-gradient-to-r ${attnColor} px-4 py-2 rounded-xl shadow-lg`}>
                            <span className="text-lg font-black text-white">{Math.round(attn)}%</span>
                            <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest ml-1.5">Attention</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

// ─── Thumbnail Video (Small Strip Item) ──────────────────────────────────────
const ThumbnailVideo = React.memo(({ student, stream, onClick, isTeacher, videoRef: externalVideoRef, videoEnabled }) => {
    const localVideoRef = useRef(null);
    const ref = externalVideoRef || localVideoRef;

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
            ref.current.play().catch((e) => console.log('Thumbnail Video play prevented:', e));
        }
    }, [stream, ref]);

    const attn = student?.attention || 0;
    const borderClass = isTeacher ? 'ring-blue-500' : attn < 40 ? 'ring-red-500' : attn < 70 ? 'ring-yellow-500' : 'ring-green-500';

    return (
        <div
            onClick={onClick}
            className={`relative aspect-video bg-slate-900 rounded-xl overflow-hidden ring-2 ${borderClass} shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 hover:ring-4 hover:shadow-2xl group shrink-0 w-40 sm:w-48 lg:w-56`}
        >
            {isTeacher ? (
                <>
                    <video ref={ref} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] ${!videoEnabled ? 'hidden' : ''}`} />
                    {!videoEnabled && (
                        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                            <span className="text-[9px] font-black text-slate-500 uppercase">Camera Off</span>
                        </div>
                    )}
                    <div className="absolute top-1.5 right-1.5 bg-blue-600/90 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded text-white border border-white/10">You</div>
                </>
            ) : (
                <>
                    <video ref={ref} autoPlay playsInline muted={student?.audioEnabled === false} className={`w-full h-full object-cover ${!stream ? 'hidden' : ''}`} />
                    {(student?.videoEnabled === false || !stream) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                            {student?.videoEnabled === false ? (
                                <span className="text-[9px] font-black text-slate-500 uppercase">Camera Off</span>
                            ) : (
                                <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                            )}
                        </div>
                    )}
                </>
            )}
            {/* Name + Attention Badge */}
            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                        {student?.hand_raised && (
                            <div className="bg-yellow-500 text-black p-0.5 rounded-full shadow-lg animate-bounce border border-white shrink-0">
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1v3a1 1 0 01-1 1h-3v1a1 1 0 01-2 0v-1H6a1 1 0 01-1-1v-3H4a1 1 0 01-1-1V5a1 1 0 011-1h3V3a1 1 0 011-1h2z"></path></svg>
                            </div>
                        )}
                        <span className="text-[9px] font-bold text-white truncate">{isTeacher ? 'You (Teacher)' : student?.name}</span>
                    </div>
                    {!isTeacher && (
                        <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${attn < 40 ? 'bg-red-500' : attn < 70 ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                            <span className="text-[8px] font-black text-white">{Math.round(attn)}%</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Hover overlay */}
            {!isTeacher && (
                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Focus</span>
                    </div>
                </div>
            )}
        </div>
    );
});

// ─── Student Video (Grid Mode) ───────────────────────────────────────────────
const StudentVideoGrid = React.memo(({ student, stream, onClick }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.log('Grid Video play prevented:', e));
        }
    }, [stream]);

    const attn = student.attention || 0;
    const borderClass = attn < 40 ? 'ring-red-500' : attn < 70 ? 'ring-yellow-500' : 'ring-green-500';

    return (
        <div
            onClick={onClick}
            className={`relative aspect-video bg-slate-900 rounded-xl overflow-hidden ring-2 ${borderClass} shadow-2xl transition-all duration-500 group w-full sm:max-w-[480px] cursor-pointer hover:ring-4 lg:hover:scale-[1.02]`}
        >
            <video ref={videoRef} autoPlay playsInline muted={student.audioEnabled === false} className={`w-full h-full object-cover ${!stream ? 'hidden' : ''}`} />

            {(student.videoEnabled === false || !stream) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-slate-900">
                    {student.videoEnabled === false ? (
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shadow-inner">
                            <svg className="w-6 h-6 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26a4 4 0 015.99 5.99L8.293 6.828l-.325-.335zM4.562 7.63l1.542 1.542A4 4 0 0010 14a3.985 3.985 0 002.828-.929l4.57 4.57a13.06 13.06 0 01-14.444-1.19a1 1 0 111.428-1.39a11.062 11.062 0 001.38 1.144z" clipRule="evenodd"></path></svg>
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Waking Stream...</span>
                        </>
                    )}
                </div>
            )}

            <div className="absolute top-2 left-2 z-30">
                {student.hand_raised && (
                    <div className="bg-yellow-500 text-black p-1.5 rounded-full shadow-lg animate-bounce border-2 border-white">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1v3a1 1 0 01-1 1h-3v1a1 1 0 01-2 0v-1H6a1 1 0 01-1-1v-3H4a1 1 0 01-1-1V5a1 1 0 011-1h3V3a1 1 0 011-1h2z"></path></svg>
                    </div>
                )}
            </div>

            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 text-white">
                <div className={`w-2 h-2 rounded-full ${attn < 40 ? 'bg-red-500' : attn < 70 ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`}></div>
                <span className="text-[10px] font-black">{Math.round(attn)}%</span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                        {student.name ? student.name[0] : '?'}
                    </div>
                    <span className="text-xs font-bold text-white truncate">{student.name}</span>
                    {student.audioEnabled === false && (
                        <div className="ml-auto bg-red-500/80 p-1 rounded">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 1v3m0 18v3m8.5-12.5h-3m-13 0h-3m15.89-6.39l-2.12 2.12m-10.77 10.77l-2.12 2.12m10.77-10.77l2.12 2.12M6.34 6.34l-2.12 2.12"></path></svg>
                        </div>
                    )}
                </div>
            </div>

            {/* Click to focus hover */}
            <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-xl">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Click to Focus</span>
                </div>
            </div>
        </div>
    );
});

// ─── Video Grid Component ────────────────────────────────────────────────────
const VideoGrid = React.memo(({ students, streams, teacherVideoRef, videoEnabled, focusedStudentId, onFocusStudent }) => {
    const focusedStudent = focusedStudentId ? students.find(s => s.id === focusedStudentId) : null;

    // ── Focus Mode ───────────────────────────────────────────────────────
    if (focusedStudent) {
        const otherStudents = students.filter(s => s.id !== focusedStudentId);

        return (
            <div className="flex flex-col h-full max-w-[1600px] mx-auto gap-4 p-2 sm:p-0">
                {/* Back to Gallery Button */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onFocusStudent(null)}
                        className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-white px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all border border-slate-700 hover:border-slate-600 shadow-lg"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        <span className="hidden sm:inline">Gallery View</span>
                        <span className="sm:hidden">Back</span>
                    </button>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">Focused: {focusedStudent.name}</span>
                </div>

                {/* Large Focused Video */}
                <div className="flex-1 min-h-0">
                    <FocusedStudentVideo
                        student={focusedStudent}
                        stream={streams[focusedStudentId]}
                    />
                </div>

                {/* Thumbnail Strip */}
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    <ThumbnailVideo
                        isTeacher={true}
                        videoRef={teacherVideoRef}
                        videoEnabled={videoEnabled}
                    />
                    {otherStudents.map(student => (
                        <ThumbnailVideo
                            key={student.id}
                            student={student}
                            stream={streams[student.id]}
                            onClick={() => onFocusStudent(student.id)}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // ── Gallery Mode (default grid) ──────────────────────────────────────
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 max-w-[1600px] mx-auto min-h-0">
            {/* Teacher's Own Feed */}
            <div className="relative aspect-video min-h-[220px] bg-black rounded-2xl overflow-hidden ring-2 ring-blue-500 shadow-2xl group w-full transition-transform duration-500 hover:scale-[1.02]">
                <video ref={teacherVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute top-2 right-2 bg-blue-600/90 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md text-white border border-white/10 shadow-lg">You (Teacher)</div>
                {!videoEnabled && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                            <svg className="w-8 h-8 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26a4 4 0 015.99 5.99L8.293 6.828l-.325-.335zM4.562 7.63l1.542 1.542A4 4 0 0010 14a3.985 3.985 0 002.828-.929l4.57 4.57a13.06 13.06 0 01-14.444-1.19a1 1 0 111.428-1.39a11.062 11.062 0 001.38 1.144z" clipRule="evenodd"></path></svg>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Camera Off</span>
                    </div>
                )}
            </div>

            {/* Student Feeds */}
            {students.map(student => (
                <StudentVideoGrid
                    key={student.id}
                    student={student}
                    stream={streams[student.id]}
                    onClick={() => onFocusStudent(student.id)}
                />
            ))}

            {students.length === 0 && (
                <div className="col-span-full py-32 text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-800/30 border border-slate-700/50 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    </div>
                    <h3 className="text-slate-400 font-black uppercase tracking-widest text-sm">Waiting for students to join...</h3>
                </div>
            )}
        </div>
    );
});

// ─── Main LiveSession Component ──────────────────────────────────────────────
const LiveSession = ({ roomCode: propRoomCode, onExit }) => {
    const { user } = useAuth();
    const location = useLocation();
    const params = new URLSearchParams(location.search);

    // roomCode can come from: 1. parent prop 2. URL param 3. localStorage
    const roomCode = propRoomCode || params.get('room') || localStorage.getItem('active_class_code') || '';

    const [viewMode, setViewMode] = useState('gallery'); // 'gallery' | 'dashboard'
    const [focusedStudentId, setFocusedStudentId] = useState(null);
    const [activeStudents, setActiveStudents] = useState([]);
    const [studentStreams, setStudentStreams] = useState({});
    const [notification, setNotification] = useState(null);
    const [stats, setStats] = useState({
        activeCount: 0,
        classAvg: 0,
        lowAttn: 0,
        alerts: 0
    });
    const [showShareModal, setShowShareModal] = useState(false);

    const pcRefs = useRef({});
    const teacherVideoRef = useRef(null);
    const teacherStreamRef = useRef(null);
    const pendingCallsRef = useRef([]); // Track students waiting for teacher stream
    const [trendData, setTrendData] = useState(() => {
        const saved = localStorage.getItem('trend_data');
        try {
            const parsed = saved ? JSON.parse(saved) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("Failed to parse trend_data from localStorage:", e);
            return [];
        }
    });

    // Reset focus when switching to dashboard
    useEffect(() => {
        if (viewMode === 'dashboard') setFocusedStudentId(null);
    }, [viewMode]);

    // 1. Media Management
    const {
        stream: teacherStream,
        hasStream: hasTeacherStream,
        error: mediaError,
        startStream,
        videoEnabled,
        audioEnabled,
        toggleVideo,
        toggleAudio
    } = useMediaStream();

    // 2. Socket Management
    const { connected, emit, on } = useSocketSession(roomCode, user, 'teacher');

    // Initialize Media
    useEffect(() => {
        const init = async () => {
            if (!teacherStreamRef.current) {
                await startStream();
            }
        };
        init();
    }, [startStream]);

    // Sync Stats on Connect
    useEffect(() => {
        if (connected && roomCode) {
            console.log("Teacher Sync Request - Fetching existing students...");
            emit('request_sync', { room: roomCode });
        }
    }, [connected, roomCode, emit]);

    const initiateCall = useCallback(async (socketId, studentId, localStream) => {
        if (pcRefs.current[studentId]) pcRefs.current[studentId].close();

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
        pcRefs.current[studentId] = pc;

        if (localStream) {
            console.log("Adding teacher tracks to peer connection for:", studentId);
            localStream.getTracks().forEach(track => {
                const senders = pc.getSenders();
                const trackExists = senders.some(sender => sender.track === track);
                if (!trackExists) {
                    pc.addTrack(track, localStream);
                }
            });
        } else {
            console.warn("Initiating call without teacher stream for:", studentId);
        }

        pc.ontrack = (event) => {
            console.log(`Teacher received track from ${studentId}: ${event.track.kind}`);
            const track = event.track;
            setStudentStreams(prev => {
                const existingStream = prev[studentId] || new MediaStream();
                if (!existingStream.getTracks().some(t => t.id === track.id)) {
                    existingStream.addTrack(track);
                }
                // Return new identity for the stream container to trigger React re-renders in sub-components
                return { ...prev, [studentId]: new MediaStream(existingStream.getTracks()) };
            });
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                emit('ice_candidate', { to: socketId, candidate: event.candidate, student_id: 'teacher' });
            }
        };

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            emit('teacher_offer', { room: roomCode, to: socketId, offer });
        } catch (err) {
            console.error("Error creating teacher offer:", err);
        }
    }, [emit, roomCode]);

    // Sync teacherStream Ref and Video Element
    useEffect(() => {
        if (hasTeacherStream && teacherStream) {
            console.log("Teacher stream becoming available. Checking pending calls...");
            teacherStreamRef.current = teacherStream;

            if (teacherVideoRef.current) {
                teacherVideoRef.current.srcObject = teacherStream;
                teacherVideoRef.current.play().catch(e => console.warn("Teacher video play error:", e));
            }

            // Flush pending calls now that we have a stream
            if (pendingCallsRef.current.length > 0) {
                console.log(`Flushing ${pendingCallsRef.current.length} pending calls...`);
                pendingCallsRef.current.forEach(student => {
                    initiateCall(student.socketId, student.studentId, teacherStream);
                });
                pendingCallsRef.current = [];
            }
        }
    }, [hasTeacherStream, teacherStream, viewMode, focusedStudentId, initiateCall]);

    // Socket Events & Signaling
    useEffect(() => {
        if (!connected) return;

        // WebRTC Signaling listeners
        on('user_joined', async (data) => {
            console.log("Student joined room:", data.student_name);
            setNotification({ type: 'info', message: `${data.student_name} joined` });
            setActiveStudents(prev => {
                if (!prev.some(s => s.id === data.student_id)) {
                    return [...prev, {
                        id: data.student_id,
                        name: data.student_name || 'Student',
                        attention: 0,
                        status: 'Connecting',
                        audioEnabled: true,
                        videoEnabled: true
                    }];
                }
                return prev;
            });

            // Crucial for mobile: ensure we have a stream and session is active before calling
            if (teacherStreamRef.current) {
                console.log("Initiating call to joiner:", data.student_name);
                await initiateCall(data.id, data.student_id, teacherStreamRef.current);
            } else {
                console.warn("User joined but teacher stream not ready yet. Adding to pending calls.");
                pendingCallsRef.current.push({ socketId: data.id, studentId: data.student_id });
            }
        });

        on('student_left', (data) => {
            const sid = data.student_id;
            if (pcRefs.current[sid]) {
                pcRefs.current[sid].close();
                delete pcRefs.current[sid];
            }
            setStudentStreams(prev => {
                const next = { ...prev };
                delete next[sid];
                return next;
            });
            setActiveStudents(prev => prev.filter(s => s.id !== sid));
            setFocusedStudentId(prev => prev === sid ? null : prev);
        });

        on('attention-update', (data) => {
            const sid = data.userId || data.student_id;
            setActiveStudents(prev => {
                const idx = prev.findIndex(s => s.id === sid);
                if (idx !== -1) {
                    const next = [...prev];
                    const existing = next[idx];
                    next[idx] = {
                        ...existing,
                        attention: data.attention ?? existing.attention,
                        status: data.status ?? existing.status,
                        audioEnabled: data.audioEnabled ?? existing.audioEnabled,
                        videoEnabled: data.videoEnabled ?? existing.videoEnabled,
                        // Ensure hand_raised is kept if the update doesn't have it, but prefer update if present
                        hand_raised: (data.hand_raised !== undefined) ? data.hand_raised : existing.hand_raised
                    };
                    return next;
                } else {
                    return [...prev, {
                        id: sid,
                        name: data.student_name || 'Student',
                        attention: data.attention || 0,
                        status: data.status || 'Connected',
                        audioEnabled: data.audioEnabled ?? true,
                        videoEnabled: data.videoEnabled ?? true,
                        hand_raised: data.hand_raised || false
                    }];
                }
            });
        });

        on('student_raised_hand', (data) => {
            console.log(`[EVENT] Hand ${data.is_raised ? 'Raised' : 'Lowered'} by ${data.student_name}`);
            if (data.is_raised) {
                setNotification({
                    type: 'info',
                    message: `${data.student_name} raised their hand`,
                    duration: 5000
                });
            }
            setActiveStudents(prev => prev.map(s =>
                s.id === data.student_id ? { ...s, hand_raised: data.is_raised } : s
            ));
        });

        on('media_state_change', (data) => {
            setActiveStudents(prev => prev.map(s =>
                s.id === data.student_id ? { ...s, videoEnabled: data.videoEnabled, audioEnabled: data.audioEnabled } : s
            ));
        });

        on('dashboard_update', (data) => {
            setStats({
                activeCount: data.active_count,
                classAvg: data.class_avg,
                lowAttn: data.low_count,
                alerts: data.critical_count
            });
            if (data.students) {
                // We got the full sync payload. Merge robustly.
                setActiveStudents(prev => {
                    const next = [...prev];
                    data.students.forEach(newStudent => {
                        const idx = next.findIndex(s => s.id === newStudent.id);
                        if (idx !== -1) {
                            next[idx] = { ...next[idx], ...newStudent };
                        } else {
                            next.push(newStudent);
                        }
                    });
                    // Only keep students that are in the full sync payload, removing disconnected ghosts
                    return next.filter(s => data.students.some(ns => ns.id === s.id));
                });
            }
            // Update trend data
            const newPoint = data.class_avg || 0;
            setTrendData(prev => {
                const updated = [...prev, newPoint].slice(-30);
                localStorage.setItem('trend_data', JSON.stringify(updated));
                return updated;
            });

            // Sync current session state to localStorage for refresh recovery
            localStorage.setItem('active_class_avg', newPoint);
            localStorage.setItem('active_class_code', roomCode);
        });

        on('student_answer', async (data) => {
            const pc = pcRefs.current[data.student_id];
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                } catch (err) {
                    console.error("Error setting remote description:", err);
                }
            }
        });

        on('ice_candidate', async (data) => {
            const pc = pcRefs.current[data.student_id];
            if (pc && data.candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (err) {
                    console.error("Error adding ice candidate:", err);
                }
            }
        });


        return () => {
            console.log("Cleaning up LiveSession - closing all PeerConnections");
            Object.values(pcRefs.current).forEach(pc => {
                console.log(`Closing PC for student, last state: ${pc.connectionState}`);
                pc.close();
            });
            pcRefs.current = {};
        };
    }, [connected, emit, on, roomCode, initiateCall]);

    const handleEndClass = () => {
        if (window.confirm("End this class for everyone?")) {
            console.log("Teacher ending class...");
            emit('end_class', { room: roomCode });

            // Allow the socket emit to fly over the network before destroying the component/socket
            setTimeout(() => {
                onExit();
            }, 500);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0b1120] text-white flex flex-col z-[9999] animate-fade-in">
            {(notification || mediaError) && (
                <div className="absolute top-20 right-6 z-[110]">
                    {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
                    {mediaError && <Notification type="error" message={mediaError.toString()} onClose={() => { }} />}
                </div>
            )}

            {showShareModal && <ShareModal roomCode={roomCode} onClose={() => setShowShareModal(false)} />}

            {/* Premium Header */}
            <header className="min-h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3 sm:py-0 shrink-0 gap-4 sm:gap-0">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/20">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-tighter">Live Classroom</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-mono text-slate-400">ID: {roomCode}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(roomCode);
                                    setNotification({ type: 'success', message: 'Room Code copied to clipboard!' });
                                }}
                                className="p-1 hover:bg-slate-800 rounded transition-colors group/copy"
                                title="Copy Room Code"
                            >
                                <svg className="w-3 h-3 text-slate-500 group-hover/copy:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                            </button>
                            <button
                                onClick={() => setShowShareModal(true)}
                                className="flex items-center gap-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-blue-500/20 transition-all ml-1"
                            >
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                Share
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl border border-slate-700">
                    <button
                        onClick={() => setViewMode('gallery')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'gallery' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Gallery
                    </button>
                    <button
                        onClick={() => setViewMode('dashboard')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'dashboard' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Dashboard
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex flex-col items-end mr-2">
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">Avg Attention</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl sm:text-3xl font-black text-white">{stats.classAvg}%</span>
                        </div>
                    </div>
                    <button onClick={handleEndClass} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase transition-all whitespace-nowrap">End Class</button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 relative">
                {viewMode === 'gallery' ? (
                    <VideoGrid
                        students={activeStudents}
                        streams={studentStreams}
                        teacherStream={teacherStream}
                        teacherVideoRef={teacherVideoRef}
                        videoEnabled={videoEnabled}
                        focusedStudentId={focusedStudentId}
                        onFocusStudent={setFocusedStudentId}
                    />
                ) : (
                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <StatCard label="Active Students" value={stats.activeCount} />
                            <StatCard label="Class Average" value={`${stats.classAvg}%`} color="text-blue-400" />
                            <StatCard label="Low Attention" value={stats.lowAttn} color="text-yellow-400" />
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <Card className="bg-slate-900/50 border-slate-800 flex flex-col justify-center p-6">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Attention Trend (Real-time)</h3>
                                <AttentionChart data={trendData} />
                            </Card>
                        </div>

                        <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-2xl">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-[10px] uppercase text-slate-500 font-black tracking-widest border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4">Student</th>
                                        <th className="px-6 py-4">Attention Score</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {activeStudents.map(student => (
                                        <tr key={student.id} className="hover:bg-slate-800/20 transition-all">
                                            <td className="px-6 py-4 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-xs uppercase text-slate-300 relative">
                                                    {student.name ? student.name[0] : '?'}
                                                    {student.hand_raised && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-slate-900"></div>
                                                    )}
                                                </div>
                                                <span className="font-bold">{student.name}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className={`h-full ${student.attention < 60 ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-500`} style={{ width: `${student.attention}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-black min-w-[30px]">{Math.round(student.attention)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${student.attention < 60 ? 'bg-red-500/20 text-red-400 border border-red-500/10' : 'bg-blue-500/20 text-blue-400 border border-blue-500/10'}`}>
                                                    {student.attention < 60 ? 'Distracted' : 'Focused'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {/* Kick Student */}
                                                    <div className="relative group/kick">
                                                        <button
                                                            onClick={() => emit('kick_student', { room: roomCode, student_id: student.id })}
                                                            className="w-8 h-8 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                                                        </button>
                                                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] text-red-300 px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover/kick:opacity-100 transition-opacity pointer-events-none border border-slate-700">
                                                            Remove Student
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                )}
            </main>

            {/* Bottom Professional Control Bar */}
            <footer className="h-24 sm:h-20 border-t border-slate-800 bg-slate-900 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex items-center justify-center relative shrink-0 px-2">
                <div className="flex items-center gap-2 sm:gap-4 bg-slate-800/80 p-2 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md w-full sm:w-auto justify-center">
                    <ControlButton
                        onClick={toggleAudio}
                        active={audioEnabled}
                        label={audioEnabled ? 'Mute' : 'Unmute'}
                        icon={audioEnabled ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>}
                    />

                    <ControlButton
                        onClick={toggleVideo}
                        active={videoEnabled}
                        label={videoEnabled ? 'Stop Video' : 'Start Video'}
                        icon={videoEnabled ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>}
                    />

                    <div className="w-px h-8 bg-slate-700 mx-2"></div>

                    <button
                        onClick={onExit}
                        className="bg-slate-700/50 hover:bg-slate-700 text-white px-3 sm:px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all"
                    >
                        Leave
                    </button>

                    <button
                        onClick={handleEndClass}
                        className="bg-red-600 hover:bg-red-500 text-white px-3 sm:px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-lg shadow-red-600/30 transition-all ml-1 sm:ml-2"
                    >
                        End
                    </button>
                </div>

                <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-500 tracking-tighter uppercase leading-none mb-1">Status</span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-300">{connected ? 'Live Sync' : 'Reconnecting...'}</span>
                            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// ─── Internal Helper Components ──────────────────────────────────────────────
const StatCard = ({ label, value, color = "text-white" }) => (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-slate-700 transition-colors group">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover:text-slate-400 transition-colors">{label}</h3>
        <p className={`text-3xl font-black ${color}`}>{value}</p>
    </div>
);

const ControlButton = ({ onClick, active, icon, label }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-1 p-2 min-w-[64px] rounded-xl transition-all ${active ? 'text-white hover:bg-slate-700' : 'text-red-400 bg-red-500/10 hover:bg-red-500/20'}`}
    >
        {icon}
        <span className="text-[10px] font-black uppercase tracking-tighter leading-none">{label}</span>
    </button>
);

export default LiveSession;
