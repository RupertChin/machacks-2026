/**
 * Gesture detector — pure-functional module for classifying hand poses
 * and computing per-frame camera control deltas.
 *
 * Ported from the MVP's gestureStateMachine.ts. No React, no side effects.
 *
 * MVP gestures (single hand):
 *   Finger gun (thumb+index extended, 3 curled) -> rotate (palm delta) + zoom (pinch delta)
 *   Pinch + 3 open (thumb+index pinched, 3 extended) -> pan (palm delta)
 *   Everything else -> idle
 */
import type {
  GestureState,
  GestureOutput,
  HandLandmarks,
  TrackingContext,
  Point3D,
} from "./types.ts";
import { GESTURE_CONFIG } from "./types.ts";

const {
  SMOOTHING_FACTOR,
  ROTATION_SENSITIVITY,
  ZOOM_SENSITIVITY,
  PAN_SENSITIVITY,
  DEAD_ZONE,
  PINCH_THRESHOLD,
} = GESTURE_CONFIG;

// ── Helpers ──────────────────────────────────────────────────────────

/** Linear interpolation between a and b by factor t. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 3D euclidean distance between two points. */
function distance3D(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Soft dead zone — values below the threshold are zeroed, values above
 * ramp up smoothly by subtracting the threshold (avoids a discontinuous
 * jump at the boundary).
 */
function applyDeadZone(value: number, threshold: number): number {
  const abs = Math.abs(value);
  if (abs < threshold) return 0;
  // Subtract threshold so there's no discontinuity when crossing the boundary
  return Math.sign(value) * (abs - threshold);
}

/**
 * Compute the palm center as the centroid of wrist, indexMcp, and pinkyMcp.
 * X is inverted because the webcam feed is mirrored.
 */
function palmCenter(landmarks: HandLandmarks): { x: number; y: number } {
  return {
    x:
      1 -
      (landmarks.wrist.x + landmarks.indexMcp.x + landmarks.pinkyMcp.x) / 3,
    y: (landmarks.wrist.y + landmarks.indexMcp.y + landmarks.pinkyMcp.y) / 3,
  };
}

// ── Public API ───────────────────────────────────────────────────────

/** Factory for a fresh TrackingContext (no prior frame data). */
export function createInitialContext(): TrackingContext {
  return {
    prevPalmPos: { x: 0.5, y: 0.5 },
    prevPinchDist: 0,
    smoothedPalmPos: { x: 0.5, y: 0.5 },
    smoothedPinchDist: 0,
    initialized: false,
  };
}

/**
 * Classify the current hand pose into a GestureState.
 *
 * Rotate (finger gun): thumb extended, index extended, middle/ring/pinky curled, NOT pinched
 * Pan (pinch + 3 open): thumb+index pinched together, middle/ring/pinky extended
 * Idle: everything else
 */
export function detectPose(landmarks: HandLandmarks): GestureState {
  // Thumb is extended if its tip is farther from the wrist than its MCP joint
  const thumbExtended =
    distance3D(landmarks.thumbTip, landmarks.wrist) >
    distance3D(landmarks.thumbMcp, landmarks.wrist);

  // Fingers extended when tip is above (lower y) than MCP in screen coords
  const indexExtended = landmarks.indexTip.y < landmarks.indexMcp.y;
  const middleExtended = landmarks.middleTip.y < landmarks.middleMcp.y;
  const ringExtended = landmarks.ringTip.y < landmarks.ringMcp.y;
  const pinkyExtended = landmarks.pinkyTip.y < landmarks.pinkyMcp.y;

  // Fingers curled when tip is below (higher y) than MCP
  const middleCurled = landmarks.middleTip.y > landmarks.middleMcp.y;
  const ringCurled = landmarks.ringTip.y > landmarks.ringMcp.y;
  const pinkyCurled = landmarks.pinkyTip.y > landmarks.pinkyMcp.y;

  const pinchDist = distance3D(landmarks.thumbTip, landmarks.indexTip);
  const isPinched = pinchDist < PINCH_THRESHOLD;

  // Rotate: finger gun — thumb+index extended, 3 curled, NOT pinching
  if (
    thumbExtended &&
    indexExtended &&
    middleCurled &&
    ringCurled &&
    pinkyCurled &&
    !isPinched
  ) {
    return "rotate";
  }

  // Pan: pinch + 3 open — thumb+index pinched, middle/ring/pinky extended
  if (isPinched && middleExtended && ringExtended && pinkyExtended) {
    return "pan";
  }

  return "idle";
}

/** Constant output for the idle state (all zeros). */
const IDLE_OUTPUT: GestureOutput = {
  state: "idle",
  rotationDelta: { x: 0, y: 0 },
  zoomDelta: 0,
  panOffset: { x: 0, y: 0 },
};

/**
 * Full per-frame processing: classify pose, apply EMA smoothing,
 * compute deltas with dead zones, and return the new context + output.
 *
 * This is a pure function — takes context in, returns new context out.
 * The caller is responsible for persisting the context between frames.
 */
export function processFrame(
  ctx: TrackingContext,
  landmarks: HandLandmarks,
): { context: TrackingContext; output: GestureOutput } {
  const pose = detectPose(landmarks);

  // When idle, reset initialization so the next active gesture starts clean
  if (pose === "idle") {
    return {
      context: { ...ctx, initialized: false },
      output: IDLE_OUTPUT,
    };
  }

  const rawPalmPos = palmCenter(landmarks);
  const rawPinchDist = distance3D(landmarks.thumbTip, landmarks.indexTip);

  // EMA smoothing — blend current raw values toward previous smoothed values
  const smoothedPalmPos = {
    x: lerp(ctx.smoothedPalmPos.x, rawPalmPos.x, SMOOTHING_FACTOR),
    y: lerp(ctx.smoothedPalmPos.y, rawPalmPos.y, SMOOTHING_FACTOR),
  };
  const smoothedPinchDist = lerp(
    ctx.smoothedPinchDist,
    rawPinchDist,
    SMOOTHING_FACTOR,
  );

  // First active frame — seed tracking state with raw values, emit zero deltas
  // to avoid a huge initial jump (anti-drift on gesture start)
  if (!ctx.initialized) {
    return {
      context: {
        prevPalmPos: rawPalmPos,
        prevPinchDist: rawPinchDist,
        smoothedPalmPos: rawPalmPos,
        smoothedPinchDist: rawPinchDist,
        initialized: true,
      },
      output: {
        state: pose,
        rotationDelta: { x: 0, y: 0 },
        zoomDelta: 0,
        panOffset: { x: 0, y: 0 },
      },
    };
  }

  // Compute deltas with soft dead zones to filter jitter
  const palmDelta = {
    x: applyDeadZone(
      smoothedPalmPos.x - ctx.prevPalmPos.x,
      DEAD_ZONE,
    ),
    y: applyDeadZone(
      smoothedPalmPos.y - ctx.prevPalmPos.y,
      DEAD_ZONE,
    ),
  };
  const pinchDelta = applyDeadZone(
    smoothedPinchDist - ctx.prevPinchDist,
    DEAD_ZONE * 0.5,
  );

  let output: GestureOutput;

  if (pose === "rotate") {
    // Palm movement -> orbit rotation, pinch distance change -> zoom
    // Note: palmDelta.y maps to rotationDelta.x (pitch) and vice versa
    output = {
      state: "rotate",
      rotationDelta: {
        x: palmDelta.y * ROTATION_SENSITIVITY,
        y: palmDelta.x * ROTATION_SENSITIVITY,
      },
      zoomDelta: pinchDelta * ZOOM_SENSITIVITY,
      panOffset: { x: 0, y: 0 },
    };
  } else {
    // Pan: palm movement -> world-space translation
    // Y is inverted: MediaPipe Y points down, 3D world Y points up
    output = {
      state: "pan",
      rotationDelta: { x: 0, y: 0 },
      zoomDelta: 0,
      panOffset: {
        x: palmDelta.x * PAN_SENSITIVITY,
        y: -palmDelta.y * PAN_SENSITIVITY,
      },
    };
  }

  return {
    context: {
      prevPalmPos: smoothedPalmPos,
      prevPinchDist: smoothedPinchDist,
      smoothedPalmPos,
      smoothedPinchDist,
      initialized: true,
    },
    output,
  };
}
