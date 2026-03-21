# Hand Tracking 3D Viewport — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an MVP proof-of-concept where a Three.js cube is controlled by hand gestures via MediaPipe in the browser.

**Architecture:** Two React hooks (`useHandTracking`, `useThreeScene`) connected by a single `<HandTrackingViewport />` component. Gesture interpretation lives in a pure state machine module. React Three Fiber for declarative 3D rendering.

**Tech Stack:** Vite + React + TypeScript, Three.js via R3F, `@mediapipe/tasks-vision`

**Design doc:** `docs/plans/2026-03-21-hand-tracking-viewport-design.md`

---

### Task 1: Scaffold Vite + React + TypeScript Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`

**Step 1: Initialize Vite project**

Run from the repo root:
```bash
npm create vite@latest . -- --template react-ts
```

This will scaffold into the current directory. Accept overwrite prompts for existing files (just README.md).

**Step 2: Install dependencies**

```bash
npm install three @react-three/fiber @react-three/drei @mediapipe/tasks-vision
npm install -D @types/three
```

**Step 3: Verify the dev server starts**

```bash
npm run dev
```

Expected: Vite dev server starts on localhost, default React page renders.

**Step 4: Clean up scaffolded boilerplate**

Remove `src/assets/`, `src/App.css` contents (keep file), and strip `App.tsx` down to:

```tsx
function App() {
  return <div>Hand Tracking Viewport</div>;
}

export default App;
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react-ts project with dependencies"
```

---

### Task 2: Types and Constants

**Files:**
- Create: `src/types/gestures.ts`

**Step 1: Write the gesture types**

```typescript
export type GestureState = "idle" | "pinching" | "zooming" | "panning";

export interface HandLandmarks {
  thumbTip: { x: number; y: number; z: number };   // landmark 4
  indexTip: { x: number; y: number; z: number };    // landmark 8
  wrist: { x: number; y: number; z: number };       // landmark 0
  indexMcp: { x: number; y: number; z: number };    // landmark 5
  pinkyMcp: { x: number; y: number; z: number };    // landmark 17
}

export interface GestureOutput {
  state: GestureState;
  rotationDelta: { x: number; y: number };
  zoomDelta: number;
  panOffset: { x: number; y: number };
}

export interface StateMachineContext {
  state: GestureState;
  frameCount: number;         // frames in candidate state (for debounce)
  candidateState: GestureState;
  prevPinchDist: number;
  prevHandPosition: { x: number; y: number };
  prevWristAngle: number;
  smoothedPosition: { x: number; y: number };
  smoothedPinchDist: number;
  smoothedWristAngle: number;
}

export const GESTURE_THRESHOLDS = {
  PINCH_ENTER: 0.05,
  PINCH_EXIT: 0.08,
  DEBOUNCE_FRAMES: 3,
  SMOOTHING_FACTOR: 0.3,
  ZOOM_SENSITIVITY: 5.0,
  ROTATION_SENSITIVITY: 3.0,
  PAN_SENSITIVITY: 2.0,
  ZOOM_THRESHOLD: 0.005,       // min pinch delta to count as zoom
  PAN_ANGLE_THRESHOLD: 0.05,   // min wrist angle delta to count as pan
} as const;
```

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/types/gestures.ts
git commit -m "feat: add gesture types and threshold constants"
```

---

### Task 3: Gesture State Machine (Pure Logic)

**Files:**
- Create: `src/lib/gestureStateMachine.ts`
- Create: `src/lib/__tests__/gestureStateMachine.test.ts`

**Step 1: Write the failing tests**

Install vitest:
```bash
npm install -D vitest
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

