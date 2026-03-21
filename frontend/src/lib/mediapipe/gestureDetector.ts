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
  prevTwoHandDist: number;
  smoothedPalmPos: { x: number; y: number };
  initialized: boolean;
  fistStartTime: number | null;
  fistTriggered: boolean;
}

const CONFIG = {
  SMOOTHING_FACTOR: 0.25,
  ORBIT_SENSITIVITY: 3.0,
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
    prevTwoHandDist: 0,
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

function isFingerExtended(lm: Point3D[], tipIdx: number, mcpIdx: number): boolean {
  return lm[tipIdx].y < lm[mcpIdx].y;
}

function isFingerCurled(lm: Point3D[], tipIdx: number, mcpIdx: number): boolean {
  return lm[tipIdx].y > lm[mcpIdx].y;
}

function isPinching(lm: Point3D[]): boolean {
  return dist3D(lm[4], lm[8]) < CONFIG.PINCH_THRESHOLD;
}

function isOpenPalm(lm: Point3D[]): boolean {
  return (
    isFingerExtended(lm, 8, 5) &&   // index
    isFingerExtended(lm, 12, 9) &&  // middle
    isFingerExtended(lm, 16, 13) && // ring
    isFingerExtended(lm, 20, 17)    // pinky
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
  const handCount = allLandmarks.length;

  if (handCount === 0) {
    return {
      context: { ...ctx, initialized: false, fistStartTime: null, fistTriggered: false },
      output: IDLE_OUTPUT,
    };
  }

  const lm1 = allLandmarks[0];

  // Two-hand zoom detection
  if (handCount >= 2) {
    const lm2 = allLandmarks[1];
    if (isPinching(lm1) && isPinching(lm2)) {
      const p1 = pinchPoint(lm1);
      const p2 = pinchPoint(lm2);
      const currentDist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

      if (!ctx.initialized) {
        return {
          context: {
            ...ctx,
            prevTwoHandDist: currentDist,
            initialized: true,
            fistStartTime: null,
            fistTriggered: false,
          },
          output: { state: "zoom", rotationDelta: { x: 0, y: 0 }, zoomDelta: 0, panOffset: { x: 0, y: 0 } },
        };
      }

      const distDelta = applyDeadZone(currentDist - ctx.prevTwoHandDist, CONFIG.DEAD_ZONE * 0.5);
      return {
        context: { ...ctx, prevTwoHandDist: currentDist },
        output: {
          state: "zoom",
          rotationDelta: { x: 0, y: 0 },
          zoomDelta: -distDelta * CONFIG.ZOOM_SENSITIVITY,
          panOffset: { x: 0, y: 0 },
        },
      };
    }
  }

  // Single hand gestures
  // Closed fist = reset (hold 1s)
  if (isClosedFist(lm1)) {
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

  // Pinch = pan
  if (isPinching(lm1)) {
    const pp = pinchPoint(lm1);
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

  // Open palm = orbit
  if (isOpenPalm(lm1)) {
    const pc = palmCenter(lm1);
    const smoothed = {
      x: lerp(newCtx.smoothedPalmPos.x, pc.x, CONFIG.SMOOTHING_FACTOR),
      y: lerp(newCtx.smoothedPalmPos.y, pc.y, CONFIG.SMOOTHING_FACTOR),
    };

    if (!newCtx.initialized) {
      return {
        context: { ...newCtx, prevPalmPos: pc, smoothedPalmPos: pc, initialized: true },
        output: { state: "orbit", rotationDelta: { x: 0, y: 0 }, zoomDelta: 0, panOffset: { x: 0, y: 0 } },
      };
    }

    const dx = applyDeadZone(smoothed.x - newCtx.prevPalmPos.x, CONFIG.DEAD_ZONE);
    const dy = applyDeadZone(smoothed.y - newCtx.prevPalmPos.y, CONFIG.DEAD_ZONE);

    return {
      context: { ...newCtx, prevPalmPos: smoothed, smoothedPalmPos: smoothed },
      output: {
        state: "orbit",
        rotationDelta: {
          x: dy * CONFIG.ORBIT_SENSITIVITY,
          y: dx * CONFIG.ORBIT_SENSITIVITY,
        },
        zoomDelta: 0,
        panOffset: { x: 0, y: 0 },
      },
    };
  }

  // No recognized gesture
  return {
    context: { ...newCtx, initialized: false },
    output: IDLE_OUTPUT,
  };
}
