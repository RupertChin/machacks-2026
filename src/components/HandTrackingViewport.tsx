import { useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useHandTracking } from "../hooks/useHandTracking.ts";
import { useThreeScene } from "../hooks/useThreeScene.ts";
import type { GestureOutput } from "../types/gestures.ts";

// MediaPipe hand connections — pairs of landmark indices that form the skeleton
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // index
  [0, 9], [9, 10], [10, 11], [11, 12],  // middle
  [0, 13], [13, 14], [14, 15], [15, 16],// ring
  [0, 17], [17, 18], [18, 19], [19, 20],// pinky
  [5, 9], [9, 13], [13, 17],            // palm
];

function TrackedCube({ gesture }: { gesture: GestureOutput }) {
  const { meshRef } = useThreeScene({ gesture });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4488ff" />
    </mesh>
  );
}

function DebugOverlay({ gesture }: { gesture: GestureOutput }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        background: "rgba(0, 0, 0, 0.7)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 12,
        padding: "8px 12px",
        borderRadius: 4,
        pointerEvents: "none",
      }}
    >
      <div>State: {gesture.state.toUpperCase()}</div>
      <div>Rot: ({gesture.rotationDelta.x.toFixed(3)}, {gesture.rotationDelta.y.toFixed(3)})</div>
      <div>Zoom: {gesture.zoomDelta.toFixed(3)}</div>
      <div>Pan: ({gesture.panOffset.x.toFixed(3)}, {gesture.panOffset.y.toFixed(3)})</div>
    </div>
  );
}

/** Draws hand landmarks and skeleton on a canvas overlaying the webcam preview */
function HandOverlay({
  rawLandmarks,
  width,
  height,
  isTracking,
}: {
  rawLandmarks: { x: number; y: number; z: number }[] | null;
  width: number;
  height: number;
  isTracking: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    ctx2d.clearRect(0, 0, width, height);

    if (!rawLandmarks) return;

    // Color scheme: green when tracking, yellow when idle
    const color = isTracking ? "#00ff88" : "#ffaa00";
    const dotColor = isTracking ? "#00ffaa" : "#ffcc00";

    // Draw connections (skeleton lines)
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = 2;
    for (const [i, j] of HAND_CONNECTIONS) {
      const a = rawLandmarks[i];
      const b = rawLandmarks[j];
      ctx2d.beginPath();
      // Coordinates are already mirrored by CSS scaleX(-1) on the container
      ctx2d.moveTo(a.x * width, a.y * height);
      ctx2d.lineTo(b.x * width, b.y * height);
      ctx2d.stroke();
    }

    // Draw landmark dots
    for (const point of rawLandmarks) {
      ctx2d.fillStyle = dotColor;
      ctx2d.beginPath();
      ctx2d.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2);
      ctx2d.fill();
    }

    // Highlight thumb tip and index tip with larger circles
    const thumb = rawLandmarks[4];
    const index = rawLandmarks[8];
    ctx2d.strokeStyle = "#ff4488";
    ctx2d.lineWidth = 2;
    for (const pt of [thumb, index]) {
      ctx2d.beginPath();
      ctx2d.arc(pt.x * width, pt.y * height, 6, 0, Math.PI * 2);
      ctx2d.stroke();
    }
  }, [rawLandmarks, width, height, isTracking]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: "none",
      }}
    />
  );
}

export function HandTrackingViewport() {
  const { gesture, videoRef, rawLandmarks, isLoading, error } = useHandTracking();

  const previewWidth = 320;
  const previewHeight = 240;

  if (error) {
    return (
      <div style={{ color: "red", padding: 32, fontFamily: "monospace" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#111", position: "relative" }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 18,
            zIndex: 10,
          }}
        >
          Loading MediaPipe + Webcam...
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <TrackedCube gesture={gesture} />
      </Canvas>

      {/* Webcam preview with hand overlay — top-left, mirrored */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          width: previewWidth,
          height: previewHeight,
          borderRadius: 12,
          overflow: "hidden",
          border: gesture.state === "rotate" ? "2px solid #00ff88"
                 : gesture.state === "pan" ? "2px solid #44aaff"
                 : "2px solid #444",
          transform: "scaleX(-1)",
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: previewWidth,
            height: previewHeight,
            objectFit: "cover",
            display: "block",
          }}
          autoPlay
          playsInline
          muted
        />
        <HandOverlay
          rawLandmarks={rawLandmarks}
          width={previewWidth}
          height={previewHeight}
          isTracking={gesture.state !== "idle"}
        />
      </div>

      <DebugOverlay gesture={gesture} />
    </div>
  );
}
