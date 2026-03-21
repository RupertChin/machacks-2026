# GestureCAD — Implementation Specification

## 1. Product Overview

### 1.1 Concept

GestureCAD is a web-based CAD editor where users navigate a 3D viewport using hand gestures via webcam and direct an AI agent via voice commands to design 3D parts. The agent can reference uploaded technical spec sheets — not just to build the specified part, but to build things that interface with it (e.g., upload a Raspberry Pi spec sheet and design a case for it).

### 1.2 Core User Flow

1. User opens the app and sees a 3D viewport with their webcam feed in the corner
2. User uploads a technical spec sheet (PDF) — the system extracts all engineering constraints and displays them in a sidebar panel
3. User holds a push-to-talk button and speaks: "Build me a case for this Raspberry Pi"
4. The AI agent consults the extracted constraints, plans the design, and executes a sequence of CAD operations — each displayed in real-time in the chat log
5. User navigates the 3D model using hand gestures (orbit, pan, zoom) to inspect the result
6. User provides follow-up voice commands to refine: "Make the walls thinner", "Add ventilation slots on the side", "Move the USB cutout 2mm to the left"
7. User exports the final design as an STL file

### 1.3 Scope

**In scope (hackathon MVP):**

- Browser-based 3D viewport with Three.js rendering
- Hand gesture viewport navigation (orbit, pan, zoom, reset) via MediaPipe Hands
- Push-to-talk voice input with Whisper API transcription
- AI design agent (Claude) with tool-use for CAD operations
- JSCAD geometry engine running browser-side (primitives + booleans + transforms)
- PDF spec sheet upload with constraint extraction (OpenDataLoader + Claude vision)
- In-memory constraint store with tool-based agent access
- Single spec document at a time (upload replaces previous)
- Real-time chat log showing agent reasoning, tool calls, and results
- STL export (client-side)
- Design review (agent-driven constraint audit)
- Constraint active/inactive toggle
- Object cloning and linear patterning
- Clear scene functionality
- Text chat fallback input

**Out of scope:**

- User auth / persistence / database
- TTS agent voice responses
- Multi-document support and conflict detection
- Collaborative / multi-user
- Advanced CAD operations (fillets, chamfers, sketch-based extrusions, parametric constraints)
- Mobile support

---

## 2. System Architecture

### 2.1 Architecture Pattern: Hybrid (Option C)

The backend orchestrates the AI agent loop. The frontend owns geometry state (JSCAD) and rendering (Three.js). During an agent interaction, the backend streams tool calls to the frontend for execution. The frontend validates each CAD operation against the real JSCAD engine and reports success/failure back to the backend, which feeds results into the ongoing Claude conversation.

Constraint queries and scene state lookups are resolved entirely on the backend (no frontend round-trip). Only CAD tool calls (geometry operations) go to the frontend for execution.

### 2.2 Data Flow — Voice Command Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React + Vite)                                                      │
│                                                                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ MediaPipe│  │  Voice    │  │ Three.js │  │ JSCAD Engine           │ │
│  │ Hands    │  │  Controls │  │ Renderer │  │ (geometry state)       │ │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └──────────┬────────────┘ │
│       │              │              │                    │              │
│       │ gestures     │ audio blob   │ render updates     │ tool exec   │
│       ▼              ▼              ▲                    ▲              │
│  Camera transforms   POST /voice    │                    │              │
│                      │              │         ┌──────────┴───────────┐  │
│                      │              │         │ SSE Event Handler    │  │
│                      │              │         │ - receives tool_call │  │
│                      │              │         │ - executes on JSCAD  │  │
│                      │              │         │ - POSTs tool_result  │  │
│                      │              │         └──────────────────────┘  │
└──────────────────────┼──────────────────────────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────┼──────────────────────────────────────────────────┐
│ BACKEND (FastAPI)    ▼                                                  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Agent Orchestrator                                               │   │
│  │                                                                  │   │
│  │  1. Receive audio ──► Whisper API ──► transcript                 │   │
│  │  2. Send transcript + scene state + history to Claude (Opus)     │   │
│  │  3. Stream Claude's response:                                    │   │
│  │     ├─ text tokens ──► agent_text SSE events (real-time)         │   │
│  │  4. Response completes with stop_reason:                         │   │
│  │     ├─ "tool_use" ──► collect ALL tool_use blocks                │   │
│  │     │   ├─ Constraint/scene tools ──► resolve internally         │   │
│  │     │   └─ CAD tools ──► stream tool_call events to frontend     │   │
│  │     │   Await ALL frontend tool_result POSTs (15s timeout each)  │   │
│  │     │   Combine ALL results into one user message ──► Claude     │   │
│  │     │   Repeat from step 3                                       │   │
│  │     └─ "end_turn" ──► send done event, close SSE                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────────┐  │
│  │ Constraint     │  │ Scene State    │  │ Extraction Service       │  │
│  │ Store          │  │ (abstract)     │  │ OpenDataLoader + Claude  │  │
│  │ (in-memory)    │  │ (in-memory)    │  │                          │  │
│  └────────────────┘  └────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

External APIs:
  - OpenAI Whisper API (speech-to-text)
  - Anthropic Claude API (agent reasoning + constraint extraction)
  - OpenDataLoader (local, PDF parsing)
```

### 2.3 Communication Protocols

**REST endpoints** — used for session management, PDF upload, state queries, export, and tool result reporting.

**SSE (Server-Sent Events)** — used for streaming agent responses during voice/chat interactions. One-way from backend to frontend. The backend holds the SSE connection open for the duration of an agent turn.

**Tool result POST** — during an active SSE stream, the frontend POSTs CAD tool execution results back to the backend. The backend awaits these before continuing the Claude conversation. Timeout: 15 seconds per tool call.

**SSE from POST:** The frontend must use `fetch()` + the `eventsource-parser` library to consume SSE from POST endpoints (`/voice`, `/chat`, and `/upload-spec`), NOT the native `EventSource` API (which only supports GET requests).

**SSE keepalive:** Backend uses `sse-starlette` with `ping=15` parameter to send keepalive pings and prevent proxy/browser timeouts.

### 2.4 SSE Event Schema

The `/voice` and `/chat` request bodies must include a `scene_object_ids: string[]` field listing all object IDs currently present in the frontend scene. The backend uses this for scene state reconciliation (see Section 4.4). Since `/voice` uses `multipart/form-data`, `scene_object_ids` is sent as a JSON-encoded string in a form field. The backend parses it with `json.loads()`.

Events sent from backend to frontend during an agent turn:

```typescript
// User's transcribed speech
type TranscriptEvent = {
  event: "transcript";
  data: { text: string };
};

// Streamed text tokens from Claude
// `done: true` signals the current text content block is complete (no more tokens for this block)
type AgentTextEvent = {
  event: "agent_text";
  data: { text: string; done: boolean };
};

// CAD tool call requiring frontend execution
type ToolCallEvent = {
  event: "tool_call";
  data: {
    op_id: string;
    tool_name: string;
    parameters: Record<string, any>;
  };
};

// Tool resolved on backend (constraint/scene query) — for chat log display
type ToolResultInternalEvent = {
  event: "tool_result_internal";
  data: {
    op_id: string;
    tool_name: string;
    parameters: Record<string, any>;
    result: any;
  };
};

// Error in the backend pipeline
type ErrorEvent = {
  event: "error";
  data: { message: string; recoverable: boolean };
};

// Agent turn complete
type DoneEvent = {
  event: "done";
  data: {};
};
```

#### Upload SSE Events

Events sent during spec sheet upload (`/upload-spec`):

```typescript
// Progress updates during extraction
type UploadProgressEvent = {
  event: "upload_progress";
  data: { stage: "parsing" | "classifying" | "extracting" | "done"; page?: number; total_pages?: number };
};

// Error during upload/extraction
type UploadErrorEvent = {
  event: "upload_error";
  data: { message: string; stage: "parsing" | "classifying" | "extracting"; recoverable: boolean };
};

// Final result
type UploadCompleteEvent = {
  event: "upload_complete";
  data: {
    spec_id: string;
    filename: string;
    page_count: number;
    constraints: Constraint[];
    extraction_summary: string;
  };
};
```

#### Tool result POST from frontend to backend

Tool result POST from frontend to backend:

```typescript
// POST /session/{id}/tool-result
type ToolResultPayload = {
  op_id: string;
  status: "success" | "failure";
  result?: {
    object_id?: string;
    object_ids?: string[];
    bbox?: [number, number, number, number, number, number]; // min/max xyz, Y-up (frontend applies zUpToYUp before sending)
  };
  error?: string;
};
```

**Per-tool-category result shapes:**
| Tool category | Result fields |
|---------------|---------------|
| Geometry-creating (`add_primitive`, `clone_object`, `union`, `intersect`) | `{ object_id, bbox }` |
| `linear_pattern` | `{ object_ids, bbox }` (bbox of full pattern) |
| Transforms (`move_object`, `rotate_object`, `scale_object`) | `{ bbox }` (updated bounding box) |
| `delete_object` | `{ object_id }` (no bbox) |
| Metadata (`set_color`, `rename_object`) | `{ object_id }` (no bbox) |

---

## 3. Frontend Specification

### 3.1 Tech Stack

- **Framework:** React (Vite)
- **Styling:** Tailwind CSS + shadcn/ui component library
- **3D Rendering:** Three.js (^0.162, direct usage — no R3F)
- **Geometry Engine:** JSCAD (browser-side, via @jscad/modeling, running in a Web Worker)
- **Hand Tracking:** MediaPipe Tasks Vision (browser-side, via @mediapipe/tasks-vision — `HandLandmarker` API)
- **State Management:** React useState/useReducer + Context (no external state library needed for this scope)

### 3.2 Component Tree

```
App (App.tsx)
├── Viewport (main area, ~70% width)
│   ├── ThreeCanvas
│   │   └── Three.js scene, camera, lights, orbit reference
│   ├── WebcamOverlay
│   │   └── Small corner feed showing hand landmark visualization
│   ├── GestureController
│   │   └── MediaPipe Hands → camera transform updates
│   └── VoiceControls
│       ├── PushToTalkButton (hold to record)
│       └── StatusIndicator ("Ready" / "Listening..." / "Processing..." / "Agent working...")
│
├── Sidebar (~30% width, resizable optional)
│   ├── TabSwitcher ("Chat" | "Constraints")
│   ├── ChatPanel (visible when Chat tab active)
│   │   ├── MessageList (scrollable, auto-scroll to bottom)
│   │   │   ├── UserMessage — voice transcript bubble
│   │   │   ├── AgentMessage — text response bubble (streamed token by token)
│   │   │   ├── ToolCallEntry — icon + tool name + param summary + ✅/❌ status
│   │   │   └── ConstraintLookupEntry — 🔍 + what the agent queried + summary of results
│   │   └── TextInput — fallback text input for typing commands
│   │
│   └── ConstraintPanel (visible when Constraints tab active)
│       ├── SpecDocumentCard
│       │   ├── Filename + upload timestamp
│       │   ├── Constraint count badge
│       │   └── RemoveButton (clears spec + all constraints)
│       ├── ConstraintList (grouped by category, collapsible sections)
│       │   └── ConstraintItem
│       │       ├── One-line description
│       │       ├── Value + unit display
│       │       └── Active/inactive toggle
│       ├── UploadButton (drag-and-drop zone or click)
│       └── EmptyState ("Upload a spec sheet to get started")
│
└── Toolbar (top bar)
    ├── AppTitle / Logo
    ├── ExportButton (dropdown: STL)
    ├── DesignReviewButton ("Check my design" — triggers agent audit)
    └── ClearSceneButton
