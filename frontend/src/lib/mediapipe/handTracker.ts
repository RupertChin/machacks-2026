import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let handLandmarker: HandLandmarker | null = null;

export async function initHandTracker(): Promise<HandLandmarker> {
  if (handLandmarker) return handLandmarker;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.7,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return handLandmarker;
}

export function detectForVideo(
  video: HTMLVideoElement,
  timestamp: number,
): { landmarks: Array<Array<{ x: number; y: number; z: number }>> } | null {
  if (!handLandmarker || video.readyState < 2) return null;

  try {
    const results = handLandmarker.detectForVideo(video, timestamp);
    return {
      landmarks: results.landmarks || [],
    };
  } catch {
    return null;
  }
}

export function closeHandTracker(): void {
  handLandmarker?.close();
  handLandmarker = null;
}
