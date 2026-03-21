import { useEffect, useRef, useState, useCallback } from "react";
import { initHandTracker, detectForVideo, closeHandTracker } from "@/lib/mediapipe/handTracker";
import {
  detectGesture,
  createInitialContext,
  type GestureOutput,
} from "@/lib/mediapipe/gestureDetector";

const DEFAULT_OUTPUT: GestureOutput = {
  state: "idle",
  rotationDelta: { x: 0, y: 0 },
  zoomDelta: 0,
  panOffset: { x: 0, y: 0 },
};

export function useGestures(suppressed: boolean = false) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const contextRef = useRef(createInitialContext());
  const animationFrameRef = useRef<number>(0);
  const [gesture, setGesture] = useState<GestureOutput>(DEFAULT_OUTPUT);
  const [rawLandmarks, setRawLandmarks] = useState<
    { x: number; y: number; z: number }[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await initHandTracker();

        if (cancelled) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to init MediaPipe");
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      closeHandTracker();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, []);

  const detect = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    if (suppressed) {
      setGesture(DEFAULT_OUTPUT);
      setRawLandmarks(null);
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    const results = detectForVideo(video, performance.now());

    if (results && results.landmarks.length > 0) {
      setRawLandmarks(results.landmarks[0]);

      const { context, output } = detectGesture(
        contextRef.current,
        results.landmarks,
      );
      contextRef.current = context;
      setGesture(output);
    } else {
      setRawLandmarks(null);
      setGesture(DEFAULT_OUTPUT);
    }

    animationFrameRef.current = requestAnimationFrame(detect);
  }, [suppressed]);

  useEffect(() => {
    if (!isLoading && !error) {
      animationFrameRef.current = requestAnimationFrame(detect);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading, error, detect]);

  // Expose the media stream so other hooks (useVoice) can share the audio track
  const getMediaStream = useCallback((): MediaStream | null => {
    return videoRef.current?.srcObject as MediaStream | null;
  }, []);

  return { gesture, videoRef, rawLandmarks, isLoading, error, getMediaStream };
}
