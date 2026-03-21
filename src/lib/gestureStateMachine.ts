import type {
  GestureState,
  GestureOutput,
  HandLandmarks,
  TrackingContext,
  Point3D,
} from "../types/gestures";
import { GESTURE_CONFIG } from "../types/gestures";

const { SMOOTHING_FACTOR, ROTATION_SENSITIVITY, ZOOM_SENSITIVITY,
        PAN_SENSITIVITY, DEAD_ZONE } = GESTURE_CONFIG;

export function createInitialContext(): TrackingContext {
  return {
    prevPalmPos: { x: 0.5, y: 0.5 },
    prevPinchDist: 0,
    smoothedPalmPos: { x: 0.5, y: 0.5 },
    smoothedPinchDist: 0,
    initialized: false,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function distance3D(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function applyDeadZone(value: number, threshold: number): number {
  return Math.abs(value) < threshold ? 0 : value;
}

/**
 * Palm center: centroid of wrist, index MCP, and pinky MCP.
 * X inverted for mirrored webcam.
 */
function palmCenter(landmarks: HandLandmarks): { x: number; y: number } {
  return {
    x: 1 - (landmarks.wrist.x + landmarks.indexMcp.x + landmarks.pinkyMcp.x) / 3,
    y: (landmarks.wrist.y + landmarks.indexMcp.y + landmarks.pinkyMcp.y) / 3,
  };
}

/**
 * Detect gesture mode from hand pose:
 *
 * ROTATE: finger gun (thumb+index extended, 3 curled) — palm movement rotates, pinch zooms
 * PAN:    pinch + 3 fingers open (thumb+index pinched, middle/ring/pinky extended) — hand movement pans
 * IDLE:   anything else
 */
export function detectPose(landmarks: HandLandmarks): GestureState {
  const indexExtended = landmarks.indexTip.y < landmarks.indexMcp.y;
  const thumbExtended = distance3D(landmarks.thumbTip, landmarks.wrist) >
                        distance3D(landmarks.thumbMcp, landmarks.wrist);
  const middleExtended = landmarks.middleTip.y < landmarks.middleMcp.y;
  const ringExtended = landmarks.ringTip.y < landmarks.ringMcp.y;
  const pinkyExtended = landmarks.pinkyTip.y < landmarks.pinkyMcp.y;
  const middleCurled = landmarks.middleTip.y > landmarks.middleMcp.y;
  const ringCurled = landmarks.ringTip.y > landmarks.ringMcp.y;
  const pinkyCurled = landmarks.pinkyTip.y > landmarks.pinkyMcp.y;

  const pinchDist = distance3D(landmarks.thumbTip, landmarks.indexTip);
  const isPinched = pinchDist < 0.06;

  // Rotate: finger gun — thumb+index extended, 3 curled
  if (thumbExtended && indexExtended && middleCurled && ringCurled && pinkyCurled) {
    return "rotate";
  }

  // Pan: pinch + 3 open — thumb+index pinched close, middle/ring/pinky extended
  if (isPinched && middleExtended && ringExtended && pinkyExtended) {
    return "pan";
  }

  return "idle";
}

const IDLE_OUTPUT: GestureOutput = {
  state: "idle",
  rotationDelta: { x: 0, y: 0 },
  zoomDelta: 0,
  panOffset: { x: 0, y: 0 },
};

export function processFrame(
  ctx: TrackingContext,
  landmarks: HandLandmarks
): { context: TrackingContext; output: GestureOutput } {
  const pose = detectPose(landmarks);

  if (pose === "idle") {
    return {
      context: { ...ctx, initialized: false },
      output: IDLE_OUTPUT,
    };
  }

  const rawPalmPos = palmCenter(landmarks);
  const rawPinchDist = distance3D(landmarks.thumbTip, landmarks.indexTip);

  // Smooth
  const smoothedPalmPos = {
    x: lerp(ctx.smoothedPalmPos.x, rawPalmPos.x, SMOOTHING_FACTOR),
    y: lerp(ctx.smoothedPalmPos.y, rawPalmPos.y, SMOOTHING_FACTOR),
  };
  const smoothedPinchDist = lerp(ctx.smoothedPinchDist, rawPinchDist, SMOOTHING_FACTOR);

  // First frame — seed with raw, no deltas
  if (!ctx.initialized) {
    return {
      context: {
        prevPalmPos: rawPalmPos,
        prevPinchDist: rawPinchDist,
        smoothedPalmPos: rawPalmPos,
        smoothedPinchDist: rawPinchDist,
        initialized: true,
      },
      output: { state: pose, rotationDelta: { x: 0, y: 0 }, zoomDelta: 0, panOffset: { x: 0, y: 0 } },
    };
  }

  const palmDelta = {
    x: applyDeadZone(smoothedPalmPos.x - ctx.prevPalmPos.x, DEAD_ZONE),
    y: applyDeadZone(smoothedPalmPos.y - ctx.prevPalmPos.y, DEAD_ZONE),
  };
  const pinchDelta = applyDeadZone(smoothedPinchDist - ctx.prevPinchDist, DEAD_ZONE * 0.5);

  let output: GestureOutput;

  if (pose === "rotate") {
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
    // Pan: palm movement → translate object
    output = {
      state: "pan",
      rotationDelta: { x: 0, y: 0 },
      zoomDelta: 0,
      panOffset: {
        x: palmDelta.x * PAN_SENSITIVITY,
        y: -palmDelta.y * PAN_SENSITIVITY,  // invert Y: MediaPipe Y-down → 3D Y-up
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
