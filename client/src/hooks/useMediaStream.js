import { useState, useCallback, useEffect, useRef } from 'react';

export const useMediaStream = () => {
    const [hasStream, setHasStream] = useState(false);
    const [error, setError] = useState(null);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);

    const streamRef = useRef(null);
    const startingRef = useRef(false);

    const startStream = useCallback(async () => {
        if (streamRef.current) return streamRef.current;
        if (startingRef.current) return null;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const errorMsg = "Media devices API not available. Ensure you are using HTTPS.";
            console.error(errorMsg);
            setError(errorMsg);
            return null;
        }

        startingRef.current = true;
        try {
            console.log("Requesting Media Stream...");
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);
            
            const videoConstraints = isMobile ? {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 20 },
                facingMode: 'user'
            } : {
                width: { min: 640, ideal: 1280 },
                height: { min: 480, ideal: 720 },
                facingMode: 'user'
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    // Advanced AEC constraints for Chromium/Safari/Firefox
                    googEchoCancellation: true,
                    googAutoGainControl: true,
                    googNoiseSuppression: true,
                    googHighpassFilter: true,
                    googTypingNoiseDetection: true,
                    googNoiseReduction: true,
                    channelCount: 1, // Mono helps AEC significantly
                    latency: 0
                }
            });
            streamRef.current = mediaStream;
            setHasStream(true);
            setError(null);
            return mediaStream;
        } catch (err) {
            console.error("Media stream error:", err);
            let userMessage = "Failed to access camera/microphone.";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                userMessage = "Camera/Microphone permission denied. Please enable them in your browser settings (click the lock icon in the address bar).";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                userMessage = "No camera or microphone found on this device.";
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                userMessage = "Camera or microphone is already in use by another application.";
            }
            setError(userMessage);
            return null;
        } finally {
            startingRef.current = false;
        }
    }, []);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            setHasStream(false);
        }
    }, []);

    const toggleVideo = useCallback(() => {
        if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setVideoEnabled(videoTrack.enabled);
                console.log(`Video toggled: ${videoTrack.enabled}`);
                return videoTrack.enabled;
            }
        }
        return false;
    }, []);

    const toggleAudio = useCallback(() => {
        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setAudioEnabled(audioTrack.enabled);
                console.log(`Audio toggled: ${audioTrack.enabled}`);
                return audioTrack.enabled;
            }
        }
        return false;
    }, []);

    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                console.log("Cleanup: Media tracks stopped on unmount");
                streamRef.current = null;
            }
        };
    }, []);

    return {
        stream: streamRef.current, // Static ref access
        hasStream,
        error,
        startStream,
        stopStream,
        toggleVideo,
        toggleAudio,
        videoEnabled,
        audioEnabled
    };
};
