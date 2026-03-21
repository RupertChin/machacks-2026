import * as THREE from "three";

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private spherical: THREE.Spherical;

  // Default camera position
  private static DEFAULT_RADIUS = 86.6; // ~distance from [50,50,50] to origin
  private static DEFAULT_THETA = Math.PI / 4; // 45 degrees
  private static DEFAULT_PHI = Math.acos(50 / 86.6); // angle from Y axis

  private static MIN_RADIUS = 5;
  private static MAX_RADIUS = 500;
  private static MIN_PHI = 0.1; // avoid gimbal lock at poles
  private static MAX_PHI = Math.PI - 0.1;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.spherical = new THREE.Spherical();

    // Initialize spherical from camera position
    const offset = new THREE.Vector3().copy(camera.position).sub(this.target);
    this.spherical.setFromVector3(offset);
  }

  orbit(dTheta: number, dPhi: number): void {
    this.spherical.theta -= dTheta;
    this.spherical.phi -= dPhi;
    this.spherical.phi = THREE.MathUtils.clamp(
      this.spherical.phi,
      CameraController.MIN_PHI,
      CameraController.MAX_PHI
    );
    this.update();
  }

  pan(dx: number, dy: number): void {
    // Pan in camera-local screen plane
    const offset = new THREE.Vector3();
    const panUp = new THREE.Vector3();
    const panLeft = new THREE.Vector3();

    // Get camera right and up vectors
    panLeft.setFromMatrixColumn(this.camera.matrix, 0); // camera right
    panUp.setFromMatrixColumn(this.camera.matrix, 1); // camera up

    offset.addScaledVector(panLeft, -dx);
    offset.addScaledVector(panUp, dy);

    this.target.add(offset);
    this.update();
  }

  zoom(delta: number): void {
    this.spherical.radius += delta;
    this.spherical.radius = THREE.MathUtils.clamp(
      this.spherical.radius,
      CameraController.MIN_RADIUS,
      CameraController.MAX_RADIUS
    );
    this.update();
  }

  reset(animated: boolean = false): void {
    if (animated) {
      // Simple reset without animation for now
      this.target.set(0, 0, 0);
      this.spherical.radius = CameraController.DEFAULT_RADIUS;
      this.spherical.theta = CameraController.DEFAULT_THETA;
      this.spherical.phi = CameraController.DEFAULT_PHI;
      this.update();
    } else {
      this.target.set(0, 0, 0);
      this.spherical.radius = CameraController.DEFAULT_RADIUS;
      this.spherical.theta = CameraController.DEFAULT_THETA;
      this.spherical.phi = CameraController.DEFAULT_PHI;
      this.update();
    }
  }

  update(): void {
    const position = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(position.add(this.target));
    this.camera.lookAt(this.target);
  }
}