```typescript
// src/lib/__tests__/gestureStateMachine.test.ts
import { describe, it, expect } from "vitest";
import {
  createInitialContext,
  processFrame,
} from "../gestureStateMachine";
import { HandLandmarks, GESTURE_THRESHOLDS } from "../../types/gestures";

// Helper: create landmarks with a specific pinch distance
function makeLandmarks(pinchDist: number, handX = 0.5, handY = 0.5): HandLandmarks {
  return {
    thumbTip: { x: handX - pinchDist / 2, y: handY, z: 0 },
    indexTip: { x: handX + pinchDist / 2, y: handY, z: 0 },
    wrist: { x: handX, y: handY + 0.2, z: 0 },
    indexMcp: { x: handX + 0.05, y: handY + 0.1, z: 0 },
    pinkyMcp: { x: handX - 0.05, y: handY + 0.1, z: 0 },
  };
}

describe("gestureStateMachine", () => {
  it("starts in idle state", () => {
    const ctx = createInitialContext();
    expect(ctx.state).toBe("idle");
  });

  it("stays idle when pinch distance is above threshold", () => {
    let ctx = createInitialContext();
    const landmarks = makeLandmarks(0.1); // well above PINCH_ENTER
    for (let i = 0; i < 5; i++) {
      const result = processFrame(ctx, landmarks);
      ctx = result.context;
    }
    expect(ctx.state).toBe("idle");
  });

  it("transitions to pinching after debounce frames", () => {
    let ctx = createInitialContext();
    const landmarks = makeLandmarks(0.03); // below PINCH_ENTER
    let result;
    for (let i = 0; i < GESTURE_THRESHOLDS.DEBOUNCE_FRAMES + 1; i++) {
      result = processFrame(ctx, landmarks);
      ctx = result.context;
    }
    expect(ctx.state).toBe("pinching");
  });

  it("does not transition before debounce frames complete", () => {
    let ctx = createInitialContext();
    const landmarks = makeLandmarks(0.03);
    let result;
    for (let i = 0; i < GESTURE_THRESHOLDS.DEBOUNCE_FRAMES - 1; i++) {
      result = processFrame(ctx, landmarks);
      ctx = result.context;
    }
    expect(ctx.state).toBe("idle");
  });

  it("returns to idle when pinch distance exceeds exit threshold (hysteresis)", () => {
    let ctx = createInitialContext();
    // First, get into pinching state
    const closeLandmarks = makeLandmarks(0.03);
    for (let i = 0; i < GESTURE_THRESHOLDS.DEBOUNCE_FRAMES + 1; i++) {
      const result = processFrame(ctx, closeLandmarks);
      ctx = result.context;
    }
    expect(ctx.state).toBe("pinching");

    // Now open fingers past exit threshold
    const openLandmarks = makeLandmarks(0.1); // above PINCH_EXIT
    for (let i = 0; i < GESTURE_THRESHOLDS.DEBOUNCE_FRAMES + 1; i++) {
      const result = processFrame(ctx, openLandmarks);
      ctx = result.context;
    }
    expect(ctx.state).toBe("idle");
  });

  it("outputs rotation delta when pinching and hand moves", () => {
    let ctx = createInitialContext();
    // Get into pinching state
    const landmarks = makeLandmarks(0.03, 0.5, 0.5);
    for (let i = 0; i < GESTURE_THRESHOLDS.DEBOUNCE_FRAMES + 1; i++) {
      const result = processFrame(ctx, landmarks);
      ctx = result.context;
    }

    // Move hand while pinching
    const movedLandmarks = makeLandmarks(0.03, 0.6, 0.4);
    const result = processFrame(ctx, movedLandmarks);
    expect(result.output.rotationDelta.x).not.toBe(0);
    expect(result.output.rotationDelta.y).not.toBe(0);
  });

  it("outputs zoom delta when pinch distance changes while pinching", () => {
    let ctx = createInitialContext();
    // Get into pinching state at a specific distance
    const landmarks = makeLandmarks(0.03);
    for (let i = 0; i < GESTURE_THRESHOLDS.DEBOUNCE_FRAMES + 1; i++) {
      const result = processFrame(ctx, landmarks);
      ctx = result.context;
    }

    // Change pinch distance (squeeze closer)
    const squeezedLandmarks = makeLandmarks(0.01);
    const result = processFrame(ctx, squeezedLandmarks);
    expect(result.output.zoomDelta).not.toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — module `../gestureStateMachine` not found.

**Step 3: Implement the gesture state machine**

```typescript
// src/lib/gestureStateMachine.ts
import {
  GestureState,
  GestureOutput,
  HandLandmarks,
  StateMachineContext,
  GESTURE_THRESHOLDS,
} from "../types/gestures";

const { PINCH_ENTER, PINCH_EXIT, DEBOUNCE_FRAMES, SMOOTHING_FACTOR,
        ZOOM_SENSITIVITY, ROTATION_SENSITIVITY, PAN_SENSITIVITY,
        ZOOM_THRESHOLD, PAN_ANGLE_THRESHOLD } = GESTURE_THRESHOLDS;

