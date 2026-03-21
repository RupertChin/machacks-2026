/**
 * React hook that manages the full MediaPipe gesture-detection lifecycle.
 *
 * Design choices:
 *  - The detection + camera-update loop uses refs (NOT state) for per-frame
 *    data to avoid triggering 60fps re-renders.  State is only set for values
 *    the UI layer actually observes (landmarks for the overlay, gestureState
 *    for the debug badge, loading/error for feedback).
 *  - The `cancelled` flag pattern (from the MVP) guards every async boundary
 *    so that a fast unmount during init can't leave zombie streams or trackers.
 *  - Gesture input is suppressed while voice recording is active so the two
 *    modalities don't fight.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { HandTracker } from "@/lib/mediapipe/handTracker";
import {
  createInitialContext,
  processFrame,
} from "@/lib/mediapipe/gestureDetector";
import type { CameraController } from "@/lib/three/cameraController";
import type { GestureState, Point3D } from "@/lib/mediapipe/types";

// ── Public interface ────────────────────────────────────────────────

export interface UseGesturesOptions {
  cameraControllerRef: React.RefObject<CameraController | null>;
  isVoiceActive: boolean;
}

export interface UseGesturesReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  rawLandmarks: Point3D[] | null;
  gestureState: GestureState;
  isLoading: boolean;
  error: string | null;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useGestures({
  cameraControllerRef,
  isVoiceActive,
}: UseGesturesOptions): UseGesturesReturn {
  // Refs for objects that live across the rAF loop (never trigger re-renders)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const contextRef = useRef(createInitialContext());
  const frameRef = useRef<number>(0);

  // Mirror the `isVoiceActive` prop into a ref so the rAF callback always
  // reads the latest value without being a dependency of the loop.
  const isVoiceActiveRef = useRef(isVoiceActive);

  // Observable state for the UI layer
  const [rawLandmarks, setRawLandmarks] = useState<Point3D[] | null>(null);
  const [gestureState, setGestureState] = useState<GestureState>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep the voice-active ref in sync with the prop
  useEffect(() => {
    isVoiceActiveRef.current = isVoiceActive;
  }, [isVoiceActive]);

  // ── Initialization (tracker + webcam) ─────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Boot MediaPipe hand landmarker
        const tracker = new HandTracker();
        await tracker.init();
        if (cancelled) {
          tracker.destroy();
          return;
        }
        trackerRef.current = tracker;

        // 2. Request webcam — video only (audio is handled by useVoice)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // 3. Wire the stream into the hidden <video> element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to initialize hand tracking"
          );
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      trackerRef.current?.destroy();
      trackerRef.current = null;

      // Stop all webcam tracks so the browser releases the camera indicator
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, []);

  // ── Detection + camera-drive loop ─────────────────────────────────

  const detect = useCallback(() => {
    const video = videoRef.current;
    const tracker = trackerRef.current;
    const controller = cameraControllerRef.current;

    // Skip frames until the video is actually producing data
    if (!video || !tracker || video.readyState < 2) {
      frameRef.current = requestAnimationFrame(detect);
      return;
    }

    // Suppress gesture processing while voice recording is active
    if (isVoiceActiveRef.current) {
      setRawLandmarks(null);
      setGestureState("idle");
      // Reset the tracking context so the next gesture starts fresh
      // (avoids a big delta jump when resuming)
      contextRef.current = createInitialContext();
      frameRef.current = requestAnimationFrame(detect);
      return;
    }

    const result = tracker.processFrame(video, performance.now());

    if (result) {
      // Expose raw landmark positions for the overlay canvas
      setRawLandmarks(result.rawLandmarks);

      // Run the gesture state machine
      const gestureResult = processFrame(contextRef.current, result.landmarks);
      contextRef.current = gestureResult.context;
      const output = gestureResult.output;

      setGestureState(output.state);

      // Drive the Three.js camera controller directly — no extra state needed
      if (controller) {
        if (output.state === "rotate") {
          controller.orbit(output.rotationDelta.y, output.rotationDelta.x);
          controller.zoom(output.zoomDelta);
        } else if (output.state === "pan") {
          controller.pan(output.panOffset.x, output.panOffset.y);
        }
      }
    } else {
      setRawLandmarks(null);
      setGestureState("idle");
    }

    frameRef.current = requestAnimationFrame(detect);
  }, [cameraControllerRef]);

  // ── Start / stop the loop in sync with loading state ──────────────

  useEffect(() => {
    if (!isLoading && !error) {
      frameRef.current = requestAnimationFrame(detect);
    }
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isLoading, error, detect]);

  return { videoRef, rawLandmarks, gestureState, isLoading, error };
}