```

**Note:** Sub-components like TabSwitcher, PushToTalkButton, StatusIndicator, TextInput, ConstraintLookupEntry, UploadButton, and EmptyState are inlined in their parent component files.

### 3.3 Three.js Scene Setup

The scene uses a perspective camera with orbit-style controls driven by MediaPipe gestures (not Three.js OrbitControls, since input comes from hand tracking, not mouse).

Scene configuration:

- Background: transparent (CSS sets the actual background color)
- Lighting: one ambient light (intensity 0.4) + two directional lights (key light intensity 0.8 at position [10, 10, 10], fill light intensity 0.3 at position [-5, 5, -5])
- Grid: XZ plane grid helper, 100×100 units, 10-unit divisions, subtle color
- Axes: small axes helper in the corner for orientation reference
- Camera default: perspective, FOV 50, positioned at [50, 50, 50] looking at origin
- Renderer: WebGLRenderer with antialiasing, devicePixelRatio scaling, tone mapping

Objects added by the agent are rendered as Three.js `Mesh` with `MeshStandardMaterial`. Each object gets a unique color (from a predefined palette or agent-specified). Selected objects get a wireframe overlay or outline effect.

### 3.4 JSCAD Integration Layer

The JSCAD engine runs entirely inside a **Web Worker** (`/lib/jscad/worker.ts`) to keep boolean operations off the main thread. The main thread communicates with it via `postMessage`.

**Web Worker architecture:**
- Worker maintains `Map<string, Geometry>` state
- Main thread sends tool call messages via `postMessage`
- Worker executes JSCAD ops, converts results to `Float32Array` (positions + normals), posts back via `Transferable` objects for zero-copy transfer
- Main thread constructs `BufferGeometry` from received arrays

**Coordinate transforms (Z-up ↔ Y-up):**
JSCAD uses Z-up coordinates; Three.js uses Y-up. The engine layer provides transform functions in `engine.ts`:
- `yUpToZUp([x, y, z])` → `[x, -z, y]` — applied to all inputs from the agent/Three.js before passing to JSCAD
- `zUpToYUp([x, y, z])` → `[x, z, -y]` — applied to all JSCAD outputs before passing to Three.js

**`engine.ts` is the sole transform boundary.** All values crossing into or out of the Worker are converted there. No other module should perform coordinate transforms. This prevents double-conversion.

Tool call translation mapping:

```typescript
// add_primitive
"cuboid"    → jscad.primitives.cuboid({size: [w, h, d]})
"cylinder"  → jscad.primitives.cylinder({radius, height})
"sphere"    → jscad.primitives.sphere({radius})
"torus"     → jscad.primitives.torus({innerRadius, outerRadius})

// booleans
"subtract"  → jscad.booleans.subtract(targetGeom, toolGeom)
"union"     → jscad.booleans.union(geom1, geom2, ...)
"intersect" → jscad.booleans.intersect(geom1, geom2, ...)

// transforms
"move_object"      → jscad.transforms.translate([x, y, z], geom)
                     // For absolute `position`: delta = yUpToZUp(position) - measureCenter(geom), then translate(delta, geom)
                     // For relative `delta`: translate(yUpToZUp(delta), geom)
"rotate_object"    → jscad.transforms.rotate([rx, ry, rz], geom)  // radians, Euler
"scale_object"     → jscad.transforms.scale([sx, sy, sz], geom)

// cloning & patterning
"clone_object" → jscad.transforms.translate(newPos - sourcePos, sourceGeom)
                 // Source is preserved. Clone inherits color/rotation/scale.
"linear_pattern" → loop i=1..count: jscad.transforms.translate(direction * spacing * i, sourceGeom)
                   // Source is preserved. Each copy is a new geometry. Copies start at the first offset position (not at the source).
```

**Frontend tool dispatch table:**

Not all "CAD tools" go through the JSCAD Worker. The dispatch routing is:

| Tool | Dispatch target | Notes |
|------|----------------|-------|
| `add_primitive`, `subtract`, `union`, `intersect`, `clone_object`, `linear_pattern` | Worker via `execute_tool` | Geometry operations |
| `move_object`, `rotate_object`, `scale_object` | Worker via `execute_tool` | Transform operations (modifies JSCAD geometry) |
| `delete_object` | Worker via `delete_object` message | Dedicated Worker message type |
| `set_color` | Main thread only | Updates `THREE.Mesh.material.color` directly — no Worker involvement |
| `rename_object` | Backend-resolved only | Updates `SceneState` label — no frontend effect |

**Rotation Handling:**

Three sub-problems exist for rotations:
1. **Degrees→radians:** `add_primitive.rotation` is specified in degrees. `engine.ts` converts to radians (`deg * Math.PI / 180`) before passing to JSCAD.
2. **Axis+angle→Euler:** `rotate_object` uses `{axis, angle_degrees}`. `engine.ts` maps to Euler: for axis "x" → `[rad, 0, 0]`, "y" → `[0, rad, 0]`, "z" → `[0, 0, rad]`.
3. **Axis remapping:** Rotation axes must also go through coordinate transforms. Apply `yUpToZUp` to the Euler rotation vector (same transform as positions) before passing to JSCAD.

**Rotation/scale center handling:** Rotations and scales are applied around the object's center using a translate-to-origin → transform → translate-back pattern. Use `jscad.measurements.measureCenter()` to get the current center.

**JSCAD-to-Three.js conversion pipeline (direct, no STL round-trip):**

```
JSCAD geom3
  → jscad.geometries.geom3.toPolygons(geometry)
  → triangulate each polygon (earcut — handles concave polygons from booleans)
  → Float32Array (positions) + Float32Array (normals)
  → Transfer to main thread via Transferable
  → new THREE.BufferGeometry() with position + normal attributes
  → new THREE.Mesh(geometry, material)
```

This is implemented in `/lib/jscad/converter.ts`. Triangulation uses the `earcut` npm package: project 3D polygon vertices to 2D (using the polygon's normal to choose the projection plane), run `earcut()`, and use the resulting triangle indices. Fan triangulation is NOT suitable because JSCAD boolean operations produce concave polygons.

The `@jscad/stl-serializer` is only used for STL export and runs inside the Web Worker (see "STL Export" below).

**JSCAD dynamic imports:** Since JSCAD uses CommonJS, configure Vite to handle it:
- Use dynamic `import()` in the Web Worker
- Add `@jscad/modeling` and `@jscad/stl-serializer` to `optimizeDeps.include` in `vite.config.ts` (for dev server pre-bundling)
- For the Web Worker specifically, add `worker: { rollupOptions: { plugins: [commonjs()] } }` to `vite.config.ts` using `@rollup/plugin-commonjs` (since `optimizeDeps.include` only affects the main thread, not Workers)

**Web Worker Message Protocol:**

```typescript
// Main thread → Worker
type WorkerRequest =
  | { type: "execute_tool"; op_id: string; tool_name: string; parameters: Record<string, any> }
  | { type: "delete_object"; object_id: string }
  | { type: "clear_all" }
  | { type: "export_all"; format: "stl" };

// Worker → Main thread
type WorkerResponse =
  | { type: "tool_result"; op_id: string; status: "success"; positions: Float32Array; normals: Float32Array; object_id: string; bbox: number[] }
  | { type: "tool_result_batch"; op_id: string; results: Array<{ object_id: string; positions: Float32Array; normals: Float32Array; bbox: number[] }> }
  | { type: "tool_result"; op_id: string; status: "failure"; error: string }
  | { type: "delete_result"; object_id: string; status: "success" | "failure" }
  | { type: "clear_result"; status: "success" }
  | { type: "export_result"; data: ArrayBuffer; format: "stl" }
  | { type: "error"; message: string };
