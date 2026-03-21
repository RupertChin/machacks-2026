import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import * as THREE from "three";
import { createScene, startRenderLoop, stopRenderLoop, handleResize } from "@/lib/three/scene";
import { CameraController } from "@/lib/three/cameraController";

export interface ThreeCanvasHandle {
  addMesh(id: string, mesh: THREE.Mesh): void;
  removeMesh(id: string): void;
  getMesh(id: string): THREE.Mesh | undefined;
  getScene(): THREE.Scene | null;
  getCameraController(): CameraController | null;
  clearAll(): void;
}

export const ThreeCanvas = forwardRef<ThreeCanvasHandle>(function ThreeCanvas(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controllerRef = useRef<CameraController | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    container.appendChild(canvas);

    const { width, height } = container.getBoundingClientRect();
    const { scene, camera, renderer } = createScene(canvas, width, height);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controllerRef.current = new CameraController(camera);

    startRenderLoop(scene, camera, renderer);

    // ResizeObserver
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          handleResize(cameraRef.current, rendererRef.current, w, h);
        }
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      stopRenderLoop();
      // Cleanup meshes
      meshMapRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
      });
      meshMapRef.current.clear();
      renderer.dispose();
      container.removeChild(canvas);
    };
  }, []);

  const addMesh = useCallback((id: string, mesh: THREE.Mesh) => {
    const existing = meshMapRef.current.get(id);
    if (existing && sceneRef.current) {
      existing.geometry.dispose();
      if (existing.material instanceof THREE.Material) {
        existing.material.dispose();
      }
      sceneRef.current.remove(existing);
    }
    meshMapRef.current.set(id, mesh);
    sceneRef.current?.add(mesh);
  }, []);

  const removeMesh = useCallback((id: string) => {
    const mesh = meshMapRef.current.get(id);
    if (mesh && sceneRef.current) {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
      sceneRef.current.remove(mesh);
      meshMapRef.current.delete(id);
    }
  }, []);

  const clearAll = useCallback(() => {
    meshMapRef.current.forEach((mesh) => {
      if (sceneRef.current) {
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose();
        }
        sceneRef.current.remove(mesh);
      }
    });
    meshMapRef.current.clear();
  }, []);

  useImperativeHandle(ref, () => ({
    addMesh,
    removeMesh,
    getMesh: (id: string) => meshMapRef.current.get(id),
    getScene: () => sceneRef.current,
    getCameraController: () => controllerRef.current,
    clearAll,
  }));

  return <div ref={containerRef} className="absolute inset-0" />;
});
