import { useEffect } from "react";
import type { CameraController } from "@/lib/three/cameraController";

interface GestureControllerProps {
  cameraController: CameraController | null;
  gestureOutput: {
    state: string;
    rotationDelta: { x: number; y: number };
    zoomDelta: number;
    panOffset: { x: number; y: number };
  } | null;
  suppressCamera?: boolean;
}

export function GestureController({ cameraController, gestureOutput, suppressCamera }: GestureControllerProps) {
  useEffect(() => {
    if (!cameraController || !gestureOutput || suppressCamera) return;

    if (gestureOutput.state === "rotate" || gestureOutput.state === "orbit") {
      cameraController.orbit(gestureOutput.rotationDelta.y, gestureOutput.rotationDelta.x);
      if (gestureOutput.zoomDelta !== 0) {
        cameraController.zoom(gestureOutput.zoomDelta);
      }
    } else if (gestureOutput.state === "pan") {
      cameraController.pan(gestureOutput.panOffset.x, gestureOutput.panOffset.y);
    } else if (gestureOutput.state === "zoom") {
      cameraController.zoom(gestureOutput.zoomDelta);
    } else if (gestureOutput.state === "reset") {
      cameraController.reset();
    }
  }, [cameraController, gestureOutput]);

  return null;
}
