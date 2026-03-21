/**
 * Tests for the gesture detector module.
 *
 * Uses synthetic landmark data to verify pose classification and
 * per-frame delta computation without a real camera or MediaPipe model.
 */
import { describe, it, expect } from "vitest";
import {
  createInitialContext,
  processFrame,
  detectPose,
} from "../gestureDetector.ts";
import type { HandLandmarks } from "../types.ts";

// ── Test Fixtures ────────────────────────────────────────────────────

/**
 * Finger gun pose — thumb+index extended, middle/ring/pinky curled.
 * `pinchDist` controls the distance between thumb and index tips.
 * `handX`/`handY` shift the entire hand position for movement tests.
 */
function makeRotateLandmarks(
  pinchDist: number,
  handX = 0.5,
  handY = 0.5,
): HandLandmarks {
  return {
    thumbTip: { x: handX - pinchDist / 2, y: handY - 0.15, z: 0 },
    thumbIp: { x: handX - pinchDist / 4, y: handY - 0.1, z: 0 },
    thumbMcp: { x: handX - 0.02, y: handY, z: 0 },
    indexTip: { x: handX + pinchDist / 2, y: handY - 0.15, z: 0 },
    indexMcp: { x: handX + 0.05, y: handY, z: 0 },
    // Middle, ring, pinky curled: tip.y > mcp.y
    middleTip: { x: handX + 0.03, y: handY + 0.05, z: 0 },
    middleMcp: { x: handX + 0.03, y: handY, z: 0 },
    ringTip: { x: handX + 0.01, y: handY + 0.05, z: 0 },
    ringMcp: { x: handX + 0.01, y: handY, z: 0 },
    pinkyTip: { x: handX - 0.01, y: handY + 0.05, z: 0 },
    pinkyMcp: { x: handX - 0.01, y: handY, z: 0 },
    wrist: { x: handX, y: handY + 0.2, z: 0 },
  };
}

/**
 * Pinch + 3 open pose — thumb+index pinched close together,
 * middle/ring/pinky extended (tips above MCPs).
 */
function makePanLandmarks(handX = 0.5, handY = 0.5): HandLandmarks {
  return {
    thumbTip: { x: handX + 0.01, y: handY, z: 0 },
    thumbIp: { x: handX, y: handY - 0.02, z: 0 },
    thumbMcp: { x: handX - 0.02, y: handY + 0.05, z: 0 },
    indexTip: { x: handX + 0.02, y: handY, z: 0 },
    indexMcp: { x: handX + 0.05, y: handY + 0.05, z: 0 },
    // Middle, ring, pinky extended: tip.y < mcp.y
    middleTip: { x: handX + 0.03, y: handY - 0.15, z: 0 },
    middleMcp: { x: handX + 0.03, y: handY, z: 0 },
    ringTip: { x: handX + 0.01, y: handY - 0.15, z: 0 },
    ringMcp: { x: handX + 0.01, y: handY, z: 0 },
    pinkyTip: { x: handX - 0.01, y: handY - 0.15, z: 0 },
    pinkyMcp: { x: handX - 0.01, y: handY, z: 0 },
    wrist: { x: handX, y: handY + 0.2, z: 0 },
  };
}

/**
 * All fingers extended — should be classified as idle because
 * neither finger gun nor pinch+3 conditions are met.
 */
function makeOpenHand(): HandLandmarks {
  return {
    thumbTip: { x: 0.4, y: 0.35, z: 0 },
    thumbIp: { x: 0.43, y: 0.4, z: 0 },
    thumbMcp: { x: 0.47, y: 0.5, z: 0 },
    indexTip: { x: 0.55, y: 0.35, z: 0 },
    indexMcp: { x: 0.55, y: 0.5, z: 0 },
    middleTip: { x: 0.53, y: 0.35, z: 0 },
    middleMcp: { x: 0.53, y: 0.5, z: 0 },
    ringTip: { x: 0.51, y: 0.35, z: 0 },
    ringMcp: { x: 0.51, y: 0.5, z: 0 },
    pinkyTip: { x: 0.49, y: 0.35, z: 0 },
    pinkyMcp: { x: 0.49, y: 0.5, z: 0 },
    wrist: { x: 0.5, y: 0.7, z: 0 },
  };
}

// ── detectPose ───────────────────────────────────────────────────────

describe("detectPose", () => {
  it("detects rotate (finger gun)", () => {
    // pinchDist > PINCH_THRESHOLD (0.06) so it's a finger gun, not a pinch
    expect(detectPose(makeRotateLandmarks(0.08))).toBe("rotate");
  });

  it("detects pan (pinch + 3 open)", () => {
    expect(detectPose(makePanLandmarks())).toBe("pan");
  });

  it("returns idle for open hand", () => {
    // Open hand has all fingers extended — not finger gun, not pinch+3
    expect(detectPose(makeOpenHand())).toBe("idle");
  });
});

// ── processFrame ─────────────────────────────────────────────────────

describe("processFrame", () => {
  it("outputs rotation when palm moves in rotate mode", () => {
    // First frame: initialize tracking context
    let ctx = createInitialContext();
    const r1 = processFrame(ctx, makeRotateLandmarks(0.08, 0.5, 0.5));
    ctx = r1.context;

    // Second frame: move hand significantly to produce a delta
    const r2 = processFrame(ctx, makeRotateLandmarks(0.08, 0.7, 0.4));
    expect(r2.output.state).toBe("rotate");
    expect(r2.output.rotationDelta.x).not.toBe(0);
    // Pan should be zero during rotate mode
    expect(r2.output.panOffset.x).toBe(0);
  });

  it("outputs zoom in rotate mode when pinch distance changes", () => {
    let ctx = createInitialContext();
    // Start with a pinch distance above PINCH_THRESHOLD (0.06) to stay in rotate mode
    const r1 = processFrame(ctx, makeRotateLandmarks(0.08));
    ctx = r1.context;

    // Widen the pinch distance significantly to trigger a zoom delta
    const r2 = processFrame(ctx, makeRotateLandmarks(0.25));
    expect(r2.output.state).toBe("rotate");
    expect(r2.output.zoomDelta).not.toBe(0);
  });

  it("outputs pan when hand moves in pan mode", () => {
    let ctx = createInitialContext();
    const r1 = processFrame(ctx, makePanLandmarks(0.5, 0.5));
    ctx = r1.context;

    // Move hand horizontally
    const r2 = processFrame(ctx, makePanLandmarks(0.7, 0.5));
    expect(r2.output.state).toBe("pan");
    expect(r2.output.panOffset.x).not.toBe(0);
    // Rotation should be zero during pan mode
    expect(r2.output.rotationDelta.x).toBe(0);
  });

  it("returns idle for open hand", () => {
    const r = processFrame(createInitialContext(), makeOpenHand());
    expect(r.output.state).toBe("idle");
  });

  it("first frame initializes without producing deltas (anti-drift)", () => {
    const ctx = createInitialContext();
    const r = processFrame(ctx, makeRotateLandmarks(0.08, 0.3, 0.3));

    // First active frame should emit the correct state but zero deltas
    expect(r.output.state).toBe("rotate");
    expect(r.output.rotationDelta.x).toBe(0);
    expect(r.output.rotationDelta.y).toBe(0);
    expect(r.output.zoomDelta).toBe(0);
    expect(r.output.panOffset.x).toBe(0);
    expect(r.output.panOffset.y).toBe(0);

    // Context should now be initialized
    expect(r.context.initialized).toBe(true);
  });
});
