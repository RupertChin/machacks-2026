import * as THREE from "three";

export interface SceneSetup {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

export function createScene(canvas: HTMLCanvasElement, width: number, height: number): SceneSetup {
  // Scene
  const scene = new THREE.Scene();

  // Camera: PerspectiveCamera, FOV 50, positioned at [50,50,50] looking at origin
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);
  camera.position.set(50, 50, 50);
  camera.lookAt(0, 0, 0);

  // Renderer: WebGLRenderer with antialiasing, devicePixelRatio
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  // Lighting: ambient (0.4) + key directional (0.8 at [10,10,10]) + fill directional (0.3 at [-5,5,-5])
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(10, 10, 10);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 5, -5);
  scene.add(fillLight);

  // Grid: XZ plane, 100x100, 10-unit divisions
  const grid = new THREE.GridHelper(100, 10, 0x444444, 0x222222);
  scene.add(grid);

  // Axes helper
  const axes = new THREE.AxesHelper(5);
  scene.add(axes);

  return { scene, camera, renderer };
}

let animationId: number | null = null;

export function startRenderLoop(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void {
  function render() {
    animationId = requestAnimationFrame(render);
    renderer.render(scene, camera);
  }
  render();
}

export function stopRenderLoop(): void {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

export function handleResize(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, width: number, height: number): void {
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