export function createInitialContext(): StateMachineContext {
  return {
    state: "idle",
    frameCount: 0,
    candidateState: "idle",
    prevPinchDist: 0,
    prevHandPosition: { x: 0.5, y: 0.5 },
    prevWristAngle: 0,
    smoothedPosition: { x: 0.5, y: 0.5 },
    smoothedPinchDist: 0,
    smoothedWristAngle: 0,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function distance3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function palmCenter(landmarks: HandLandmarks): { x: number; y: number } {
  return {
    x: (landmarks.wrist.x + landmarks.indexMcp.x + landmarks.pinkyMcp.x) / 3,
    y: (landmarks.wrist.y + landmarks.indexMcp.y + landmarks.pinkyMcp.y) / 3,
  };
}

function wristAngle(landmarks: HandLandmarks): number {
  return Math.atan2(
    landmarks.indexMcp.y - landmarks.pinkyMcp.y,
    landmarks.indexMcp.x - landmarks.pinkyMcp.x
  );
}

function determineCandidate(
  currentState: GestureState,
  pinchDist: number,
  pinchDelta: number,
  wristAngleDelta: number
): GestureState {
  // If not pinching, check if we should enter pinch
  if (currentState === "idle") {
    return pinchDist < PINCH_ENTER ? "pinching" : "idle";
  }

  // If in any pinch-derived state, check if we should exit
  if (pinchDist > PINCH_EXIT) {
    return "idle";
  }

  // Determine sub-state while pinching
  if (Math.abs(pinchDelta) > ZOOM_THRESHOLD) {
    return "zooming";
  }
  if (Math.abs(wristAngleDelta) > PAN_ANGLE_THRESHOLD) {
    return "panning";
  }

  return "pinching";
}

export function processFrame(
  ctx: StateMachineContext,
  landmarks: HandLandmarks
): { context: StateMachineContext; output: GestureOutput } {
  const rawPinchDist = distance3D(landmarks.thumbTip, landmarks.indexTip);
  const rawPosition = palmCenter(landmarks);
  const rawWristAngle = wristAngle(landmarks);

  // Smooth values with EMA
  const smoothedPinchDist = lerp(ctx.smoothedPinchDist, rawPinchDist, SMOOTHING_FACTOR);
  const smoothedPosition = {
    x: lerp(ctx.smoothedPosition.x, rawPosition.x, SMOOTHING_FACTOR),
    y: lerp(ctx.smoothedPosition.y, rawPosition.y, SMOOTHING_FACTOR),
  };
  const smoothedWristAngle = lerp(ctx.smoothedWristAngle, rawWristAngle, SMOOTHING_FACTOR);

  // Compute deltas
  const pinchDelta = smoothedPinchDist - ctx.prevPinchDist;
  const positionDelta = {
    x: smoothedPosition.x - ctx.prevHandPosition.x,
    y: smoothedPosition.y - ctx.prevHandPosition.y,
  };
  const wristAngleDelta = smoothedWristAngle - ctx.prevWristAngle;

  // Determine what state we'd like to be in
  const candidate = determineCandidate(ctx.state, smoothedPinchDist, pinchDelta, wristAngleDelta);

  // Debounce: only transition after sustained candidate frames
  let newState = ctx.state;
  let newFrameCount = ctx.frameCount;
  let newCandidate = ctx.candidateState;

  if (candidate !== ctx.candidateState) {
    // Candidate changed — reset counter
    newCandidate = candidate;
    newFrameCount = 1;
  } else {
    newFrameCount = ctx.frameCount + 1;
  }

  if (newFrameCount >= DEBOUNCE_FRAMES && candidate !== ctx.state) {
    newState = candidate;
  }

  // Build output
  const output: GestureOutput = {
    state: newState,
    rotationDelta: { x: 0, y: 0 },
    zoomDelta: 0,
    panOffset: { x: 0, y: 0 },
  };

  if (newState === "pinching") {
    output.rotationDelta = {
      x: positionDelta.y * ROTATION_SENSITIVITY,
      y: positionDelta.x * ROTATION_SENSITIVITY,
    };
  } else if (newState === "zooming") {
    output.zoomDelta = pinchDelta * ZOOM_SENSITIVITY;
  } else if (newState === "panning") {
    output.panOffset = {
      x: positionDelta.x * PAN_SENSITIVITY,
      y: -positionDelta.y * PAN_SENSITIVITY, // invert Y for screen coords
    };
  }

  const newContext: StateMachineContext = {
    state: newState,
    frameCount: newFrameCount,
    candidateState: newCandidate,
    prevPinchDist: smoothedPinchDist,
    prevHandPosition: smoothedPosition,
    prevWristAngle: smoothedWristAngle,
    smoothedPosition,
    smoothedPinchDist,
    smoothedWristAngle,
  };

  return { context: newContext, output };
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All 7 tests pass.

**Step 5: Commit**

```bash
git add src/lib/gestureStateMachine.ts src/lib/__tests__/gestureStateMachine.test.ts vitest.config.ts package.json
git commit -m "feat: implement gesture state machine with tests"
```

---

### Task 4: useHandTracking Hook

**Files:**
- Create: `src/hooks/useHandTracking.ts`

**Step 1: Implement the hook**

This hook initializes MediaPipe Hand Landmarker, manages webcam access, runs detection each frame, and feeds results through the gesture state machine.

```typescript
// src/hooks/useHandTracking.ts
import { useEffect, useRef, useCallback, useState } from "react";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  GestureOutput,
  HandLandmarks,
  GestureState,
} from "../types/gestures";
import { createInitialContext, processFrame } from "../lib/gestureStateMachine";

interface UseHandTrackingReturn {
  gesture: GestureOutput;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_OUTPUT: GestureOutput = {
  state: "idle",
  rotationDelta: { x: 0, y: 0 },
  zoomDelta: 0,
  panOffset: { x: 0, y: 0 },
};

export function useHandTracking(): UseHandTrackingReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const contextRef = useRef(createInitialContext());
  const animationFrameRef = useRef<number>(0);
  const [gesture, setGesture] = useState<GestureOutput>(DEFAULT_OUTPUT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize MediaPipe + webcam
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Load MediaPipe WASM files
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        if (cancelled) return;
        handLandmarkerRef.current = handLandmarker;

        // Start webcam
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to initialize");
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      handLandmarkerRef.current?.close();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
    };
  }, []);

  // Detection loop
  const detect = useCallback(() => {
    const video = videoRef.current;
    const handLandmarker = handLandmarkerRef.current;

    if (!video || !handLandmarker || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    const results = handLandmarker.detectForVideo(video, performance.now());

    if (results.landmarks && results.landmarks.length > 0) {
      const lm = results.landmarks[0];
      const handData: HandLandmarks = {
        thumbTip: lm[4],
        indexTip: lm[8],
        wrist: lm[0],
        indexMcp: lm[5],
        pinkyMcp: lm[17],
      };

      const result = processFrame(contextRef.current, handData);
      contextRef.current = result.context;
      setGesture(result.output);
    } else {
      // No hand detected — reset to idle
      setGesture(DEFAULT_OUTPUT);
    }

    animationFrameRef.current = requestAnimationFrame(detect);
  }, []);

  // Start/stop detection loop
  useEffect(() => {
    if (!isLoading && !error) {
      animationFrameRef.current = requestAnimationFrame(detect);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading, error, detect]);

  return { gesture, videoRef, isLoading, error };
}
```

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/hooks/useHandTracking.ts
git commit -m "feat: implement useHandTracking hook with MediaPipe integration"
```

---

### Task 5: useThreeScene Hook

**Files:**
- Create: `src/hooks/useThreeScene.ts`

**Step 1: Implement the hook**

This hook accumulates gesture deltas into cube transform state for R3F.

```typescript
// src/hooks/useThreeScene.ts
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { GestureOutput } from "../types/gestures";

interface UseThreeSceneOptions {
  gesture: GestureOutput;
}

export function useThreeScene({ gesture }: UseThreeSceneOptions) {
  const meshRef = useRef<Mesh>(null);
  const cameraZRef = useRef(5);

  useFrame(({ camera }) => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;

    switch (gesture.state) {
      case "pinching":
        mesh.rotation.x += gesture.rotationDelta.x;
        mesh.rotation.y += gesture.rotationDelta.y;
        break;
      case "zooming":
        cameraZRef.current = Math.max(2, Math.min(15, cameraZRef.current - gesture.zoomDelta));
        break;
      case "panning":
        mesh.position.x += gesture.panOffset.x;
        mesh.position.y += gesture.panOffset.y;
        break;
    }

    // Smoothly move camera to target zoom
    camera.position.z += (cameraZRef.current - camera.position.z) * 0.1;
  });

  return { meshRef };
}
```

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/hooks/useThreeScene.ts
git commit -m "feat: implement useThreeScene hook for cube transforms"
```

---

### Task 6: HandTrackingViewport Component

**Files:**
- Create: `src/components/HandTrackingViewport.tsx`
- Modify: `src/App.tsx`

**Step 1: Create the Cube sub-component and main viewport component**

```tsx
// src/components/HandTrackingViewport.tsx
import { Canvas } from "@react-three/fiber";
import { useHandTracking } from "../hooks/useHandTracking";
import { useThreeScene } from "../hooks/useThreeScene";
import { GestureOutput } from "../types/gestures";

function TrackedCube({ gesture }: { gesture: GestureOutput }) {
  const { meshRef } = useThreeScene({ gesture });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4488ff" />
    </mesh>
  );
}

function DebugOverlay({ gesture }: { gesture: GestureOutput }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        background: "rgba(0, 0, 0, 0.7)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 12,
        padding: "8px 12px",
        borderRadius: 4,
        pointerEvents: "none",
      }}
    >
      <div>State: {gesture.state.toUpperCase()}</div>
      <div>Rot: ({gesture.rotationDelta.x.toFixed(3)}, {gesture.rotationDelta.y.toFixed(3)})</div>
      <div>Zoom: {gesture.zoomDelta.toFixed(3)}</div>
      <div>Pan: ({gesture.panOffset.x.toFixed(3)}, {gesture.panOffset.y.toFixed(3)})</div>
    </div>
  );
}

export function HandTrackingViewport() {
  const { gesture, videoRef, isLoading, error } = useHandTracking();

  if (error) {
    return (
      <div style={{ color: "red", padding: 32, fontFamily: "monospace" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#111", position: "relative" }}>
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 18,
            zIndex: 10,
          }}
        >
          Loading MediaPipe + Webcam...
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <TrackedCube gesture={gesture} />
      </Canvas>

      {/* Webcam preview — mirrored, bottom-left */}
      <video
        ref={videoRef}
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          width: 200,
          height: 150,
          objectFit: "cover",
          borderRadius: 8,
          opacity: 0.7,
          transform: "scaleX(-1)",
          pointerEvents: "none",
        }}
        autoPlay
        playsInline
        muted
      />

      <DebugOverlay gesture={gesture} />
    </div>
  );
}
```

**Step 2: Wire up App.tsx**

```tsx
// src/App.tsx
import { HandTrackingViewport } from "./components/HandTrackingViewport";

function App() {
  return <HandTrackingViewport />;
}

export default App;
```

**Step 3: Set up global styles**

Ensure `src/index.css` has:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

**Step 4: Verify it compiles and renders**

```bash
npm run dev
```

Expected: Dark background, blue cube in center, webcam preview bottom-left, debug overlay bottom-right. MediaPipe loading message appears then disappears. Moving your hand in front of the webcam should control the cube.

**Step 5: Commit**

```bash
git add src/components/HandTrackingViewport.tsx src/App.tsx src/index.css
git commit -m "feat: implement HandTrackingViewport with R3F canvas, webcam preview, debug overlay"
```

---

### Task 7: Manual Integration Test and Tuning

**Files:**
- May modify: `src/types/gestures.ts` (threshold values)
- May modify: `src/lib/gestureStateMachine.ts` (sensitivity)

**Step 1: Test all three gesture modes in the browser**

Run dev server and verify each interaction:

1. **Pinch to rotate**: Pinch thumb + index, move hand. Cube should rotate smoothly.
2. **Pinch distance to zoom**: While pinching, spread or squeeze fingers. Camera should zoom in/out.
3. **Wrist tilt to pan**: Tilt wrist. Cube should translate on X/Y plane.

**Step 2: Tune thresholds if needed**

Likely adjustments:
- `PINCH_ENTER` / `PINCH_EXIT` — may need widening if pinch detection is too sensitive or too hard to trigger
- `SMOOTHING_FACTOR` — increase (toward 1.0) for more responsive but jittery feel, decrease for smoother but laggier feel
- `*_SENSITIVITY` — scale rotation/zoom/pan speed to feel natural
- `DEBOUNCE_FRAMES` — reduce to 2 if transitions feel sluggish, increase to 4 if too twitchy

**Step 3: Run tests after any threshold changes**

```bash
npm test
```

Expected: All tests pass. If threshold changes break tests, update test values to match.

**Step 4: Commit tuning changes**

```bash
git add -A
git commit -m "chore: tune gesture thresholds after manual testing"
```

---

### Task 8: Final Cleanup and Type Check

**Step 1: Full type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 2: Run all tests**

```bash
npm test
```

Expected: All tests pass.

**Step 3: Verify dev server runs clean**

```bash
npm run dev
```

Expected: No console errors, clean render, all gestures work.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```