```

The Worker uses `Transferable` objects for `positions`, `normals`, and `export_result.data` to avoid copying.

**STL Export:** The `@jscad/stl-serializer` runs inside the Web Worker (not on the main thread), because it needs access to the JSCAD `Geom3` objects which live in Worker memory. The main thread sends an `export_all` message; the Worker calls `serialize({ binary: true }, ...geometries)` to produce binary STL (`ArrayBuffer[]`), concatenates the arrays, and posts the result back via `Transferable`. The main thread then triggers a browser download. Note: `{ binary: true }` is required — without it, the serializer produces ASCII strings instead of `ArrayBuffer`.

**Worker crash recovery:** If the Worker fires an `onerror` event, the main thread should terminate and respawn it, then warn the user that geometry state was lost.

State management:

- `geometries: Map<string, jscad.Geometry>` — current JSCAD geometries by object ID (lives in Web Worker)
- After each operation, validate: check polygon count > 0, bounding box is non-degenerate

### 3.5 Gesture Recognition

MediaPipe Tasks Vision configuration (using `HandLandmarker` from `@mediapipe/tasks-vision`):

```typescript
const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "hand_landmarker.task",  // lite variant
    delegate: "GPU"
  },
  runningMode: "VIDEO",
  numHands: 2,
  minHandDetectionConfidence: 0.7,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5
});
```

Gesture definitions (all based on landmark distance thresholds):

**Orbit (single hand, open palm drag):**
- Detection: all five fingertips extended (tip y < pip y for each finger, relative to wrist)
- Action: map palm center position delta (frame-to-frame) to camera spherical coordinate changes
- Sensitivity: 0.5° per pixel of palm movement

**Pan (single hand, pinch drag):**
- Detection: thumb tip to index tip distance < 40px, other fingers extended
- Action: map pinch point position delta to camera target translation in screen plane
- Sensitivity: 0.1 units per pixel

**Zoom (two hands, pinch spread/contract):**
- Detection: both hands detected, both in pinch pose
- Action: map change in distance between the two pinch points to camera dolly (move closer/further)
- Sensitivity: 0.05 units per pixel of distance change

**Reset view (closed fist):**
- Detection: all fingertips curled (tip y > pip y for all fingers)
- Hold for 1 second to trigger
- Action: animate camera back to default position [50, 50, 50] looking at origin

**Gesture suppression:** all gesture processing is disabled when the push-to-talk button is held (voice recording active). This prevents accidental viewport movement while the user is speaking and potentially moving their hands.

### 3.6 Voice Controls

Push-to-talk button positioned at the bottom-center of the viewport area, large enough to be easily accessible.

Recording flow:

1. User presses and holds the button (or presses once to toggle — support both)
2. Status indicator changes to "Listening..." with a pulsing animation
3. `MediaRecorder` API captures audio — try `audio/webm` first, then `audio/mp4`, else omit the `mimeType` option and let the browser choose its default (Safari's `audio/mp4` support can be unreliable)
4. On release, audio blob is sent to `POST /session/{id}/voice`
5. Status changes to "Processing..."
6. SSE stream opens and events start flowing
7. Status changes to "Agent working..." during tool execution
8. Status returns to "Ready" when the `done` event arrives

**Camera + mic initialization:** Request both camera and microphone with a single `getUserMedia({video: true, audio: true})` call to avoid multiple permission prompts.

Fallback text input: a text field at the bottom of the ChatPanel allows typing commands directly. This sends to `POST /session/{id}/chat` with the same SSE response pattern.

### 3.7 Chat Log Display

Messages are rendered in a scrollable list that auto-scrolls to the bottom on new messages.

Message types and their visual treatment:

- **UserMessage:** right-aligned bubble, shows the transcribed text. Subtle microphone icon to indicate it was voice input.
- **AgentMessage:** left-aligned bubble, text streams in token-by-token as `agent_text` events arrive.
- **ToolCallEntry:** compact inline card showing:
  - Icon based on tool category (🔧 for CAD tools, 🔍 for constraint queries, 📐 for scene queries)
  - Tool name in monospace
  - Abbreviated parameter summary (e.g., "cylinder r=3, h=20 at [0, 0, 15]")
  - Status badge: spinner while executing, ✅ on success, ❌ on failure
  - Expandable to show full parameters and result
- **ConstraintLookupEntry:** similar to ToolCallEntry but styled distinctly to indicate it was a knowledge query, not a geometry operation.

### 3.8 Constraint Panel

Displays the currently loaded spec document and its extracted constraints.

**Empty state:** centered upload zone with drag-and-drop support and a message: "Upload a technical spec sheet (PDF) to enable constraint-aware design."

**With a loaded spec:**

The SpecDocumentCard shows the filename, file size, upload timestamp, and total constraint count. A "Remove" button clears the document and all its constraints (with confirmation dialog).

Below it, the ConstraintList groups constraints by category (dimensional, mounting, clearance, interface, material, electrical, thermal, other). Each category is a collapsible section with a count badge.

Each ConstraintItem shows:
- One-line description (e.g., "Board dimensions: 85.6 × 56.5 × 17mm")
- The constraint value and unit
- A toggle switch to mark it active/inactive (inactive constraints are not returned by agent queries) — wired to `PATCH /session/{id}/constraints/{constraint_id}` endpoint (in-scope, not stretch)
- A subtle "source" link that could eventually show the PDF location (stretch goal — the bounding box data is there from OpenDataLoader)

**Upload flow:** when a user uploads a new PDF while one is already loaded, show a confirmation: "This will replace the current spec sheet and its constraints. Continue?" On confirm, the old spec is removed and the new one is processed.

**Upload SSE consumption:** The frontend should use `fetch()` + `eventsource-parser` to consume the SSE stream from `POST /upload-spec`, just like `/voice` and `/chat`. The `spec.ts` API module should handle `upload_progress` events (update a progress indicator) and the `upload_complete` event (populate the constraint panel).

---

## 4. Backend Specification

### 4.1 Tech Stack

- **Framework:** FastAPI (Python 3.11+)
- **PDF Parsing:** opendataloader-pdf (requires Java 11+ on PATH)
- **STT:** OpenAI Whisper API (model: whisper-1)
- **AI Agent:** Anthropic Claude API (model: claude-opus-4-6, tool use)
- **Constraint Extraction:** Anthropic Claude API (model: claude-opus-4-6, vision for diagram pages)
- **Async:** asyncio + uvicorn, SSE via `sse-starlette`

### 4.2 API Endpoints

#### `POST /session`

Creates a new session. Returns a session ID.

Request: empty body

Response:
```json
{
  "session_id": "uuid-string",
  "created_at": "2026-03-21T10:00:00Z"
}
```

#### `POST /session/{session_id}/upload-spec`

Uploads a PDF spec sheet, triggers the extraction pipeline. Streams progress and results via SSE to avoid timeouts on large PDFs.

Request: `multipart/form-data` with a `file` field (PDF)

Response: `text/event-stream` (SSE) with progress events:

```typescript
// Progress updates during extraction
type UploadProgressEvent = {
  event: "upload_progress";
  data: { stage: "parsing" | "classifying" | "extracting" | "done"; page?: number; total_pages?: number };
};

// Error during upload/extraction
type UploadErrorEvent = {
  event: "upload_error";
  data: { message: string; stage: "parsing" | "classifying" | "extracting"; recoverable: boolean };
};

// Final result
type UploadCompleteEvent = {
  event: "upload_complete";
  data: {
    spec_id: string;
    filename: string;
    page_count: number;
    constraints: Constraint[];
    extraction_summary: string;
  };
};
```

Example final constraint object:
```json
{
  "id": "c1",
  "category": "dimensional",
  "feature_tags": ["board", "pcb", "overall_dimensions"],
  "description": "Board dimensions: 85.6 × 56.5mm",
  "type": "dimension",
  "value": { "length": 85.6, "width": 56.5 },
  "unit": "mm",
  "rationale": "Defines the overall PCB footprint for enclosure sizing",
  "source": { "page": 3, "bbox": [72, 400, 540, 430] },
  "active": true
}
```

Processing pipeline:

1. Save uploaded PDF to a temp directory
2. Run OpenDataLoader: opendataloader_pdf.convert(input_path=[pdf_path], output_dir=output_dir, format="markdown,json")
3. Extract structured elements with page-level content
4. For each page, determine if it's primarily text/tables or diagram:
   - If the page has >70% text-like elements (by count) → send the text/markdown to Claude as text
   - If the page has significant image/figure elements → use OpenDataLoader's `image_output="embedded"` to get Base64-encoded images from the JSON output, then send to Claude vision
5. Send to Claude with the constraint extraction prompt (see Section 6.1)
6. Parse Claude's response into constraint objects
7. Store in the session's constraint store
8. Return the constraints to the frontend

#### `DELETE /session/{session_id}/spec`

Removes the loaded spec document and all its constraints.

Response: `204 No Content`

#### `POST /session/{session_id}/voice`

Uploads audio, triggers the full agent interaction loop. Returns an SSE stream.

Request: `multipart/form-data` with an `audio` field (webm or mp4 blob) and a `scene_object_ids` field (JSON-encoded string of current frontend object IDs, parsed on backend with `json.loads()`).

Response: `text/event-stream` (SSE) — see Section 2.4 for event schema.

Backend processing (corrected agent loop):

```
1. Receive audio blob + scene_object_ids
2. Reconcile SceneState against scene manifest (remove stale objects not in scene_object_ids)
3. Call Whisper API to transcribe
4. Send transcript SSE event
5. Build Claude message: system prompt + conversation history + current scene state + user transcript
6. Call Claude API (Opus) with tool definitions, streaming enabled

while True:
    7. Stream Claude's response:
       - Text tokens → send as agent_text SSE events in real-time
       - For each tool_use block, record mapping: op_id → tool_use_id (Claude-generated)

    8. When response completes, match on stop_reason:

       case "tool_use":
           a. Collect ALL tool_use blocks from the response
           b. For each tool_use:
              - Constraint/scene tools → resolve internally, send tool_result_internal event
              - CAD tools → assign object IDs server-side, create asyncio.Event BEFORE
                yielding, then stream tool_call event to frontend
           c. Await ALL frontend tool_result POSTs (15s timeout per tool call)
           d. Construct a single `user` message containing one `tool_result` content block
              per tool call (each with the matching `tool_use_id` and result content).
              Use session.op_id_to_tool_use_id to map op_ids back to tool_use_ids.
           e. Feed back to Claude → continue loop

       case "end_turn":
           Send done event, close SSE stream → break

       case "max_tokens":
           Auto-continue with a follow-up request (include partial response).
           If this happens >2 times in a single turn → send error event → break
