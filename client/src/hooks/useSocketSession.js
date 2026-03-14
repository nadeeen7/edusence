import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || "";

export const useSocketSession = (roomCode, user, role) => {
    const socketRef = useRef(null);
    const joinedRoomKeyRef = useRef(null);
    const [connected, setConnected] = useState(false);

    const emitJoinRoom = useCallback(() => {
        if (!socketRef.current || !connected || !roomCode || !user) return;

        const roomKey = `${role}:${roomCode}:${user.id}`;
        if (joinedRoomKeyRef.current === roomKey) return;

        socketRef.current.emit('join_room', {
            room: roomCode,
            role: role,
            ...(role === 'teacher'
                ? { teacher_id: user.id, teacher_name: user.name }
                : { student_id: user.id, student_name: user.name })
        });
        joinedRoomKeyRef.current = roomKey;
    }, [connected, roomCode, role, user]);

    useEffect(() => {
        // Prevent multiple connections
        if (!socketRef.current) {
            console.log("Initializing Socket Connection...");
            socketRef.current = io(SOCKET_URL, {
                transports: ["websocket"],
                withCredentials: true,
                autoConnect: true
            });

            socketRef.current.on('connect', () => {
                console.log("Socket connected:", socketRef.current.id);
                setConnected(true);
            });

            socketRef.current.on('disconnect', () => {
                console.log("Socket disconnected");
                setConnected(false);
                joinedRoomKeyRef.current = null;
            });

            socketRef.current.on('connect_error', (error) => {
                console.error("Socket Connection Error:", error);
            });
        }

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                console.log("Disconnecting socket on unmount...");
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array as requested to prevent reconnect spam

    useEffect(() => {
        emitJoinRoom();
    }, [emitJoinRoom]);

    const emit = useCallback((event, data) => {
        if (socketRef.current && connected) {
            socketRef.current.emit(event, data);
        }
    }, [connected]);

    const on = useCallback((event, callback) => {
        if (socketRef.current) {
            socketRef.current.off(event); // Remove previous listener to prevent stacking
            socketRef.current.on(event, callback);
        }
    }, []);

    const off = useCallback((event, callback) => {
        if (socketRef.current) {
            if (callback) {
                socketRef.current.off(event, callback);
            } else {
                socketRef.current.off(event);
            }
        }
    }, []);

    // eslint-disable-next-line react-hooks/refs
    return { socket: socketRef.current, connected, emit, on, off };
};
