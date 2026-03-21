import { useRef, useEffect } from "react";

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

interface WebcamOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  rawLandmarks: { x: number; y: number; z: number }[] | null;
  gestureState: string;
}

export function WebcamOverlay({ videoRef, rawLandmarks, gestureState }: WebcamOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = 320;
  const height = 240;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    if (!rawLandmarks) return;

    const isRecording = gestureState === "recording";
    const isTracking = gestureState !== "idle";
    const color = isRecording ? "#ff4444" : isTracking ? "#00ff88" : "#ffaa00";

    // Draw skeleton lines
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (const [i, j] of HAND_CONNECTIONS) {
      const a = rawLandmarks[i];
      const b = rawLandmarks[j];
      if (a && b) {
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      }
    }

    // Draw landmark dots
    for (const point of rawLandmarks) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [rawLandmarks, gestureState]);

  const isTracking = gestureState !== "idle";
  const label = isTracking ? "Hand Track" : "Off";

  return (
    <div
      className="absolute top-4 left-4 rounded-xl overflow-hidden border-2 transition-colors"
      style={{
        width,
        height,
        borderColor: isTracking ? "#00ff88" : "#444",
        transform: "scaleX(-1)",
      }}
    >
      <video
        ref={videoRef}
        style={{ width, height, objectFit: "cover", display: "block" }}
        autoPlay
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute top-0 left-0 pointer-events-none"
      />
      {/* Label overlay (un-mirror the text) */}
      <div
        className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm"
        style={{
          transform: "scaleX(-1)",
          backgroundColor: isTracking ? "rgba(0,255,136,0.2)" : "rgba(68,68,68,0.6)",
          color: isTracking ? "#00ff88" : "#999",
        }}
      >
        {label}
      </div>
    </div>
  );
}
