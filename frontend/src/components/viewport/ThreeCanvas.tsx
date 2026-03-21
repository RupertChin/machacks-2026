/**
 * Three.js canvas component.
 *
 * Mounts the Three.js renderer on a `<canvas>` element, creates the scene
 * and camera controller, and owns the animation loop.  The CameraController
 * instance is surfaced to the parent via `cameraControllerRef` so that the
 * gesture hook can drive orbit/pan/zoom without re-rendering this component.
 */

import { useEffect, useRef } from "react";
import { createScene } from "@/lib/three/scene";
import { CameraController } from "@/lib/three/cameraController";

// ── Props ───────────────────────────────────────────────────────────

interface ThreeCanvasProps {
  cameraControllerRef: React.MutableRefObject<CameraController | null>;
}

// ── Component ───────────────────────────────────────────────────────

export function ThreeCanvas({ cameraControllerRef }: ThreeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Bootstrap the Three.js scene, renderer, camera, lights, grid
    const { scene, camera, renderer, dispose } = createScene(canvas);

    // Create the spherical camera controller and expose it to the parent
    const controller = new CameraController();
    cameraControllerRef.current = controller;

    // ── Render loop ──────────────────────────────────────────────
    let frameId: number;

    function animate() {
      // Apply the current (or animating-reset) spherical coords to the camera
      controller.update(camera);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);

    // ── Cleanup ──────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameId);
      cameraControllerRef.current = null;
      dispose();
    };
  }, [cameraControllerRef]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
