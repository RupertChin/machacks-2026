/**
 * Viewport — the composition root for the 3D view.
 *
 * Owns the shared refs and state that bridge the Three.js canvas,
 * the MediaPipe gesture system, and the webcam overlay:
 *
 *   - `cameraControllerRef` is created here and shared between ThreeCanvas
 *     (which writes to it) and useGestures (which reads from it to drive
 *     orbit/pan/zoom).
 *   - `useGestures` returns the videoRef, rawLandmarks, and gestureState
 *     that the WebcamOverlay needs for rendering.
 *   - `isVoiceActive` is lifted here so gesture suppression can be toggled
 *     when VoiceControls starts recording.
 *
 * GestureController.tsx is intentionally left as a null stub — the hook
 * IS the controller, and calling it directly here avoids an unnecessary
 * wrapper component and the data-syncing headaches that come with it.
 */

import { useRef, useState } from "react";
import { ThreeCanvas } from "./viewport/ThreeCanvas";
import { WebcamOverlay } from "./viewport/WebcamOverlay";
import { VoiceControls } from "./viewport/VoiceControls";
import { useGestures } from "@/hooks/useGestures";
import type { CameraController } from "@/lib/three/cameraController";

export function Viewport() {
  // Shared mutable ref — written by ThreeCanvas, read by useGestures
  const cameraControllerRef = useRef<CameraController | null>(null);

  // Voice state — when true, gestures are suppressed
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // The gesture hook manages the MediaPipe lifecycle and drives the camera
  const { videoRef, rawLandmarks, gestureState, isLoading, error } =
    useGestures({
      cameraControllerRef,
      isVoiceActive,
    });

  // Suppress "declared but not used" for setIsVoiceActive — it will be
  // wired to VoiceControls once that component is implemented.
  void setIsVoiceActive;

  return (
    <div className="flex-1 relative bg-gray-900 overflow-hidden">
      {/* Three.js 3D scene (fills entire viewport) */}
      <ThreeCanvas cameraControllerRef={cameraControllerRef} />

      {/* Webcam PIP with hand-skeleton overlay */}
      <WebcamOverlay
        videoRef={videoRef}
        rawLandmarks={rawLandmarks}
        gestureState={gestureState}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-mono text-lg z-10">
          Loading MediaPipe + Webcam...
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="absolute top-4 right-4 bg-red-900/80 text-red-200 px-4 py-2 rounded-lg font-mono text-sm z-10">
          {error}
        </div>
      )}

      {/* Debug overlay — always visible, shows current gesture state */}
      <div className="absolute bottom-4 right-4 bg-black/70 text-green-400 font-mono text-xs px-3 py-2 rounded pointer-events-none z-10">
        <div>State: {gestureState.toUpperCase()}</div>
      </div>

      {/* Voice recording controls (stub — will be wired later) */}
      <VoiceControls />
    </div>
  );
}
