export type GestureState = "idle" | "orbit" | "pan" | "zoom" | "reset" | "recording";

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
  // Debounce: require N consecutive frames before committing a state transition
  pendingState: GestureState;
  pendingFrameCount: number;
  confirmedState: GestureState;
}

const CONFIG = {
  SMOOTHING_FACTOR: 0.2,
  ROTATION_SENSITIVITY: 3.4,
  PAN_SENSITIVITY: 5.0,
  ZOOM_SENSITIVITY: 80.0,
  DEAD_ZONE: 0.004,
  PINCH_THRESHOLD: 0.06,
  FIST_HOLD_MS: 1000,
  THUMB_EXTENSION_RATIO: 1.3,
  DEBOUNCE_ENTER_FRAMES: 3,
  DEBOUNCE_EXIT_FRAMES: 4,
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
    pendingState: "idle",
    pendingFrameCount: 0,
    confirmedState: "idle",
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
  // Thumb tip must be significantly farther from wrist than thumb MCP —
  // a 1.3x ratio filters out the naturally resting thumb position
  return dist3D(lm[4], lm[0]) > dist3D(lm[2], lm[0]) * CONFIG.THUMB_EXTENSION_RATIO;
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

// Index finger raised: only index extended, middle/ring/pinky curled (thumb ignored — too finicky)
function isIndexRaised(lm: Point3D[]): boolean {
  return (
    isFingerExtended(lm, 8, 5) &&    // index extended
    isFingerCurled(lm, 12, 9) &&     // middle curled
    isFingerCurled(lm, 16, 13) &&    // ring curled
    isFingerCurled(lm, 20, 17)       // pinky curled
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

function detectRawGesture(
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

  // Finger gun = rotate (thumb+index extended, others curled — checked before index raised since it's more specific)
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

  // Index finger raised = push-to-talk recording (only index up, regardless of thumb)
  if (isIndexRaised(lm)) {
    return {
      context: { ...newCtx, initialized: false },
      output: { state: "recording", rotationDelta: { x: 0, y: 0 }, zoomDelta: 0, panOffset: { x: 0, y: 0 } },
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

export function detectGesture(
  ctx: TrackingContext,
  allLandmarks: Array<Array<{ x: number; y: number; z: number }>>,
): { context: TrackingContext; output: GestureOutput } {
  const { context: rawCtx, output: rawOutput } = detectRawGesture(ctx, allLandmarks);
  const rawState = rawOutput.state;

  // Count consecutive frames of the same raw state
  let pendingState = rawCtx.pendingState;
  let pendingFrameCount = rawCtx.pendingFrameCount;
  if (rawState === pendingState) {
    pendingFrameCount++;
  } else {
    pendingState = rawState;
    pendingFrameCount = 1;
  }

  // Determine threshold: exiting "recording" is stickier to avoid false stops
  let confirmedState = rawCtx.confirmedState;
  const isExitingRecording = confirmedState === "recording" && rawState !== "recording";
  const threshold = isExitingRecording
    ? CONFIG.DEBOUNCE_EXIT_FRAMES
    : CONFIG.DEBOUNCE_ENTER_FRAMES;

  if (pendingFrameCount >= threshold) {
    confirmedState = rawState;
  }

  return {
    context: { ...rawCtx, pendingState, pendingFrameCount, confirmedState },
    // Use raw movement deltas but override state with debounced version
    output: { ...rawOutput, state: confirmedState },
  };
}
