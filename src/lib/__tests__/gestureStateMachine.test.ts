import { describe, it, expect } from "vitest";
import {
  createInitialContext,
  processFrame,
  detectPose,
} from "../gestureStateMachine";
import type { HandLandmarks } from "../../types/gestures";

/** Finger gun — thumb+index extended, 3 curled = rotate */
function makeRotateLandmarks(pinchDist: number, handX = 0.5, handY = 0.5): HandLandmarks {
  return {
    thumbTip: { x: handX - pinchDist / 2, y: handY - 0.15, z: 0 },
    thumbIp: { x: handX - pinchDist / 4, y: handY - 0.1, z: 0 },
    thumbMcp: { x: handX - 0.02, y: handY, z: 0 },
    indexTip: { x: handX + pinchDist / 2, y: handY - 0.15, z: 0 },
    indexMcp: { x: handX + 0.05, y: handY, z: 0 },
    middleTip: { x: handX + 0.03, y: handY + 0.05, z: 0 },
    middleMcp: { x: handX + 0.03, y: handY, z: 0 },
    ringTip: { x: handX + 0.01, y: handY + 0.05, z: 0 },
    ringMcp: { x: handX + 0.01, y: handY, z: 0 },
    pinkyTip: { x: handX - 0.01, y: handY + 0.05, z: 0 },
    pinkyMcp: { x: handX - 0.01, y: handY, z: 0 },
    wrist: { x: handX, y: handY + 0.2, z: 0 },
  };
}

/** Pinch + 3 fingers open = pan */
function makePanLandmarks(handX = 0.5, handY = 0.5): HandLandmarks {
  return {
    thumbTip: { x: handX + 0.01, y: handY, z: 0 },
    thumbIp: { x: handX, y: handY - 0.02, z: 0 },
    thumbMcp: { x: handX - 0.02, y: handY + 0.05, z: 0 },
    indexTip: { x: handX + 0.02, y: handY, z: 0 },
    indexMcp: { x: handX + 0.05, y: handY + 0.05, z: 0 },
    middleTip: { x: handX + 0.03, y: handY - 0.15, z: 0 },  // extended
    middleMcp: { x: handX + 0.03, y: handY, z: 0 },
    ringTip: { x: handX + 0.01, y: handY - 0.15, z: 0 },    // extended
    ringMcp: { x: handX + 0.01, y: handY, z: 0 },
    pinkyTip: { x: handX - 0.01, y: handY - 0.15, z: 0 },   // extended
    pinkyMcp: { x: handX - 0.01, y: handY, z: 0 },
    wrist: { x: handX, y: handY + 0.2, z: 0 },
  };
}

/** Open hand = idle */
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

describe("detectPose", () => {
  it("detects rotate (finger gun)", () => {
    expect(detectPose(makeRotateLandmarks(0.08))).toBe("rotate");
  });

  it("detects pan (pinch + 3 open)", () => {
    expect(detectPose(makePanLandmarks())).toBe("pan");
  });

  it("returns idle for open hand", () => {
    expect(detectPose(makeOpenHand())).toBe("idle");
  });
});

describe("processFrame", () => {
  it("outputs rotation when palm moves in rotate mode", () => {
    let ctx = createInitialContext();
    ctx = processFrame(ctx, makeRotateLandmarks(0.08, 0.5, 0.5)).context;

    const r2 = processFrame(ctx, makeRotateLandmarks(0.08, 0.7, 0.4));
    expect(r2.output.state).toBe("rotate");
    expect(r2.output.rotationDelta.x).not.toBe(0);
    expect(r2.output.panOffset.x).toBe(0);
  });

  it("outputs zoom in rotate mode", () => {
    let ctx = createInitialContext();
    ctx = processFrame(ctx, makeRotateLandmarks(0.05)).context;

    const r2 = processFrame(ctx, makeRotateLandmarks(0.15));
    expect(r2.output.zoomDelta).not.toBe(0);
  });

  it("outputs pan when hand moves in pan mode", () => {
    let ctx = createInitialContext();
    ctx = processFrame(ctx, makePanLandmarks(0.5, 0.5)).context;

    const r2 = processFrame(ctx, makePanLandmarks(0.7, 0.5));
    expect(r2.output.state).toBe("pan");
    expect(r2.output.panOffset.x).not.toBe(0);
    expect(r2.output.rotationDelta.x).toBe(0);
  });

  it("returns idle for open hand", () => {
    const r = processFrame(createInitialContext(), makeOpenHand());
    expect(r.output.state).toBe("idle");
  });
});
