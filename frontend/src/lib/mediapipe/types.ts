/**
 * Gesture recognition types for the MediaPipe hand-tracking system.
 *
 * MVP gestures (single hand only):
 *   - Finger gun (thumb+index extended, 3 curled) = rotate + zoom
 *   - Pinch + 3 open (thumb+index pinched, middle/ring/pinky extended) = pan
 */

// ── Geometry ────────────────────────────────────────────────────────

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

// ── Hand landmark subset used by the gesture detector ───────────────

export interface HandLandmarks {
  thumbTip: Point3D; // landmark 4
  thumbIp: Point3D; // landmark 3
  thumbMcp: Point3D; // landmark 2
  indexTip: Point3D; // landmark 8
  indexMcp: Point3D; // landmark 5
  middleTip: Point3D; // landmark 12
  middleMcp: Point3D; // landmark 9
  ringTip: Point3D; // landmark 16
  ringMcp: Point3D; // landmark 13
  pinkyTip: Point3D; // landmark 20
  pinkyMcp: Point3D; // landmark 17
  wrist: Point3D; // landmark 0
}

// ── Gesture state machine ───────────────────────────────────────────

/** Only three states: no gesture, rotating/zooming, or panning. */
export type GestureState = "idle" | "rotate" | "pan";

/** Per-frame output produced by the gesture detector for the camera controller. */
export interface GestureOutput {
  state: GestureState;
  rotationDelta: { x: number; y: number };
  zoomDelta: number;
  panOffset: { x: number; y: number };
}

// ── Tracking context (persisted across frames) ──────────────────────

/** Stores previous-frame values so deltas and smoothing can be computed. */
export interface TrackingContext {
  prevPalmPos: { x: number; y: number };
  prevPinchDist: number;
  smoothedPalmPos: { x: number; y: number };
  smoothedPinchDist: number;
  initialized: boolean;
}

// ── Tuning knobs ────────────────────────────────────────────────────

export const GESTURE_CONFIG = {
  /** EMA smoothing factor (0 = no smoothing, 1 = no memory). */
  SMOOTHING_FACTOR: 0.2,
  /** Multiplier for orbit (spherical camera at radius ~86 needs larger values). */
  ROTATION_SENSITIVITY: 12.0,
  /** Multiplier for zoom (radius change on spherical camera). */
  ZOOM_SENSITIVITY: 200.0,
  /** Multiplier for pan (target translation in world units). */
  PAN_SENSITIVITY: 60.0,
  /** Minimum delta before movement is registered (avoids jitter). */
  DEAD_ZONE: 0.004,
  /** Normalized thumb-index distance below which a "pinch" is detected. */
  PINCH_THRESHOLD: 0.06,
} as const;

// ── MediaPipe runtime configuration ─────────────────────────────────

export const MEDIAPIPE_CONFIG = {
  MODEL_URL:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  WASM_URL:
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  /** Single hand only — no two-hand gestures in the MVP. */
  NUM_HANDS: 1,
  MIN_DETECTION_CONFIDENCE: 0.7,
  MIN_PRESENCE_CONFIDENCE: 0.5,
  MIN_TRACKING_CONFIDENCE: 0.5,
} as const;

// ── Hand skeleton topology (for debug overlay drawing) ──────────────

/** MediaPipe hand bone connections — pairs of landmark indices. */
export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // Index finger
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // Middle finger
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  // Ring finger
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  // Pinky
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // Palm cross-connections
  [5, 9],
  [9, 13],
  [13, 17],
];