```

**Timeout handling:** If a frontend tool result times out (15s), treat it as a failure and feed an error result to Claude. If the frontend POSTs a result after the timeout, respond with HTTP 410 Gone.

#### `POST /session/{session_id}/tool-result`

Frontend reports the result of a CAD tool execution.

Request:
```json
{
  "op_id": "op_123",
  "status": "success",
  "result": {
    "object_id": "obj_5",
    "bbox": [-10, 0, -10, 10, 20, 10]
  }
}
```
or
```json
{
  "op_id": "op_123",
  "status": "failure",
  "error": "Boolean subtract produced empty geometry: tool does not intersect target"
}
```

Response: `202 Accepted`

The backend holds an asyncio Event per pending tool call. The POST resolves the event, unblocking the agent loop. Duplicate POSTs for the same `op_id` are ignored (first wins).

#### `POST /session/{session_id}/chat`

Text input alternative to voice. Same SSE response pattern as `/voice`.

Request:
```json
{
  "message": "Make the walls 2mm thicker",
  "scene_object_ids": ["obj_1", "obj_2", "obj_3"]
}
```

Response: `text/event-stream` (same SSE flow, minus the Whisper step)

#### `GET /session/{session_id}/state`

Returns current scene state and constraint summary. Used for frontend initialization or refresh.

Response:
```json
{
  "scene": {
    "objects": [...],
    "operation_history": [...]
  },
  "spec": {
    "filename": "raspberry_pi_4b_mechanical.pdf",
    "constraint_count": 24,
    "constraints": [...]
  },
  "conversation_history_length": 12
}
```

**STL export:** Handled entirely client-side. The frontend sends an `export_all` message to the JSCAD Web Worker, which runs `@jscad/stl-serializer.serialize({ binary: true }, ...geometries)` on the Geom3 objects (which live in Worker memory) and posts the resulting `ArrayBuffer` back via `Transferable`. The main thread then triggers a browser download. No backend endpoint needed.

#### `PATCH /session/{session_id}/constraints/{constraint_id}`

Toggle a constraint active/inactive. In-scope (not stretch).

Request:
```json
{
  "active": false
}
```

Response: `200 OK` with the full updated `Constraint` object. Returns `404 Not Found` for an invalid constraint ID. The toggled state takes effect on the next agent turn (constraints already in Claude's context for the current turn are unaffected).

**Router:** Handled by the `spec.py` router alongside `upload-spec` and `DELETE /spec`.

### 4.3 Session Management

Sessions are stored in-memory in a Python dictionary: `sessions: dict[str, Session]`.

```python
class Session:
    session_id: str
    created_at: datetime
    scene_state: SceneState          # abstract scene model
    constraint_store: ConstraintStore # loaded constraints
    conversation_history: list[dict]  # Claude message history
    pending_tool_results: dict[str, asyncio.Event]  # op_id → event
    op_id_to_tool_use_id: dict[str, str]  # maps backend op_id → Claude tool_use_id
    spec_metadata: Optional[SpecMetadata]  # loaded PDF info
    turn_lock: asyncio.Lock          # prevents concurrent agent turns
```

**Note:** `Session` is a plain Python dataclass (not Pydantic), because `asyncio.Event` and `asyncio.Lock` cannot be Pydantic-serialized.

```python
@dataclass
class SpecMetadata:
    spec_id: str
    filename: str
    page_count: int
    uploaded_at: datetime
```

**Concurrency control:** Voice and chat handlers check `turn_lock` before starting an agent turn: `if session.turn_lock.locked(): raise HTTPException(409)`. Then acquire with `async with session.turn_lock:`. Note: `asyncio.Lock.acquire()` blocks rather than failing, so the explicit `locked()` check is required to return 409 immediately.

Sessions are not persisted. Restarting the server clears all sessions. For the hackathon, this is acceptable.

### 4.4 Scene State (Abstract Model)

The backend maintains an abstract model of the scene that mirrors what JSCAD has on the frontend. This is used to provide context to the agent. It is **not** used for geometry computation — that's the frontend's job.

```python
class SceneObject:
    id: str
    label: str
    type: str                    # "cuboid", "cylinder", "sphere", "torus", "compound"
    params: dict                 # original creation parameters
    position: tuple[float, float, float]
    rotation: tuple[float, float, float]  # radians, Euler (naive addition for rotate_object updates — approximate but sufficient for the abstract model)
    scale: tuple[float, float, float]
    color: str                   # hex color
    bbox: Optional[tuple[float, ...]]     # updated from frontend tool results
    created_by_op: str           # op_id that created this object

class Operation:
    op_id: str
    action: str                  # tool name
    params: dict                 # tool parameters
    status: str                  # "success" | "failure"
    result_object_ids: list[str] # objects created/modified
    error: Optional[str]
    timestamp: datetime

class SceneState:
    objects: dict[str, SceneObject]    # id → object
    operation_history: list[Operation]
    next_object_id: int                # counter for generating obj_1, obj_2, ...
    next_op_id: int                    # counter for generating op_1, op_2, ...
```

When the backend sends scene state to Claude, it serializes to this format:

```json
{
  "objects": [
    {
      "id": "obj_1",
      "label": "base_plate",
      "type": "cuboid",
      "params": {"size": [90, 62, 3]},
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "color": "#888888",
      "bbox": [-45, 0, -31, 45, 3, 31]
    }
  ],
  "recent_operations": [
    {"op_id": "op_1", "action": "add_primitive", "params": {"type": "cuboid", "size": [90, 62, 3]}, "status": "success"}
  ],
  "total_operations": 1,
  "active_spec": "raspberry_pi_4b_mechanical.pdf (24 constraints)"
}
```

Only the last 10 operations are included by default. The agent can request full history via `get_scene_state()`.

**Object ID generation:** The backend generates all object IDs via the `next_object_id` counter (producing `obj_1`, `obj_2`, ...) and injects the assigned ID(s) into the `ToolCallEvent` parameters before streaming to the frontend. The agent does not choose IDs — they are assigned server-side.

**ID injection table (per tool):**
| Tool | Injected field | Type |
|------|---------------|------|
| `add_primitive` | `object_id` | `string` |
| `clone_object` | `new_object_id` | `string` |
| `union` | `object_id` | `string` |
| `intersect` | `object_id` | `string` |
| `linear_pattern` | `object_ids` | `string[]` (one per copy) |

**Cross-batch referencing:** Operations within the same tool-use batch cannot reference objects created in the same batch. To create an object and then reference it, the agent must create it in one turn, receive the ID in the result, and reference it in the next turn.

**Consumed-object inference:** When the backend processes tool results, it infers which objects are consumed:
- `subtract`: removes the `tool_id` object (or all `tool_ids` if plural) from the scene model. The **target retains its ID**, its `type` updates to `"compound"`, and its `bbox` updates from the tool result.
- `union` and `intersect`: remove all input `object_ids` and create a new result object with the injected `object_id`.

**Frontend consumed-object cleanup:** When the frontend receives a `tool_call` for a boolean operation, after execution it must remove consumed meshes from the Three.js scene. Either: (a) the backend includes `consumed_object_ids` in the `ToolCallEvent` parameters (preferred — explicit), or (b) the frontend infers consumed objects using the same rules as the backend (subtract: remove tool object(s); union/intersect: remove all input objects). For each removed mesh: `mesh.geometry.dispose()`, `mesh.material.dispose()`, `scene.remove(mesh)`.

**SceneState update rules for all tools:**
| Tool | Backend SceneState update |
|------|--------------------------|
| `add_primitive` | Create new `SceneObject` with params, position, color, bbox from result |
| `subtract` | Remove tool object(s); update target's `type` → `"compound"`, update `bbox` |
| `union` / `intersect` | Remove all input objects; create new result object with `type: "compound"` |
| `clone_object` | Create new `SceneObject` copying source's type/params/color, with clone's position and `new_object_id` |
| `linear_pattern` | Create N `SceneObject` entries with computed positions (see below) |
| `move_object` | Update object's `position`; update `bbox` from result |
| `rotate_object` | Update object's `rotation` (naive Euler addition — approximate but sufficient for abstract model) |
| `scale_object` | Update object's `scale`; update `bbox` from result |
| `set_color` | Update object's `color` |
| `rename_object` | Update object's `label` |
| `delete_object` | Remove object from `SceneState.objects` |

**linear_pattern result handling:** The backend creates N `SceneObject` entries with computed positions (`source_position + direction * spacing * i` for `i` in `1..count`). The frontend returns `object_ids: string[]` in the `ToolResultPayload`.

**Scene manifest reconciliation:** On each `/voice` or `/chat` request, the backend diffs its `SceneState.objects` against the `scene_object_ids` array from the request. Any objects in the backend model but NOT in the frontend manifest are removed from the backend model. This handles `ClearScene` and any edge-case drift.

**ClearScene behavior:** When the user clicks ClearSceneButton: (1) show a confirmation dialog, (2) send `clear_all` Worker message to clear JSCAD geometries, (3) remove all meshes from the Three.js scene, (4) send an empty `scene_object_ids` array on the next `/voice` or `/chat` request. The backend reconciles by removing all objects. Additionally, inject a synthetic system message into conversation history: `"Scene has been cleared. All objects removed."` This prevents the agent from referencing deleted objects.

**Stale conversation history:** After a clear, old conversation messages may reference objects that no longer exist. The synthetic message above informs the agent; the scene state injection on the next turn will show an empty scene.

**Race condition prevention:** The backend creates the `asyncio.Event` for a pending tool result BEFORE yielding the `tool_call` SSE event. This prevents a race where the frontend POSTs the result before the event exists.

### 4.5 CAD State Management Architecture

**Split-state model:**
- **Frontend (geometry truth):** JSCAD Web Worker maintains `Map<string, Geometry>`. Three.js scene has rendered meshes.
- **Backend (metadata truth):** `SceneState.objects` dict with abstract metadata (id, label, type, params, position, bbox). Injected into Claude's context.

**Sync mechanism:** Tool call round-trip. Backend assigns object_id, records params. Frontend executes, POSTs result with bbox. Backend updates model.

**Drift prevention:** Frontend sends `scene_object_ids[]` with every `/voice` and `/chat` request. Backend reconciles (removes objects not in manifest). Handles ClearScene and any edge-case drift.

**Browser refresh:** Geometry is lost. This is a documented known limitation for the hackathon MVP.

### 4.6 Error Handling

Systematic error recovery for each failure mode:

| Failure | Handling |
|---------|----------|
| **Whisper API failure** | Retry once. If still fails, send `ErrorEvent` with `recoverable: true` and message "Speech recognition failed. Please try again." |
| **Claude API timeout** | 60-second timeout per API call. On timeout, send `ErrorEvent` with `recoverable: true`. |
| **SSE connection drop** | Frontend detects via `fetch()` response stream closing unexpectedly. Show "Connection lost" banner. User can retry. |
| **Web Worker crash** | Detect via Worker `onerror` event. Terminate and respawn Worker. Send `ErrorEvent` warning that geometry state was lost. |
| **Frontend tool result timeout** | After 15s, treat as failure, feed error result to Claude. Late POSTs return HTTP 410 Gone. |
| **Claude `stop_reason: "max_tokens"`** | Auto-continue up to 2 times. After that, send `ErrorEvent`. |
| **PDF parsing failure** | Send `UploadErrorEvent` with `stage: "parsing"`, `recoverable: false`. Likely cause: corrupt PDF or missing Java runtime. |
| **Claude extraction timeout** | 60-second timeout for extraction call. Send `UploadErrorEvent` with `stage: "extracting"`, `recoverable: true`. User can re-upload. |
| **Invalid/empty PDF** | Detect zero pages from OpenDataLoader. Send `UploadErrorEvent` with `stage: "parsing"`, `recoverable: false`, message: "PDF has no extractable content." |

### 4.7 Anthropic API Streaming

When streaming Claude responses, the Anthropic API sends `content_block_start`, `content_block_delta`, and `content_block_stop` events. Use the Anthropic Python SDK's streaming helpers (`client.messages.stream()`) which abstract these into a simpler interface. Key events to handle:
- `text` events → forward as `agent_text` SSE events
- `input_json` events (tool use) → accumulate JSON, process on `content_block_stop`
- `message_stop` → check `stop_reason` and branch accordingly

---

## 5. Agent Design

### 5.1 Model & Configuration

- Model: `claude-opus-4-6`
- Max tokens: 16384 (safe default for `claude-opus-4-6`)
- Temperature: 0 (maximally consistent tool use)
- Tool use: enabled with all tools defined below
- **`max_tokens` overflow handling:** If Claude responds with `stop_reason: "max_tokens"`, the backend sends a follow-up request including the partial response to continue generation. If this happens more than twice in a single turn, send an error event to the frontend.

### 5.2 System Prompt

```
You are GestureCAD Agent, an AI-powered CAD design assistant. You help users design 3D parts by executing CAD operations based on their voice commands.

