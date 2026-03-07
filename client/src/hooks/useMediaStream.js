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

        startingRef.current = true;
        try {
            console.log("Requesting Media Stream...");
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true
            });
            streamRef.current = mediaStream;
            setHasStream(true);
            setError(null);
            return mediaStream;
        } catch (err) {
            console.error("Media stream error:", err);
            setError(err);
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
