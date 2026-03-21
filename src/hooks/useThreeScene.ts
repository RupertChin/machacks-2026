import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { GestureOutput } from "../types/gestures.ts";

interface UseThreeSceneOptions {
  gesture: GestureOutput;
}

export function useThreeScene({ gesture }: UseThreeSceneOptions) {
  const meshRef = useRef<Mesh>(null);
  const cameraZRef = useRef(5);

  useFrame(({ camera }) => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;

    // All channels applied simultaneously — no mode switching
    // Rotation from thumb-index midpoint movement
    mesh.rotation.x += gesture.rotationDelta.x;
    mesh.rotation.y += gesture.rotationDelta.y;

    // Zoom from thumb-index distance change (wider range for more dramatic zoom)
    cameraZRef.current = Math.max(1.5, Math.min(25, cameraZRef.current - gesture.zoomDelta));

    // Pan from wrist tilt
    mesh.position.x += gesture.panOffset.x;
    mesh.position.y += gesture.panOffset.y;

    // Smooth camera interpolation to target zoom
    camera.position.z += (cameraZRef.current - camera.position.z) * 0.1;
  });

  return { meshRef };
}