## Your Capabilities
You can create 3D primitives (cuboids, cylinders, spheres, tori), combine them with boolean operations (union, subtract, intersect), and transform them (move, rotate, scale, delete, recolor, rename). You can clone objects and create linear patterns of repeated objects. You can also trigger a design review to audit your work against loaded constraints. You work with a constraint-aware design system — when a technical spec sheet is loaded, you can query it for engineering dimensions, positions, clearances, and other specifications.

## How You Work
1. When the user gives a command, briefly explain your plan (1-2 sentences)
2. If a spec sheet is loaded and the task involves constrained features, query the relevant constraints first
3. Execute CAD operations step by step. Independent operations (e.g., creating two unrelated shapes) can be done in the same round. But when an operation depends on the result of a previous one (e.g., you need to create a cutout shape and then subtract it from the main body), split these across separate rounds — create first, receive the assigned ID, then use it in the next round.
4. Confirm what you did and note any constraints you referenced

## Object IDs
Object IDs are assigned automatically by the server — you do not choose them. When you create an object, the server assigns an ID (e.g., "obj_1") and returns it in the tool result. To reference that object in a subsequent operation (e.g., subtract, move, clone), you must wait for the result from the creation step. This means you cannot create an object and use it in the same round of tool calls.

## Constraint Awareness
Constraints from uploaded spec sheets are reference knowledge — they describe a component the user is designing around, not the part being designed. Use them to inform your dimensions, positions, and clearances. For example, if the spec says mounting holes are at positions [3.5, 3.5] and [61.5, 3.5], place your standoffs at exactly those coordinates.

Before making any operation that relates to a constrained interface, query the relevant constraints to get the exact values. Do not guess dimensions from memory — always look them up.

