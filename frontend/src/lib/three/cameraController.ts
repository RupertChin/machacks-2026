/**
 * Spherical-coordinate orbital camera controller (plain Three.js).
 *
 * The camera orbits around a movable target point. Spherical coordinates
 * (theta, phi, radius) are converted to cartesian each frame.
 *
 * Default view: position [50, 50, 50] looking at the origin.
 */

import * as THREE from "three";

export class CameraController {
  private theta: number;
  private phi: number;
  private radius: number;
  private target: THREE.Vector3;

  // ── Reset animation state ───────────────────────────────────────

  private isResetting = false;
  private resetStartTime = 0;
  private resetDuration = 1000; // ms
  private resetStartTheta = 0;
  private resetStartPhi = 0;
  private resetStartRadius = 0;
  private resetStartTarget = new THREE.Vector3();

  // ── Default spherical coordinates for [50, 50, 50] → origin ────

  // radius = sqrt(50^2 + 50^2 + 50^2) ≈ 86.60
  private static DEFAULT_RADIUS = Math.sqrt(50 * 50 + 50 * 50 + 50 * 50);
  // theta = atan2(z, x) = atan2(50, 50) ≈ 0.785 rad (45°)
  private static DEFAULT_THETA = Math.atan2(50, 50);
  // phi = acos(y / r) ≈ acos(50 / 86.6) ≈ 0.955 rad (54.7°)
  private static DEFAULT_PHI = Math.acos(
    50 / CameraController.DEFAULT_RADIUS
  );

  constructor() {
    this.theta = CameraController.DEFAULT_THETA;
    this.phi = CameraController.DEFAULT_PHI;
    this.radius = CameraController.DEFAULT_RADIUS;
    this.target = new THREE.Vector3(0, 0, 0);
  }

  // ── Public API ──────────────────────────────────────────────────

  /** Adjust theta/phi based on gesture palm-movement delta. */
  orbit(dx: number, dy: number): void {
    if (this.isResetting) return;
    this.theta -= dx;
    this.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.phi - dy));
  }

  /** Translate the camera target in the screen-local plane. */
  pan(dx: number, dy: number): void {
    if (this.isResetting) return;

    // Derive the camera's right and up vectors from the current spherical coords
    // so we can pan in screen-space without needing a camera reference.
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    // Forward direction (camera → target, in world space)
    const forward = new THREE.Vector3(
      sinPhi * cosTheta,
      cosPhi,
      sinPhi * sinTheta
    ).normalize();

    // Right = forward × world-up
    const right = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();

    // Up = right × forward  (screen-local "up")
    const up = new THREE.Vector3()
      .crossVectors(right, forward)
      .normalize();

    this.target.addScaledVector(right, dx);
    this.target.addScaledVector(up, -dy);
  }

  /** Adjust radius (distance from target). Clamped to [5, 500]. */
  zoom(delta: number): void {
    if (this.isResetting) return;
    this.radius = Math.max(5, Math.min(500, this.radius - delta));
  }

  /** Smoothly animate back to the default view. */
  reset(): void {
    this.isResetting = true;
    this.resetStartTime = performance.now();
    this.resetStartTheta = this.theta;
    this.resetStartPhi = this.phi;
    this.resetStartRadius = this.radius;
    this.resetStartTarget.copy(this.target);
  }

  /**
   * Apply the current (or animating) spherical coordinates to a Three.js
   * PerspectiveCamera. Call once per frame before rendering.
   */
  update(camera: THREE.PerspectiveCamera): void {
    if (this.isResetting) {
      const elapsed = performance.now() - this.resetStartTime;
      const t = Math.min(1, elapsed / this.resetDuration);
      // Ease-out cubic for a smooth deceleration
      const ease = 1 - Math.pow(1 - t, 3);

      this.theta =
        this.resetStartTheta +
        (CameraController.DEFAULT_THETA - this.resetStartTheta) * ease;
      this.phi =
        this.resetStartPhi +
        (CameraController.DEFAULT_PHI - this.resetStartPhi) * ease;
      this.radius =
        this.resetStartRadius +
        (CameraController.DEFAULT_RADIUS - this.resetStartRadius) * ease;
      this.target.lerpVectors(
        this.resetStartTarget,
        new THREE.Vector3(0, 0, 0),
        ease
      );

      if (t >= 1) this.isResetting = false;
    }

    // Spherical → cartesian
    const x = this.radius * Math.sin(this.phi) * Math.cos(this.theta);
    const y = this.radius * Math.cos(this.phi);
    const z = this.radius * Math.sin(this.phi) * Math.sin(this.theta);

    camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z
    );
    camera.lookAt(this.target);
  }
}
