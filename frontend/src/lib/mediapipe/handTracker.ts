/**
 * HandTracker — plain class wrapping MediaPipe HandLandmarker.
 *
 * Extracted from the MVP's useHandTracking hook so it can be reused
 * outside React (e.g. in a Web Worker or integration tests).
 */
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_CONFIG, type HandLandmarks } from "./types.ts";

export interface HandTrackingResult {
  /** Parsed subset of landmarks used by the gesture detector. */
  landmarks: HandLandmarks;
  /** Full 21-landmark array from MediaPipe, useful for debug overlays. */
  rawLandmarks: { x: number; y: number; z: number }[];
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;

  /**
   * Initialize the MediaPipe HandLandmarker.
   * Downloads the WASM runtime and model on first call.
   */
  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      MEDIAPIPE_CONFIG.WASM_URL,
    );
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_CONFIG.MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: MEDIAPIPE_CONFIG.NUM_HANDS,
      minHandDetectionConfidence: MEDIAPIPE_CONFIG.MIN_DETECTION_CONFIDENCE,
      minHandPresenceConfidence: MEDIAPIPE_CONFIG.MIN_PRESENCE_CONFIDENCE,
      minTrackingConfidence: MEDIAPIPE_CONFIG.MIN_TRACKING_CONFIDENCE,
    });
  }

  /**
   * Process a single video frame and return detected hand landmarks.
   *
   * Returns `null` when:
   * - The landmarker hasn't been initialized yet
   * - The video element isn't ready (readyState < 2)
   * - No hand is detected in the frame
   */
  processFrame(
    video: HTMLVideoElement,
    timestampMs: number,
  ): HandTrackingResult | null {
    if (!this.landmarker || video.readyState < 2) return null;

    const results = this.landmarker.detectForVideo(video, timestampMs);

    if (!results.landmarks || results.landmarks.length === 0) return null;

    const lm = results.landmarks[0];

    return {
      landmarks: {
        thumbTip: lm[4],
        thumbIp: lm[3],
        thumbMcp: lm[2],
        indexTip: lm[8],
        indexMcp: lm[5],
        middleTip: lm[12],
        middleMcp: lm[9],
        ringTip: lm[16],
        ringMcp: lm[13],
        pinkyTip: lm[20],
        pinkyMcp: lm[17],
        wrist: lm[0],
      },
      rawLandmarks: lm,
    };
  }

  /** Clean up MediaPipe resources. Safe to call multiple times. */
  destroy(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
