import { useEffect, useRef, useCallback, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type {
  GestureOutput,
  HandLandmarks,
} from "../types/gestures";
import { createInitialContext, processFrame } from "../lib/gestureStateMachine.ts";

interface UseHandTrackingReturn {
  gesture: GestureOutput;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Raw 21-landmark array from MediaPipe, for drawing overlays */
  rawLandmarks: { x: number; y: number; z: number }[] | null;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_OUTPUT: GestureOutput = {
  state: "idle",
  rotationDelta: { x: 0, y: 0 },
  zoomDelta: 0,
  panOffset: { x: 0, y: 0 },
};

export function useHandTracking(): UseHandTrackingReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const contextRef = useRef(createInitialContext());
  const animationFrameRef = useRef<number>(0);
  const [gesture, setGesture] = useState<GestureOutput>(DEFAULT_OUTPUT);
  const [rawLandmarks, setRawLandmarks] = useState<{ x: number; y: number; z: number }[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        if (cancelled) return;
        handLandmarkerRef.current = handLandmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
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
          setError(err instanceof Error ? err.message : "Failed to initialize");
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      handLandmarkerRef.current?.close();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, []);

  const detect = useCallback(() => {
    const video = videoRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (!video || !handLandmarker || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    const results = handLandmarker.detectForVideo(video, performance.now());

    if (results.landmarks && results.landmarks.length > 0) {
      const lm = results.landmarks[0];

      // Expose raw landmarks for overlay drawing
      setRawLandmarks(lm);

      const handData: HandLandmarks = {
        thumbTip: lm[4],
        thumbIp: lm[3],
        thumbMcp: lm[2],
        indexTip: lm[8],
        indexMcp: lm[5],
        middleTip: lm[12],
        middleMcp: lm[9],
        ringTip: lm[16],
        ringMcp: lm[13],
        pinkyTip: lm[20],
        pinkyMcp: lm[17],
        wrist: lm[0],
      };

      const result = processFrame(contextRef.current, handData);
      contextRef.current = result.context;
      setGesture(result.output);
    } else {
      setRawLandmarks(null);
      setGesture(DEFAULT_OUTPUT);
    }

    animationFrameRef.current = requestAnimationFrame(detect);
  }, []);

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

  return { gesture, videoRef, rawLandmarks, isLoading, error };
}
