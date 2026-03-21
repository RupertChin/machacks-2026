export type GestureState = "idle" | "rotate" | "pan";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarks {
  thumbTip: Point3D;    // landmark 4
  thumbIp: Point3D;     // landmark 3
  thumbMcp: Point3D;    // landmark 2
  indexTip: Point3D;    // landmark 8
  indexMcp: Point3D;    // landmark 5
  middleTip: Point3D;  // landmark 12
  middleMcp: Point3D;  // landmark 9
  ringTip: Point3D;    // landmark 16
  ringMcp: Point3D;    // landmark 13
  pinkyTip: Point3D;   // landmark 20
  pinkyMcp: Point3D;   // landmark 17
  wrist: Point3D;      // landmark 0
}

export interface GestureOutput {
  state: GestureState;
  rotationDelta: { x: number; y: number };
  zoomDelta: number;
  panOffset: { x: number; y: number };
}

export interface TrackingContext {
  prevPalmPos: { x: number; y: number };
  prevPinchDist: number;
  smoothedPalmPos: { x: number; y: number };
  smoothedPinchDist: number;
  initialized: boolean;
}

export const GESTURE_CONFIG = {
  SMOOTHING_FACTOR: 0.2,
  ROTATION_SENSITIVITY: 3.4,
  ZOOM_SENSITIVITY: 15.0,
  PAN_SENSITIVITY: 5.0,
  DEAD_ZONE: 0.004,
  ZOOM_MIN: 1.5,
  ZOOM_MAX: 25,
} as const;
