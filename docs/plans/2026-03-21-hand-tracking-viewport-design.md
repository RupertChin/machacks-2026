# Hand Tracking 3D Viewport — Design Document

## Purpose

MVP proof-of-concept to validate hand-gesture-controlled 3D interaction in the browser. A Three.js cube controlled by MediaPipe hand tracking via webcam. This is a throwaway test branch — none of this merges to main. The goal is to validate the interaction model and understand how well it integrates with the real stack (Vite + React + FastAPI + Three.js).

## Stack

- Vite + React + TypeScript
- Three.js via React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
- `@mediapipe/tasks-vision` (Hand Landmarker, browser-side inference)

## Architecture

Two custom hooks wired together by a single component:

```
┌─────────────────────────────────────────────┐
│  <HandTrackingViewport />                   │
│                                             │
│  ┌──────────────────┐  ┌────────────────┐  │
│  │ useHandTracking() │  │ useThreeScene()│  │
│  │                    │  │               │  │
│  │ MediaPipe Init     │  │ R3F Scene     │  │
│  │ Webcam Feed        │  │ Cube Mesh     │  │
│  │ Landmark Reader    │  │ Lighting      │  │
│  │ Gesture State Mach.│  │               │  │
│  │                    │  │ Input:        │  │
│  │ Output:            │──│  rotation     │  │
│  │  gestureState      │  │  zoom         │  │
│  │  rotationDelta     │  │  pan          │  │
│  │  zoomDelta         │  │               │  │
│  │  panOffset         │  │               │  │
│  └────────────────────┘  └───────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ <Canvas /> (R3F)                     │   │
│  │ <video /> (small webcam preview)     │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- `useHandTracking()` — owns MediaPipe, webcam, gesture state machine. Outputs gesture state + deltas.
- `useThreeScene()` — owns cube transform state. Consumes gesture data, returns props for R3F mesh.
- `<HandTrackingViewport />` — wires hooks together, renders R3F Canvas + webcam preview + debug overlay.
- `gestureStateMachine.ts` — pure logic module, no React. Portable to the real stack.

## Gesture State Machine

### States

- **IDLE** — hand visible, no pinch detected. Cube does nothing.
- **PINCHING** — thumb + index close together. Moving hand while pinching rotates the cube.
- **ZOOMING** — while pinching, spread/squeeze thumb+index. Pinch distance delta maps to camera zoom.
- **PANNING** — wrist tilt/rotation detected. Wrist angle maps to X/Y translation of the cube.

### Transitions

```
                    pinchDist < 0.05
                    (sustained 3 frames)
          ┌──────────────────────────┐
          │                          ▼
       ┌──────┐              ┌───────────┐
       │ IDLE │              │ PINCHING  │
       └──────┘              └───────────┘
          ▲                     │      │
          │  pinchDist > 0.08   │      │  pinchDist delta
          │  (hysteresis)       │      │  increasing/decreasing
          ├─────────────────────┤      ▼
          │                     │  ┌───────────┐
          │                     │  │ ZOOMING   │
          │                     │  └───────────┘
          │                     │
          │                     │  wrist angle change
          │                     ▼
          │               ┌───────────┐
          └───────────────│ PANNING   │
                          └───────────┘
```

### Thresholds & Smoothing

- Enter pinch: distance < 0.05
- Exit pinch: distance > 0.08 (hysteresis prevents flickering)
- State transitions require 3 consecutive frames (debounce)
- All position values smoothed with EMA: `smoothed = lerp(prev, raw, 0.3)`
- Zooming vs rotating while pinching determined by whether pinch distance is changing (zoom) or hand position is moving (rotate)

## Data Flow Per Frame

1. MediaPipe processes webcam frame → 21 hand landmarks (x, y, z)
2. `useHandTracking()` extracts: thumb tip (landmark 4), index tip (landmark 8), wrist (landmark 0), palm center (derived from landmarks 0, 5, 17)
3. Gesture state machine evaluates: pinchDist, handPosition, wristAngle, pinchDelta → determines state transition
4. Hook outputs: `{ state, rotationDelta, zoomDelta, panOffset }`
5. `useThreeScene()` applies transforms to cube mesh and camera

## UI Layout

- Three.js R3F Canvas fills the viewport, dark background
- Cube has ambient + directional lighting so rotations are visible
- Webcam preview: mirrored, ~200x150px, bottom-left, semi-transparent
- Debug overlay: current gesture state, pinch distance, zoom/pan values (toggleable)

## File Structure

```
src/
├── components/
│   └── HandTrackingViewport.tsx
├── hooks/
│   ├── useHandTracking.ts
│   └── useThreeScene.ts
├── lib/
│   └── gestureStateMachine.ts
├── types/
│   └── gestures.ts
├── App.tsx
└── main.tsx
```

## Dependencies

- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `@mediapipe/tasks-vision`
