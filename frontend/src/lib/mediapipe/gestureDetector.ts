export type GestureState = "idle" | "orbit" | "pan" | "zoom" | "reset";

export interface GestureOutput {
  state: GestureState;
  rotationDelta: { x: number; y: number };
  zoomDelta: number;
  panOffset: { x: number; y: number };
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface TrackingContext {
  prevPalmPos: { x: number; y: number };
  prevPinchDist: number;
  smoothedPinchDist: number;
  smoothedPalmPos: { x: number; y: number };
  initialized: boolean;
  fistStartTime: number | null;
  fistTriggered: boolean;
}

const CONFIG = {
  SMOOTHING_FACTOR: 0.2,
  ROTATION_SENSITIVITY: 3.4,
  PAN_SENSITIVITY: 5.0,
  ZOOM_SENSITIVITY: 15.0,
  DEAD_ZONE: 0.004,
  PINCH_THRESHOLD: 0.06,
  FIST_HOLD_MS: 1000,
} as const;

export function createInitialContext(): TrackingContext {
  return {
    prevPalmPos: { x: 0.5, y: 0.5 },
    prevPinchDist: 0,
    smoothedPinchDist: 0,
    smoothedPalmPos: { x: 0.5, y: 0.5 },
    initialized: false,
    fistStartTime: null,
    fistTriggered: false,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function dist3D(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function applyDeadZone(value: number, threshold: number): number {
  return Math.abs(value) < threshold ? 0 : value;
}

function palmCenter(lm: Point3D[]): { x: number; y: number } {
  const wrist = lm[0];
  const indexMcp = lm[5];
  const pinkyMcp = lm[17];
  return {
    x: 1 - (wrist.x + indexMcp.x + pinkyMcp.x) / 3, // Mirror for webcam
    y: (wrist.y + indexMcp.y + pinkyMcp.y) / 3,
  };
}

function isThumbExtended(lm: Point3D[]): boolean {
  // Compare thumb tip distance from wrist vs thumb MCP distance from wrist
  // More robust than Y comparison for varying hand orientations
  return dist3D(lm[4], lm[0]) > dist3D(lm[2], lm[0]);
}

function isFingerExtended(lm: Point3D[], tipIdx: number, mcpIdx: number): boolean {
  return lm[tipIdx].y < lm[mcpIdx].y;
}

function isFingerCurled(lm: Point3D[], tipIdx: number, mcpIdx: number): boolean {
  return lm[tipIdx].y > lm[mcpIdx].y;
}

function isPinching(lm: Point3D[]): boolean {
  return dist3D(lm[4], lm[8]) < CONFIG.PINCH_THRESHOLD;
}

function pinchDist(lm: Point3D[]): number {
  return dist3D(lm[4], lm[8]);
}

// Finger gun: thumb+index extended, middle/ring/pinky curled
function isFingerGun(lm: Point3D[]): boolean {
  return (
    isThumbExtended(lm) &&
    isFingerExtended(lm, 8, 5) &&    // index extended
    isFingerCurled(lm, 12, 9) &&     // middle curled
    isFingerCurled(lm, 16, 13) &&    // ring curled
    isFingerCurled(lm, 20, 17)       // pinky curled
  );
}

// Pinch + 3 open: thumb+index pinched, middle/ring/pinky extended
function isPinchThreeOpen(lm: Point3D[]): boolean {
  return (
    isPinching(lm) &&
    isFingerExtended(lm, 12, 9) &&   // middle extended
    isFingerExtended(lm, 16, 13) &&  // ring extended
    isFingerExtended(lm, 20, 17)     // pinky extended
  );
}

function isClosedFist(lm: Point3D[]): boolean {
  return (
    isFingerCurled(lm, 8, 5) &&
    isFingerCurled(lm, 12, 9) &&
    isFingerCurled(lm, 16, 13) &&
    isFingerCurled(lm, 20, 17)
  );
}

function pinchPoint(lm: Point3D[]): { x: number; y: number } {
  return {
    x: 1 - (lm[4].x + lm[8].x) / 2,
    y: (lm[4].y + lm[8].y) / 2,
  };
}

const IDLE_OUTPUT: GestureOutput = {
  state: "idle",
  rotationDelta: { x: 0, y: 0 },
  zoomDelta: 0,
  panOffset: { x: 0, y: 0 },
};

export function detectGesture(
  ctx: TrackingContext,
  allLandmarks: Array<Array<{ x: number; y: number; z: number }>>,
): { context: TrackingContext; output: GestureOutput } {
  if (allLandmarks.length === 0) {
    return {
      context: { ...ctx, initialized: false, fistStartTime: null, fistTriggered: false },
      output: IDLE_OUTPUT,
    };
  }

  const lm = allLandmarks[0];

  // Closed fist = reset (hold 1s)
  if (isClosedFist(lm)) {
    const now = Date.now();
    if (!ctx.fistStartTime) {
      return {
        context: { ...ctx, fistStartTime: now, fistTriggered: false, initialized: false },
        output: IDLE_OUTPUT,
      };
    }
    if (!ctx.fistTriggered && now - ctx.fistStartTime >= CONFIG.FIST_HOLD_MS) {
      return {
        context: { ...ctx, fistTriggered: true },
        output: { state: "reset", rotationDelta: { x: 0, y: 0 }, zoomDelta: 0, panOffset: { x: 0, y: 0 } },
      };
    }
    return { context: ctx, output: IDLE_OUTPUT };
  }

  // Reset fist timer if hand is not a fist
  const newCtx: TrackingContext = { ...ctx, fistStartTime: null, fistTriggered: false };

  // Finger gun = rotate (with embedded zoom via pinch distance)
  if (isFingerGun(lm)) {
    const pc = palmCenter(lm);
    const currentPinchDist = pinchDist(lm);
    const smoothed = {
      x: lerp(newCtx.smoothedPalmPos.x, pc.x, CONFIG.SMOOTHING_FACTOR),
      y: lerp(newCtx.smoothedPalmPos.y, pc.y, CONFIG.SMOOTHING_FACTOR),
    };
    const smoothedPinch = lerp(newCtx.smoothedPinchDist, currentPinchDist, CONFIG.SMOOTHING_FACTOR);

    if (!newCtx.initialized) {
      return {
        context: {
          ...newCtx,
          prevPalmPos: pc,
          smoothedPalmPos: pc,
          prevPinchDist: currentPinchDist,
          smoothedPinchDist: currentPinchDist,
          initialized: true,
        },
        output: { state: "orbit", rotationDelta: { x: 0, y: 0 }, zoomDelta: 0, panOffset: { x: 0, y: 0 } },
      };
    }

    const dx = applyDeadZone(smoothed.x - newCtx.prevPalmPos.x, CONFIG.DEAD_ZONE);
    const dy = applyDeadZone(smoothed.y - newCtx.prevPalmPos.y, CONFIG.DEAD_ZONE);
    const pinchDelta = applyDeadZone(smoothedPinch - newCtx.prevPinchDist, CONFIG.DEAD_ZONE * 0.5);

    return {
      context: {
        ...newCtx,
        prevPalmPos: smoothed,
        smoothedPalmPos: smoothed,
        prevPinchDist: smoothedPinch,
        smoothedPinchDist: smoothedPinch,
      },
      output: {
        state: "orbit",
        rotationDelta: {
          x: dy * CONFIG.ROTATION_SENSITIVITY,
          y: dx * CONFIG.ROTATION_SENSITIVITY,
        },
        zoomDelta: -pinchDelta * CONFIG.ZOOM_SENSITIVITY,
        panOffset: { x: 0, y: 0 },
      },
    };
  }

  // Pinch + 3 open fingers = pan
  if (isPinchThreeOpen(lm)) {
    const pp = pinchPoint(lm);
    const smoothed = {
      x: lerp(newCtx.smoothedPalmPos.x, pp.x, CONFIG.SMOOTHING_FACTOR),
      y: lerp(newCtx.smoothedPalmPos.y, pp.y, CONFIG.SMOOTHING_FACTOR),
    };

    if (!newCtx.initialized) {
      return {
        context: { ...newCtx, prevPalmPos: pp, smoothedPalmPos: pp, initialized: true },
        output: { state: "pan", rotationDelta: { x: 0, y: 0 }, zoomDelta: 0, panOffset: { x: 0, y: 0 } },
      };
    }

    const dx = applyDeadZone(smoothed.x - newCtx.prevPalmPos.x, CONFIG.DEAD_ZONE);
    const dy = applyDeadZone(smoothed.y - newCtx.prevPalmPos.y, CONFIG.DEAD_ZONE);

    return {
      context: { ...newCtx, prevPalmPos: smoothed, smoothedPalmPos: smoothed },
      output: {
        state: "pan",
        rotationDelta: { x: 0, y: 0 },
        zoomDelta: 0,
        panOffset: { x: dx * CONFIG.PAN_SENSITIVITY, y: -dy * CONFIG.PAN_SENSITIVITY },
      },
    };
  }

  // No recognized gesture
  return {
    context: { ...newCtx, initialized: false },
    output: IDLE_OUTPUT,
  };
}
