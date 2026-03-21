/**
 * Webcam overlay with hand-skeleton debug visualization.
 *
 * Renders a small picture-in-picture panel (top-left) showing the mirrored
 * webcam feed with MediaPipe landmarks drawn on a transparent canvas layer.
 * The border color reflects the active gesture state:
 *   - gray  = idle
 *   - green = rotate/zoom (finger gun)
 *   - blue  = pan (pinch + 3 open)
 *
 * Ported from the MVP's HandTrackingViewport — uses Tailwind where possible,
 * falls back to inline `style` only for the mirror transform and explicit
 * pixel dimensions the canvas needs to match.
 */

import { useRef, useEffect } from "react";
import { HAND_CONNECTIONS } from "@/lib/mediapipe/types";
import type { GestureState, Point3D } from "@/lib/mediapipe/types";

// ── Overlay dimensions (CSS pixels) ─────────────────────────────────

const WIDTH = 320;
const HEIGHT = 240;

// ── Props ───────────────────────────────────────────────────────────

interface WebcamOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  rawLandmarks: Point3D[] | null;
  gestureState: GestureState;
}

// ── Component ───────────────────────────────────────────────────────

export function WebcamOverlay({
  videoRef,
  rawLandmarks,
  gestureState,
}: WebcamOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Repaint the skeleton canvas whenever landmarks or state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (!rawLandmarks) return;

    const isActive = gestureState !== "idle";
    const lineColor = isActive ? "#00ff88" : "#ffaa00";
    const dotColor = isActive ? "#00ffaa" : "#ffcc00";

    // ── Draw skeleton bone connections ────────────────────────────
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    for (const [i, j] of HAND_CONNECTIONS) {
      const a = rawLandmarks[i];
      const b = rawLandmarks[j];
      if (!a || !b) continue; // safety guard
      ctx.beginPath();
      ctx.moveTo(a.x * WIDTH, a.y * HEIGHT);
      ctx.lineTo(b.x * WIDTH, b.y * HEIGHT);
      ctx.stroke();
    }

    // ── Draw landmark dots ───────────────────────────────────────
    ctx.fillStyle = dotColor;
    for (const point of rawLandmarks) {
      ctx.beginPath();
      ctx.arc(point.x * WIDTH, point.y * HEIGHT, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Highlight thumb tip (4) and index tip (8) ────────────────
    ctx.strokeStyle = "#ff4488";
    ctx.lineWidth = 2;
    for (const idx of [4, 8]) {
      const pt = rawLandmarks[idx];
      if (!pt) continue;
      ctx.beginPath();
      ctx.arc(pt.x * WIDTH, pt.y * HEIGHT, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [rawLandmarks, gestureState]);

  // Map gesture state to a Tailwind border color class
  const borderColor =
    gestureState === "rotate"
      ? "border-green-400"
      : gestureState === "pan"
        ? "border-blue-400"
        : "border-gray-600";

  return (
    <div
      className={`absolute top-4 left-4 rounded-xl overflow-hidden border-2 ${borderColor} z-20`}
      style={{ transform: "scaleX(-1)" }}
    >
      {/* Hidden-ish video element — acts as the MediaPipe source */}
      <video
        ref={videoRef}
        className="block"
        style={{ width: WIDTH, height: HEIGHT, objectFit: "cover" }}
        autoPlay
        playsInline
        muted
      />

      {/* Transparent canvas overlaid on top for skeleton drawing */}
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ width: WIDTH, height: HEIGHT }}
      />
    </div>
  );
}