If you notice a potential issue (e.g., a wall that might be too thin, a clearance that's tight), mention it to the user.

## Communication Style
- Brief reasoning before executing (1-2 sentences of what you plan to do)
- Execute the operations
- Short confirmation of what was done, referencing any spec values used
- Keep explanations concise — the user can see each tool call in the chat log

## Coordinate System
- Y-axis is up
- Units are millimeters by default
- Origin [0, 0, 0] is the center of the build platform
- All coordinates you specify are in Y-up space. The system converts internally — never pre-convert.

## Design Best Practices
- Label objects with meaningful names (e.g., "base_plate", "usb_cutout", "standoff_front_left")
- Use appropriate colors to visually distinguish different features
- Build from the bottom up — base/plate first, then walls, then features
- When creating enclosures, consider wall thickness, clearances, and access to ports/connectors
- JSCAD has no shell/hollow operation. To hollow an object, create a slightly smaller copy and subtract it from the outer shape: `subtract(outer, smaller_inner)`

## Error Recovery
- If a tool call fails, read the error message and adjust your approach. Do not retry the same operation with the same parameters more than twice.
- If multiple tool calls fail in sequence, explain the issue to the user and ask for guidance.

## Handling Missing Information
- If no spec sheet is loaded and the user's request involves specific component dimensions (e.g., "build a case for this board"), ask the user to upload a spec sheet or provide dimensions manually.
- If a command is ambiguous (e.g., "make it bigger"), make a reasonable assumption and state it clearly (e.g., "I'll scale the case uniformly by 1.2x").
- When the user says "it" or "that", infer the referent from the most recently created or discussed object in the conversation.
```

### 5.3 Tool Definitions

#### CAD Tools (executed on frontend)

**add_primitive**
```json
{
  "name": "add_primitive",
  "description": "Add a 3D primitive shape to the scene",
  "input_schema": {
    "type": "object",
    "properties": {
      "type": { "type": "string", "enum": ["cuboid", "cylinder", "sphere", "torus"] },
      "dimensions": {
        "type": "object",
        "description": "Shape-specific dimensions in mm. Cuboid: {size: [x,y,z]}. Cylinder: {radius, height}. Sphere: {radius}. Torus: {innerRadius, outerRadius}."
      },
      "position": { "type": "array", "items": { "type": "number" }, "description": "[x, y, z] center position in mm" },
      "rotation": { "type": "array", "items": { "type": "number" }, "description": "[rx, ry, rz] rotation in degrees. Optional, defaults to [0,0,0]" },
      "color": { "type": "string", "description": "Hex color string. Optional, auto-assigned if omitted" },
      "label": { "type": "string", "description": "Human-readable name for this object" }
    },
    "required": ["type", "dimensions", "position", "label"]
  }
}
```

**subtract**
```json
{
  "name": "subtract",
  "description": "Boolean subtract: remove the tool shape(s) from the target shape. Tool objects are consumed.",
  "input_schema": {
    "type": "object",
    "properties": {
      "target_id": { "type": "string", "description": "ID of the object to cut from" },
      "tool_id": { "type": "string", "description": "ID of a single object to use as the cutting tool" },
      "tool_ids": { "type": "array", "items": { "type": "string" }, "description": "IDs of multiple objects to subtract at once. Use this OR tool_id, not both." }
    },
    "required": ["target_id"]
  }
}
```

**Backend validation:** Exactly one of `tool_id` or `tool_ids` must be provided. If neither or both are present, return an error.

**union**
```json
{
  "name": "union",
  "description": "Boolean union: merge multiple objects into one.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_ids": { "type": "array", "items": { "type": "string" }, "description": "IDs of objects to merge" },
      "label": { "type": "string", "description": "Label for the resulting merged object" }
    },
    "required": ["object_ids", "label"]
  }
}
```

**intersect**
```json
{
  "name": "intersect",
  "description": "Boolean intersect: keep only the overlapping volume of multiple objects.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_ids": { "type": "array", "items": { "type": "string" }, "description": "IDs of objects to intersect" },
      "label": { "type": "string", "description": "Label for the resulting object" }
    },
    "required": ["object_ids", "label"]
  }
}
```

**move_object**
```json
{
  "name": "move_object",
  "description": "Move an object to a new position or by a relative offset. Must provide exactly one of 'position' or 'delta'.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_id": { "type": "string" },
      "position": { "type": "array", "items": { "type": "number" }, "description": "Absolute [x,y,z] position, or use delta" },
      "delta": { "type": "array", "items": { "type": "number" }, "description": "Relative [dx,dy,dz] movement. Use position OR delta, not both." }
    },
    "required": ["object_id"]
  }
}
```

**Backend validation:** At least one of `position` or `delta` must be provided (not both). A call with only `object_id` is a no-op error.

**scale_object**
```json
{
  "name": "scale_object",
  "description": "Scale an object uniformly or per-axis. Must provide exactly one of 'factor' or 'axis_factors'.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_id": { "type": "string" },
      "factor": { "type": "number", "description": "Uniform scale factor. Use this OR axis_factors." },
      "axis_factors": { "type": "array", "items": { "type": "number" }, "description": "[sx, sy, sz] per-axis scale factors." }
    },
    "required": ["object_id"]
  }
}
```

**Backend validation:** At least one of `factor` or `axis_factors` must be provided (not both). A call with only `object_id` is a no-op error.

**rotate_object**
```json
{
  "name": "rotate_object",
  "description": "Rotate an object around an axis.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_id": { "type": "string" },
      "axis": { "type": "string", "enum": ["x", "y", "z"] },
      "angle_degrees": { "type": "number" }
    },
    "required": ["object_id", "axis", "angle_degrees"]
  }
}
```

**delete_object**
```json
{
  "name": "delete_object",
  "description": "Remove an object from the scene.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_id": { "type": "string" }
    },
    "required": ["object_id"]
  }
}
```

**set_color**
```json
{
  "name": "set_color",
  "description": "Change an object's display color.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_id": { "type": "string" },
      "color": { "type": "string", "description": "Hex color (e.g., '#FF5500')" }
    },
    "required": ["object_id", "color"]
  }
}
```

**rename_object**
```json
{
  "name": "rename_object",
  "description": "Change an object's label.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_id": { "type": "string" },
      "label": { "type": "string" }
    },
    "required": ["object_id", "label"]
  }
}
```

**clone_object**
```json
{
  "name": "clone_object",
  "description": "Create a copy of an existing object at a new position. The server assigns the clone's ID as 'new_object_id' in the tool call parameters.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_id": { "type": "string", "description": "ID of the source object to clone" },
      "position": { "type": "array", "items": { "type": "number" }, "description": "[x, y, z] position for the clone" },
      "label": { "type": "string", "description": "Label for the cloned object" }
    },
    "required": ["object_id", "position", "label"]
  }
}
```

**linear_pattern**
```json
{
  "name": "linear_pattern",
  "description": "Create N copies of an object along an axis with equal spacing. Source is preserved. Copies are placed at offsets direction*spacing*1, direction*spacing*2, ..., direction*spacing*count.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_id": { "type": "string", "description": "ID of the source object to replicate" },
      "direction": { "type": "array", "items": { "type": "number" }, "description": "[dx, dy, dz] direction vector (normalized)" },
      "count": { "type": "integer", "description": "Number of copies to create (not counting the source)" },
      "spacing": { "type": "number", "description": "Distance between copies in mm" },
      "label_prefix": { "type": "string", "description": "Prefix for copy labels (e.g., 'vent_slot' → 'vent_slot_1', 'vent_slot_2', ...)" }
    },
    "required": ["object_id", "direction", "count", "spacing", "label_prefix"]
  }
}
```

#### Constraint Tools (resolved on backend)

**get_constraints_summary**
```json
{
  "name": "get_constraints_summary",
  "description": "Get an overview of all loaded constraints — the spec source and a one-line summary of each constraint.",
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

**get_constraints_by_category**
```json
{
  "name": "get_constraints_by_category",
  "description": "Get all constraints in a specific category.",
  "input_schema": {
    "type": "object",
    "properties": {
      "category": { "type": "string", "enum": ["dimensional", "mounting", "clearance", "interface", "material", "electrical", "thermal", "other"] }
    },
    "required": ["category"]
  }
}
```

**get_constraint_detail**
```json
{
  "name": "get_constraint_detail",
  "description": "Get full details of a specific constraint, including its exact values, rationale, and source location.",
  "input_schema": {
    "type": "object",
    "properties": {
      "constraint_id": { "type": "string" }
    },
    "required": ["constraint_id"]
  }
}
```

**search_constraints**
```json
{
  "name": "search_constraints",
  "description": "Search constraints by keyword. Matches against feature tags, descriptions, and categories.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query, e.g., 'USB port', 'mounting holes', 'board thickness'" }
    },
    "required": ["query"]
  }
}
```

#### Scene Tools (resolved on backend)

**get_scene_state**
```json
{
  "name": "get_scene_state",
  "description": "Get the full current scene state including all objects, their properties, and the complete operation history.",
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

**get_object_details**
```json
{
  "name": "get_object_details",
  "description": "Get detailed information about a specific object including its creation parameters, current position, and bounding box.",
  "input_schema": {
    "type": "object",
    "properties": {
      "object_id": { "type": "string" }
    },
    "required": ["object_id"]
  }
}
```

**design_review**
```json
{
  "name": "design_review",
  "description": "Audit the current design against all active constraints. Returns a report of satisfied constraints, potential issues, and violations. Use this when the user asks to check their design or when you think the design is at a good checkpoint.",
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

#### Backend-Resolved Tool Return Schemas

Each backend-resolved tool returns a JSON result that is fed back to Claude as the `tool_result` content block:

**`get_constraints_summary`** returns:
```json
{ "spec": "raspberry_pi_4b_mechanical.pdf", "constraint_count": 24, "constraints": [{"id": "c1", "category": "dimensional", "description": "Board dimensions: 85.6 × 56.5mm"}, ...] }
```

**`get_constraints_by_category`** returns:
```json
{ "category": "mounting", "constraints": [{"id": "c5", "description": "...", "type": "position_array", "value": [...], "unit": "mm"}, ...] }
```

**`get_constraint_detail`** returns:
```json
{ "id": "c5", "category": "mounting", "feature_tags": ["mounting_holes", "pcb"], "description": "...", "type": "position_array", "value": [...], "unit": "mm", "rationale": "...", "source": {"page": 3, "bbox": [72, 400, 540, 430]}, "active": true }
```

**`search_constraints`** returns:
```json
{ "query": "USB port", "results": [{"id": "c12", "category": "interface", "description": "...", "type": "position", "value": {"x": 3.5, "y": 7.7}, "unit": "mm"}, ...] }
```

**`get_scene_state`** returns: the full scene state JSON (same format as Section 4.4 serialization, but including complete `operation_history`).

**`get_object_details`** returns:
```json
{ "id": "obj_1", "label": "base_plate", "type": "cuboid", "params": {"size": [90, 62, 3]}, "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1], "color": "#888888", "bbox": [-45, 0, -31, 45, 3, 31], "created_by_op": "op_1" }
```

**`design_review`** returns:
```json
{ "review": "## Design Review\n\n### ✅ Satisfied\n- Board dimensions...\n\n### ⚠️ Warnings\n- Wall thickness...\n\n### ❌ Violated\n- ..." }
```

The `design_review` tool is implemented as a separate Claude call: the backend sends the full scene state + all active constraints to Claude with a review-specific prompt, and returns the analysis as the tool result.

**Design review trigger:** The `DesignReviewButton` in the toolbar sends a synthetic chat message (e.g., "Please review my current design against the spec constraints") to `POST /session/{id}/chat`, which triggers the agent to call the `design_review` tool.

#### 5.3.1 Design Review Implementation

The inner Claude call for design review uses:
- **Model:** Same as main agent (`claude-opus-4-6`), or `claude-sonnet-4-6` for faster response
- **`tool_choice: "none"`** — the review call should produce analysis text, not tool calls
- **Timeout:** 30 seconds
- **Prompt template** (in `prompts/review_prompt.py`):

```
You are a CAD design reviewer. Analyze the current 3D design against the loaded engineering constraints.

## Current Scene State
{scene_state_json}

## Active Constraints
{constraints_json}

## Instructions
For each active constraint, evaluate whether the current design satisfies it:
- ✅ Satisfied: the design meets this constraint (explain how)
- ⚠️ Warning: the design is close but may have issues (explain the risk)
- ❌ Violated: the design does not meet this constraint (explain the gap)

Also note:
- Any objects that seem misplaced or incorrectly sized
- Potential interference between parts
- Missing features that the constraints imply should exist

Be specific — reference object IDs, dimensions, and constraint values.
```

### 5.4 Conversation History Management

The backend maintains a list of Claude messages per session. Each voice/chat interaction appends:

1. A user message containing the transcript/text
2. Assistant messages containing Claude's responses (text + tool use)
3. Tool result messages for each tool call

To prevent context window overflow, the backend trims history to the most recent 40 entries in the Claude messages array (where an "entry" = one element in the `messages` list). Always trim at a complete turn boundary — never split a `tool_use`/`tool_result` pair. A turn boundary is the point between a `tool_result` user message and the next assistant message, or between an assistant message (with `stop_reason: "end_turn"`) and the next user message. Older history is summarized: the first message in the trimmed history becomes a system-injected summary of what was discussed/built previously. For the hackathon, use template-based summarization: `"Previous conversation summary: {n} messages trimmed. Objects in scene at that point: {object_list}. Last user request: {last_trimmed_user_msg}"`.

The current scene state is injected as part of the user message on each turn, using this format:
```
[Current Scene State]
{scene_state_json}

[User Message]
{transcript_or_text}
```
This is placed in the `content` of the user message (not in the system prompt), so it's always fresh.

---

## 6. Spec Sheet Extraction Pipeline

### 6.1 Extraction Flow

```
PDF Upload
  │
  ▼
OpenDataLoader (local)
  ├── Structured JSON
  └── Markdown
  │
  ▼
Page Classification (>70% text-like elements by count → text; otherwise → diagram)
  ├── Text/Table pages → send text/markdown to Claude
  └── Diagram pages → extract images via image_output="embedded" (Base64), send to Claude vision
  │
  ▼
Claude Constraint Extraction (per page or page group, with tool_choice forcing extract_constraints)
  │
  ▼
Constraint JSON → store in session
```

### 6.2 OpenDataLoader Configuration

```python
import opendataloader_pdf

opendataloader_pdf.convert(
    input_path=[pdf_path],
    output_dir=output_dir,
    format="markdown,json",
    image_output="embedded"  # Base64-encode extracted images in JSON output
)
```

**OpenDataLoader JSON output schema:** Each element in the JSON output follows this structure:
```json
{
  "type": "heading",        // heading, paragraph, table, list, image, caption, formula
  "id": 42,
  "page number": 1,
  "bounding box": [72.0, 700.0, 540.0, 730.0],  // [left, bottom, right, top] in PDF points
  "content": "Introduction",
  "level": "Title",
  "heading level": 1,
  "font": "Helvetica-Bold",
  "font size": 24.0
}
```
With `image_output="embedded"`, elements of `type: "image"` include a `"content"` field containing the Base64-encoded image data (PNG or JPEG). This eliminates the need for a separate rasterization library.

Alternatively, OpenDataLoader's hybrid mode (`hybrid="docling-fast"`) can route complex/diagram-heavy pages to an AI backend for enhanced accuracy, including chart/image descriptions.

The parsed output provides both Markdown (for LLM consumption) and structured JSON (with bounding boxes, element types, page numbers). Page classification (see below) determines whether to send text or extracted images to Claude.

**Page classification threshold:** A page is classified as text/table if >70% of its elements are text-like (paragraphs, tables, headings). Otherwise it's treated as a diagram page and its extracted images are sent to Claude vision. "70% by element count" means: text-like = heading, paragraph, table, list, caption, formula; diagram-like = image. For diagram pages, collect all elements with `type: "image"`, decode their Base64 content, and send as image content blocks to Claude vision.

### 6.3 Constraint Extraction Prompt

**Extraction mode:** Use Anthropic tool-use mode instead of free-form JSON text output. Define the constraint schema as a tool; Claude "calls" it with structured output. This ensures reliable JSON formatting. Use `tool_choice: {"type": "tool", "name": "extract_constraints"}` to force Claude to call the extraction tool (without this, Claude may respond with text instead).

**Constraint IDs:** The backend generates constraint IDs server-side using a running counter (`c1`, `c2`, ...). Any IDs returned by Claude in the tool call are ignored and replaced.

The extraction uses a tool definition:
```json
{
  "name": "extract_constraints",
  "description": "Extract engineering constraints from a spec sheet page",
  "input_schema": {
    "type": "object",
    "properties": {
      "constraints": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "category": { "type": "string", "enum": ["dimensional", "mounting", "clearance", "interface", "material", "electrical", "thermal", "other"] },
            "feature_tags": { "type": "array", "items": { "type": "string" } },
            "description": { "type": "string" },
            "type": { "type": "string", "enum": ["dimension", "position", "position_array", "tolerance", "material", "clearance", "weight", "electrical", "thermal", "enumeration"] },
            "value": { "type": ["object", "array"] },
            "unit": { "type": "string" },
            "rationale": { "type": "string" }
          },
          "required": ["category", "feature_tags", "description", "type", "value", "unit", "rationale"]
        }
      }
    },
    "required": ["constraints"]
  }
}
```

System prompt for extraction:
```
You are a technical specification extraction system. Analyze the following content from a technical spec sheet and extract ALL engineering constraints, dimensions, positions, and specifications by calling the extract_constraints tool.

## Input
{content_type: "markdown" | "image"}
{content}

## Constraint value formats (by type):
- dimension: {"length": number} or {"width": number, "height": number} or {"diameter": number} etc.
- position: {"x": number, "y": number} or {"x": number, "y": number, "z": number}
- position_array: [{"x": number, "y": number, "label": "optional"}, ...]
- tolerance: {"nominal": number, "plus": number, "minus": number}
- clearance: {"min": number, "max": number (optional)}
- material: {"name": "string", "properties": {"density": number, ...}}
- weight: {"value": number}
- electrical: {"voltage": number, "current": number} or {"power": number} etc.
- thermal: {"min_temp": number, "max_temp": number} or {"dissipation": number}
- enumeration: {"options": ["option1", "option2"]} or {"value": "string"}
- unit: measurement unit (e.g., "mm", "g", "°C", "V", "A", "W")
- rationale: why this matters for someone designing around this component (1 sentence)

## Instructions
- Extract EVERYTHING: dimensions, hole positions, connector locations, component heights, board thickness, weight, electrical ratings, thermal limits, material specs
- For position data, note the reference point / origin clearly in the rationale
- For arrays of positions (e.g., mounting holes), use the position_array type
- Normalize all dimensions to mm, weights to grams, temperatures to °C
- If a diagram shows dimensions with callout lines, extract each labeled dimension
- Generate meaningful feature_tags that someone might search for when designing an enclosure, mount, or adapter for this component

Call the extract_constraints tool with all extracted constraints.
```

### 6.4 Constraint Store

```python
class Constraint:
    id: str
    category: str
    feature_tags: list[str]
    description: str
    type: str
    value: dict | list
    unit: str
    rationale: str
    source: ConstraintSource
    active: bool = True

class ConstraintSource:
    spec_id: str
    page: int
    bbox: Optional[list[float]]  # [x1, y1, x2, y2] from OpenDataLoader

class ConstraintStore:
    spec_metadata: Optional[SpecMetadata]
    constraints: dict[str, Constraint]  # id → constraint

    def get_summary(self) -> dict:
        """Returns overview for agent context"""

    def get_by_category(self, category: str) -> list[Constraint]:
        """Filter by category"""

    def get_detail(self, constraint_id: str) -> Constraint:
        """Full constraint details"""

    def search(self, query: str) -> list[Constraint]:
        """Keyword search across feature_tags, description, category"""

    def get_active(self) -> list[Constraint]:
        """All active constraints"""

    def set_active(self, constraint_id: str, active: bool) -> Constraint:
        """Toggle a constraint active/inactive. Raises KeyError if not found."""

    def clear(self):
        """Remove all constraints and spec metadata"""
```

The `search` method does case-insensitive substring matching across feature_tags, description, and category fields. No vector search needed for single-document scope.

---

## 7. Codebase Structure

```
gesturecad/
├── frontend/                          # React + Vite application
│   ├── package.json
│   ├── vite.config.ts                 # Vite config (includes @jscad optimizeDeps + worker rollup config)
│   ├── postcss.config.js              # PostCSS config for Tailwind CSS
│   ├── index.html                     # Vite entry HTML
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   │
│   ├── src/
│   │   ├── main.tsx                   # React entry point, renders App
│   │   ├── App.tsx                    # Main app — assembles Viewport + Sidebar + Toolbar
│   │   ├── index.css                  # Tailwind imports + custom CSS variables
│   │   │
│   │   ├── components/
│   │   │   ├── Viewport.tsx               # Viewport container (~70% width) — composes ThreeCanvas, WebcamOverlay, GestureController, VoiceControls
│   │   │   ├── Sidebar.tsx                # Sidebar container (~30% width) — composes TabSwitcher, ChatPanel, ConstraintPanel
│   │   │   │
│   │   │   ├── viewport/
│   │   │   │   ├── ThreeCanvas.tsx        # Three.js scene setup, render loop, mesh management
│   │   │   │   ├── WebcamOverlay.tsx      # MediaPipe webcam feed + hand landmark visualization
│   │   │   │   ├── GestureController.tsx  # MediaPipe HandLandmarker → gesture detection → camera updates
│   │   │   │   └── VoiceControls.tsx      # Push-to-talk button, recording state, audio capture
│   │   │   │
│   │   │   ├── sidebar/
│   │   │   │   ├── ChatPanel.tsx          # Chat message list + text input
│   │   │   │   ├── MessageList.tsx        # Renders message components, auto-scroll
│   │   │   │   ├── UserMessage.tsx        # Voice transcript display
│   │   │   │   ├── AgentMessage.tsx       # Streamed agent text
│   │   │   │   ├── ToolCallEntry.tsx      # Tool call card with status
│   │   │   │   ├── ConstraintPanel.tsx    # Spec document + constraint list + inline sub-components
│   │   │   │   └── ConstraintItem.tsx     # Individual constraint with toggle
│   │   │   │
│   │   │   ├── toolbar/
│   │   │   │   ├── Toolbar.tsx            # Top bar container
│   │   │   │   ├── ExportButton.tsx       # STL export trigger
│   │   │   │   ├── DesignReviewButton.tsx # Triggers design audit (sends synthetic chat message)
│   │   │   │   └── ClearSceneButton.tsx   # Reset scene (with confirmation dialog)
│   │   │   │
│   │   │   └── ui/                        # shadcn/ui components (button, dialog, tabs, etc.)
│   │   │
│   │   ├── lib/
│   │   │   ├── jscad/
│   │   │   │   ├── engine.ts              # Coordinate transforms (yUpToZUp, zUpToYUp), worker interface — SOLE transform boundary
│   │   │   │   ├── worker.ts              # Web Worker: JSCAD geometry state + tool call execution + STL export
│   │   │   │   ├── converter.ts           # Direct polygon → BufferGeometry conversion (earcut triangulation)
│   │   │   │   └── exporter.ts            # Triggers Worker export_all + browser download
│   │   │   │
│   │   │   ├── three/
│   │   │   │   ├── scene.ts               # Scene, camera, lights, grid setup
│   │   │   │   ├── materials.ts           # Color palette, material factory
│   │   │   │   └── cameraController.ts    # Camera transform API (orbit, pan, zoom, reset)
│   │   │   │
│   │   │   ├── mediapipe/
│   │   │   │   ├── handTracker.ts         # MediaPipe HandLandmarker initialization + landmark stream
│   │   │   │   └── gestureDetector.ts     # Landmark analysis → gesture classification + parameters
│   │   │   │
│   │   │   ├── api/
│   │   │   │   ├── session.ts             # Session create/state API calls
│   │   │   │   ├── spec.ts                # PDF upload/delete API calls + upload SSE consumption
│   │   │   │   └── agent.ts               # Voice/chat SSE connection + tool result posting
│   │   │   │
│   │   │   ├── types/
│   │   │   │   ├── tools.ts               # TypeScript interfaces for tool calls and results
│   │   │   │   ├── constraints.ts         # Constraint, ConstraintSource, SpecMetadata types
│   │   │   │   ├── scene.ts               # SceneObject, Operation, SceneState types
│   │   │   │   ├── events.ts              # SSE event type definitions
│   │   │   │   └── jscad.d.ts             # Type declarations: declare module '@jscad/modeling' and '@jscad/stl-serializer'
│   │   │   │
│   │   │   └── utils.ts                   # shadcn/ui cn() helper: export function cn(...inputs) { return twMerge(clsx(inputs)) }
│   │   │
│   │   └── hooks/
│   │       ├── useSession.ts              # Session lifecycle management
│   │       ├── useAgent.ts                # SSE connection, tool call dispatch, message state
│   │       ├── useJscad.ts                # JSCAD engine instance + tool execution
│   │       ├── useGestures.ts             # MediaPipe + gesture detection lifecycle
│   │       ├── useVoice.ts                # Audio recording state machine
│   │       └── useConstraints.ts          # Constraint panel state + toggle API calls
│
├── backend/                           # FastAPI application
│   ├── requirements.txt
│   ├── pyproject.toml
│   │
│   ├── app/
│   │   ├── __init__.py                # Package init
│   │   ├── main.py                    # FastAPI app, CORS config, lifespan
│   │   ├── config.py                  # Environment variables, API keys, model names
│   │   │
│   │   ├── routers/
│   │   │   ├── __init__.py            # Package init
│   │   │   ├── session.py             # POST /session, GET /session/{id}/state
│   │   │   ├── voice.py               # POST /session/{id}/voice, POST /session/{id}/chat
│   │   │   ├── spec.py                # POST /session/{id}/upload-spec, DELETE /session/{id}/spec, PATCH /session/{id}/constraints/{id}
│   │   │   └── tools.py               # POST /session/{id}/tool-result
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py            # Package init
│   │   │   ├── whisper.py             # OpenAI Whisper API client
│   │   │   ├── agent.py               # Claude API client, conversation loop, tool dispatch
│   │   │   ├── extraction.py          # OpenDataLoader runner + Claude extraction prompt
│   │   │   ├── constraint_store.py    # ConstraintStore class + search
│   │   │   └── scene_state.py         # SceneState class + abstract model updates
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py            # Package init
│   │   │   ├── session.py             # Session (dataclass, not Pydantic — see Section 4.3), SpecMetadata (Pydantic)
│   │   │   ├── constraints.py         # Constraint, ConstraintSource models
│   │   │   ├── scene.py               # SceneObject, Operation, SceneState models
│   │   │   ├── tools.py               # ToolCall, ToolResult models
│   │   │   └── events.py              # SSE event Pydantic models
│   │   │
│   │   └── prompts/
│   │       ├── system_prompt.py       # Agent system prompt (see Section 5.2)
│   │       ├── extraction_prompt.py   # Constraint extraction prompt (see Section 6.3)
│   │       └── review_prompt.py       # Design review prompt (see Section 5.3.1)
│   │
│   └── tests/                         # Optional for hackathon
│       └── ...

Note: Sub-components (TabSwitcher, PushToTalkButton, StatusIndicator, TextInput,
ConstraintLookupEntry, UploadButton, EmptyState, SpecDocumentCard, ConstraintList)
are inlined in their parent component files, not separate files.

├── .env.example                       # Required environment variables
├── docker-compose.yml                 # Optional: backend + frontend containers
└── README.md                          # Setup instructions, demo script
```

---

## 8. Environment & Dependencies

### 8.1 Environment Variables

```env
# Backend
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...                 # For Whisper API

# Frontend (public, Vite convention)
VITE_API_URL=http://localhost:8000
```

### 8.2 Frontend Dependencies

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "three": "^0.162",
    "@jscad/modeling": "^2",
    "@jscad/stl-serializer": "^2",
    "@mediapipe/tasks-vision": "^0.10",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "tailwind-merge": "^2",
    "lucide-react": "^0.300",
    "eventsource-parser": "^1",
    "earcut": "^3"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "tailwindcss": "^3",
    "postcss": "^8",
    "autoprefixer": "^10",
    "@rollup/plugin-commonjs": "^25",
    "@types/earcut": "^2"
  }
}
```

Note: `three` ^0.162 is required for the `three/addons/` import path (introduced in 0.162) and complete addon TypeScript types. No separate `@types/three` needed. shadcn/ui components are copied into `src/components/ui/` via the CLI, not installed as a package. The `cn()` utility from shadcn/ui requires `tailwind-merge` + `clsx`.

### 8.3 Backend Dependencies

```
fastapi>=0.110
uvicorn>=0.30
sse-starlette>=2.0
python-multipart>=0.0.9
anthropic>=0.40
openai>=1.50
opendataloader-pdf>=2.0
pydantic>=2.0
python-dotenv>=1.0
```

### 8.4 System Requirements

- Node.js 18+
- Python 3.11+
- Java 11+ (required by OpenDataLoader)
- Webcam (for hand tracking)
- Microphone (for voice input)

---

## 9. Implementation Priorities

### 9.1 Build Order (Hackathon Timeline)

**Phase 1 — Environment Setup (Hour 0-1)**

1. Environment setup: API keys, install all dependencies (frontend + backend)
2. Test API connectivity: Whisper API, Claude API (Opus)
3. Verify OpenDataLoader works (Java 11+ on PATH)

**Phase 2 — Scaffold + JSCAD→Three.js + Scene (Hour 1-3.5)**

4. **Scaffold Vite + React app with Tailwind** (must be first — everything else depends on it)
5. Set up JSCAD Web Worker with typed message protocol (`WorkerRequest`/`WorkerResponse`)
6. Validate JSCAD→Three.js direct conversion pipeline (polygon→BufferGeometry with earcut, no STL round-trip)
7. Get Three.js scene rendering with grid, lights, and a test primitive from the Web Worker
8. Smoke test: verify coordinate transforms (`yUpToZUp`/`zUpToYUp`) produce correct visual orientation

**Phase 3 — Agent Core via Text Chat (Hour 3.5-8)**

*Allocated 4.5 hours — this is the riskiest integration point. Get a single tool call round-trip working end-to-end before building out the full tool set.*

9. Set up FastAPI backend with CORS and session endpoint
10. Build agent service: Claude API (Opus) with corrected tool-use loop (batch tool results in single user message with `tool_result` content blocks, while-loop on `stop_reason`)
11. Implement SSE streaming from backend to frontend (using fetch + eventsource-parser)
12. Implement tool call dispatch on frontend (receive tool_call → execute on JSCAD Worker → POST result)
13. Build text chat input + basic chat log UI
14. Test: type "add a red box" → agent creates it → appears in viewport
15. Test: multi-tool batch — "add a box and a cylinder" → both appear

**Phase 4 — Voice Integration (Hour 8-9.5)**

16. Request camera+mic with a single `getUserMedia({video: true, audio: true})` call — store both tracks. Audio track is used here; video track is stored for Phase 7 (gesture input) to avoid a second permission prompt.
17. Implement push-to-talk audio recording (with webm/mp4/default fallback)
18. Build `/voice` endpoint: receive audio → Whisper → transcript → agent loop
19. Test: user speaks "add a cylinder" → agent creates it → appears in viewport

**Phase 5 — Chat Log + Constraint Store + STL + Review (Hour 9.5-11.5)**

20. Build full chat log UI showing transcripts, agent text, and tool calls
21. Build constraint store with search/query methods (needed before UI can wire to it)
22. Build constraint panel UI with toggle (wired to PATCH endpoint)
23. Test: constraint toggle updates active state
24. STL export button (triggers Worker `export_all` → browser download)
25. Design review button (synthetic chat message)

**Phase 6 — PDF Upload + Constraint Extraction (Hour 11.5-14)**

*Allocated 2.5 hours. Start by hard-coding demo constraints (30 min) to de-risk the demo, then build the real pipeline.*

26. **Hard-code 5-10 demo constraints** for the demo spec sheet (e.g., Raspberry Pi) as a fallback
27. Build PDF upload endpoint with parsing + SSE progress streaming
28. Implement constraint extraction using Claude tool-use mode with `tool_choice`
29. Wire constraint tools into agent tool definitions
30. Test: upload a spec sheet → constraints appear in panel → agent references them

**Phase 7 — Gesture Input (Hour 14-15)**

31. Integrate MediaPipe HandLandmarker (tasks-vision) with webcam overlay, using the video track stored in Phase 4
32. Implement gesture detection (orbit, pan, zoom, reset)
33. Wire gestures to Three.js camera transforms

**Phase 8 — Polish + Demo Prep (Hour 15-16)**

34. Error handling: tool call failures, timeouts, Worker crash recovery
35. UI polish: loading states, animations, responsive layout
36. Prepare demo script and test with a real spec sheet (e.g., Raspberry Pi)
37. **Protect 1+ hour for demo prep**

### 9.2 Critical Path

The riskiest integration point is Phase 3 — the bidirectional tool call loop between backend SSE and frontend JSCAD Web Worker execution. If this doesn't work smoothly, the entire agent interaction breaks. Prioritize getting a single tool call round-trip working end-to-end before building out the full tool set.

The second riskiest piece is Phase 2 — JSCAD-to-Three.js direct conversion + Web Worker setup. If the polygon→BufferGeometry pipeline has issues or the Web Worker communication breaks, it blocks all visual output. Validate this in the first phase.

### 9.3 Graceful Degradation

If time runs short, these can be cut without breaking the core demo:

- Gesture input → fall back to mouse OrbitControls (built into Three.js)
- Spec sheet ingestion → manually define a few constraints in code for the demo
- Constraint panel UI → show constraints in the chat log only
- Design review → skip entirely
- SSE streaming → use regular POST/response (agent completes full turn, frontend replays). Note: this is a non-trivial fallback that requires restructuring the response handling — plan for it if attempting.
- Web Worker → run JSCAD on main thread as fallback (may cause UI freezes on complex booleans, and requires refactoring the message-based interface)

The minimum viable demo is: Three.js viewport + voice command → agent creates geometry → it appears in the viewport. Everything else is enhancement.
