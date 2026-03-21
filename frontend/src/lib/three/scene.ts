/**
 * Three.js scene factory (spec section 3.3).
 *
 * Creates the core rendering triad (scene, camera, renderer) along with
 * lighting and a reference grid. Uses plain Three.js — no React Three Fiber.
 */

import * as THREE from "three";

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
}

/**
 * Bootstrap a Three.js scene attached to the given `<canvas>` element.
 *
 * - Transparent background (alpha: true)
 * - Ambient light (0.4) + key directional (0.8) + fill directional (0.3)
 * - XZ grid 100 x 100, 10 divisions, subtle grey
 * - Small axes helper
 * - Perspective camera, FOV 50, positioned at [50, 50, 50]
 */
export function createScene(canvas: HTMLCanvasElement): SceneBundle {
  // ── Renderer ──────────────────────────────────────────────────

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  // ── Scene ─────────────────────────────────────────────────────

  const scene = new THREE.Scene();

  // ── Camera ────────────────────────────────────────────────────

  const camera = new THREE.PerspectiveCamera(
    50,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    2000
  );
  camera.position.set(50, 50, 50);
  camera.lookAt(0, 0, 0);

  // ── Lights ────────────────────────────────────────────────────

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(10, 10, 10);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 5, -5);
  scene.add(fillLight);

  // ── Grid (XZ plane) ──────────────────────────────────────────

  const grid = new THREE.GridHelper(100, 10, 0x555555, 0x333333);
  scene.add(grid);

  // ── Axes helper ──────────────────────────────────────────────

  const axes = new THREE.AxesHelper(5);
  scene.add(axes);

  // ── Test cube (temporary — remove once JSCAD pipeline is wired) ──

  const testGeo = new THREE.BoxGeometry(10, 10, 10);
  const testMat = new THREE.MeshStandardMaterial({ color: "#4488ff" });
  const testCube = new THREE.Mesh(testGeo, testMat);
  testCube.position.set(0, 5, 0); // sit on the grid
  scene.add(testCube);

  // ── Resize handling ──────────────────────────────────────────

  const onResize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  };

  // Use ResizeObserver for responsive canvas sizing
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(canvas);

  // ── Cleanup ──────────────────────────────────────────────────

  const dispose = () => {
    resizeObserver.disconnect();
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  };

  return { scene, camera, renderer, dispose };
}
