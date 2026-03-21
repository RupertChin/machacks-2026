// JSCAD Web Worker — geometry state + tool call execution + STL export
// This file runs in a Web Worker context

// Use inline types to avoid path alias issues in worker bundling
type Vec3 = [number, number, number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let jscad: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stlSerializer: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let earcutFn: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geometries = new Map<string, any>();

// ── Coordinate transforms ────────────────────────────────────────────
// Worker needs its own copies (cannot import from engine.ts on main thread)

function yUpToZUp(v: Vec3): Vec3 {
  return [v[0], -v[2], v[1]];
}

function zUpToYUp(v: Vec3): Vec3 {
  return [v[0], v[2], -v[1]];
}

function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ── Polygon triangulation ────────────────────────────────────────────
// Inline converter to avoid import issues in Worker context

function polygonsToArrays(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  polygons: any[]
): { positions: Float32Array; normals: Float32Array } {
  const positionsList: number[] = [];
  const normalsList: number[] = [];

  for (const poly of polygons) {
    const verts: Vec3[] = poly.vertices;
    if (verts.length < 3) continue;

    // Newell's method for polygon normal
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < verts.length; i++) {
      const curr = verts[i];
      const next = verts[(i + 1) % verts.length];
      nx += (curr[1] - next[1]) * (curr[2] + next[2]);
      ny += (curr[2] - next[2]) * (curr[0] + next[0]);
      nz += (curr[0] - next[0]) * (curr[1] + next[1]);
    }
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len === 0) continue;
    nx /= len; ny /= len; nz /= len;

    if (verts.length === 3) {
      const tn = zUpToYUp([nx, ny, nz]);
      for (const v of verts) {
        const tv = zUpToYUp(v);
        positionsList.push(tv[0], tv[1], tv[2]);
        normalsList.push(tn[0], tn[1], tn[2]);
      }
      continue;
    }

    // Project to 2D for earcut triangulation
    const absNx = Math.abs(nx), absNy = Math.abs(ny), absNz = Math.abs(nz);
    let coords: number[];
    if (absNx >= absNy && absNx >= absNz) {
      coords = verts.flatMap(v => [v[1], v[2]]);
    } else if (absNy >= absNx && absNy >= absNz) {
      coords = verts.flatMap(v => [v[0], v[2]]);
    } else {
      coords = verts.flatMap(v => [v[0], v[1]]);
    }

    const tn = zUpToYUp([nx, ny, nz]);

    if (earcutFn) {
      const indices = earcutFn(coords);
      for (const idx of indices) {
        const v = verts[idx];
        const tv = zUpToYUp(v);
        positionsList.push(tv[0], tv[1], tv[2]);
        normalsList.push(tn[0], tn[1], tn[2]);
      }
    } else {
      // Fallback: fan triangulation (may fail on concave polygons)
      for (let i = 1; i < verts.length - 1; i++) {
        for (const idx of [0, i, i + 1]) {
          const v = verts[idx];
          const tv = zUpToYUp(v);
          positionsList.push(tv[0], tv[1], tv[2]);
          normalsList.push(tn[0], tn[1], tn[2]);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positionsList),
    normals: new Float32Array(normalsList),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeBBox(geom: any): number[] {
  const bbox = jscad.measurements.measureBoundingBox(geom);
  // Convert min/max from Z-up to Y-up
  const min = zUpToYUp(bbox[0] as Vec3);
  const max = zUpToYUp(bbox[1] as Vec3);
  return [
    Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2]),
    Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2]),
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function geometryToArrays(geom: any): { positions: Float32Array; normals: Float32Array } {
  const polys = jscad.geometries.geom3.toPolygons(geom);
  return polygonsToArrays(polys);
}

// ── Tool execution ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleExecuteTool(op_id: string, tool_name: string, params: Record<string, any>): void {
  try {
    switch (tool_name) {
      case "add_primitive": {
        const objectId = params.object_id as string;
        const pType = params.type as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dims = params.dimensions || {} as any;
        const pos = params.position
          ? yUpToZUp(params.position as Vec3)
          : [0, 0, 0] as Vec3;
        const rot = params.rotation
          ? yUpToZUp([
              degreesToRadians(params.rotation[0]),
              degreesToRadians(params.rotation[1]),
              degreesToRadians(params.rotation[2]),
            ] as Vec3)
          : null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let geom: any;
        switch (pType) {
          case "cuboid": {
            const size: Vec3 = dims.size
              ? (dims.size as Vec3)
              : [dims.width ?? 10, dims.height ?? 10, dims.depth ?? 10];
            // Swap Y↔Z axes for size (no negation — JSCAD requires positive sizes)
            geom = jscad.primitives.cuboid({
              size: [size[0], size[2], size[1]],
            });
            break;
          }
          case "cylinder":
            geom = jscad.primitives.cylinder({
              radius: dims.radius,
              height: dims.height,
            });
            break;
          case "sphere":
            geom = jscad.primitives.sphere({ radius: dims.radius });
            break;
          case "torus":
            geom = jscad.primitives.torus({
              innerRadius: dims.innerRadius,
              outerRadius: dims.outerRadius,
            });
            break;
          default:
            throw new Error(`Unknown primitive type: ${pType}`);
        }

        // Apply rotation if specified
        if (rot) {
          geom = jscad.transforms.rotate(rot, geom);
        }

        // Translate to position
        geom = jscad.transforms.translate(pos, geom);

        geometries.set(objectId, geom);
        const { positions, normals } = geometryToArrays(geom);
        const bbox = computeBBox(geom);

        self.postMessage(
          { type: "tool_result", op_id, status: "success", positions, normals, object_id: objectId, bbox },
          { transfer: [positions.buffer, normals.buffer] } as any
        );
        break;
      }

      case "subtract": {
        const targetId = params.target_id as string;
        const toolIds: string[] = params.tool_ids || (params.tool_id ? [params.tool_id] : []);
        const target = geometries.get(targetId);
        if (!target) throw new Error(`Target object ${targetId} not found`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools: any[] = [];
        for (const tid of toolIds) {
          const t = geometries.get(tid);
          if (!t) throw new Error(`Tool object ${tid} not found`);
          tools.push(t);
        }

        let result = target;
        for (const tool of tools) {
          result = jscad.booleans.subtract(result, tool);
        }

        // Remove tool objects, keep target with new geometry
        for (const tid of toolIds) {
          geometries.delete(tid);
        }
        geometries.set(targetId, result);

        const { positions, normals } = geometryToArrays(result);
        const bbox = computeBBox(result);

        self.postMessage(
          { type: "tool_result", op_id, status: "success", positions, normals, object_id: targetId, bbox },
          { transfer: [positions.buffer, normals.buffer] } as any
        );
        break;
      }

      case "union": {
        const objectIds = params.object_ids as string[];
        const newId = params.object_id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geoms: any[] = [];
        for (const id of objectIds) {
          const g = geometries.get(id);
          if (!g) throw new Error(`Object ${id} not found`);
          geoms.push(g);
        }

        const result = jscad.booleans.union(...geoms);

        // Remove input objects
        for (const id of objectIds) {
          geometries.delete(id);
        }
        geometries.set(newId, result);

        const { positions, normals } = geometryToArrays(result);
        const bbox = computeBBox(result);

        self.postMessage(
          { type: "tool_result", op_id, status: "success", positions, normals, object_id: newId, bbox },
          { transfer: [positions.buffer, normals.buffer] } as any
        );
        break;
      }

      case "intersect": {
        const objectIds = params.object_ids as string[];
        const newId = params.object_id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geoms: any[] = [];
        for (const id of objectIds) {
          const g = geometries.get(id);
          if (!g) throw new Error(`Object ${id} not found`);
          geoms.push(g);
        }

        const result = jscad.booleans.intersect(...geoms);

        for (const id of objectIds) {
          geometries.delete(id);
        }
        geometries.set(newId, result);

        const { positions, normals } = geometryToArrays(result);
        const bbox = computeBBox(result);

        self.postMessage(
          { type: "tool_result", op_id, status: "success", positions, normals, object_id: newId, bbox },
          { transfer: [positions.buffer, normals.buffer] } as any
        );
        break;
      }

      case "move_object": {
        const objectId = params.object_id as string;
        let geom = geometries.get(objectId);
        if (!geom) throw new Error(`Object ${objectId} not found`);

        if (params.delta) {
          const delta = yUpToZUp(params.delta as Vec3);
          geom = jscad.transforms.translate(delta, geom);
        } else if (params.position) {
          const targetPos = yUpToZUp(params.position as Vec3);
          const currentCenter = jscad.measurements.measureCenter(geom);
          const delta: Vec3 = [
            targetPos[0] - currentCenter[0],
            targetPos[1] - currentCenter[1],
            targetPos[2] - currentCenter[2],
          ];
          geom = jscad.transforms.translate(delta, geom);
        }

        geometries.set(objectId, geom);
        const { positions, normals } = geometryToArrays(geom);
        const bbox = computeBBox(geom);

        self.postMessage(
          { type: "tool_result", op_id, status: "success", positions, normals, object_id: objectId, bbox },
          { transfer: [positions.buffer, normals.buffer] } as any
        );
        break;
      }

      case "rotate_object": {
        const objectId = params.object_id as string;
        let geom = geometries.get(objectId);
        if (!geom) throw new Error(`Object ${objectId} not found`);

        const axis = params.axis as string;
        const angleDeg = params.angle_degrees as number;
        const angleRad = degreesToRadians(angleDeg);

        // Build Euler rotation vector in Y-up space
        let euler: Vec3 = [0, 0, 0];
        if (axis === "x") euler = [angleRad, 0, 0];
        else if (axis === "y") euler = [0, angleRad, 0];
        else if (axis === "z") euler = [0, 0, angleRad];

        // Convert Y-up rotation to Z-up
        euler = yUpToZUp(euler);

        // Rotate around center
        const center = jscad.measurements.measureCenter(geom);
        geom = jscad.transforms.translate(
          [-center[0], -center[1], -center[2]] as Vec3,
          geom
        );
        geom = jscad.transforms.rotate(euler, geom);
        geom = jscad.transforms.translate(center, geom);

        geometries.set(objectId, geom);
        const { positions, normals } = geometryToArrays(geom);
        const bbox = computeBBox(geom);

        self.postMessage(
          { type: "tool_result", op_id, status: "success", positions, normals, object_id: objectId, bbox },
          { transfer: [positions.buffer, normals.buffer] } as any
        );
        break;
      }

      case "scale_object": {
        const objectId = params.object_id as string;
        let geom = geometries.get(objectId);
        if (!geom) throw new Error(`Object ${objectId} not found`);

        let factors: Vec3;
        if (params.factor) {
          const f = params.factor as number;
          factors = [f, f, f];
        } else if (params.axis_factors) {
          factors = yUpToZUp(params.axis_factors as Vec3);
          // Make sure all factors are positive
          factors = [
            Math.abs(factors[0]),
            Math.abs(factors[1]),
            Math.abs(factors[2]),
          ] as Vec3;
        } else {
          throw new Error("scale_object requires factor or axis_factors");
        }

        // Scale around center
        const center = jscad.measurements.measureCenter(geom);
        geom = jscad.transforms.translate(
          [-center[0], -center[1], -center[2]] as Vec3,
          geom
        );
        geom = jscad.transforms.scale(factors, geom);
        geom = jscad.transforms.translate(center, geom);

        geometries.set(objectId, geom);
        const { positions, normals } = geometryToArrays(geom);
        const bbox = computeBBox(geom);

        self.postMessage(
          { type: "tool_result", op_id, status: "success", positions, normals, object_id: objectId, bbox },
          { transfer: [positions.buffer, normals.buffer] } as any
        );
        break;
      }

      case "clone_object": {
        const sourceId = params.object_id as string;
        const newId = params.new_object_id as string;
        const source = geometries.get(sourceId);
        if (!source) throw new Error(`Source object ${sourceId} not found`);

        const targetPos = yUpToZUp(params.position as Vec3);
        const sourceCenter = jscad.measurements.measureCenter(source);
        const delta: Vec3 = [
          targetPos[0] - sourceCenter[0],
          targetPos[1] - sourceCenter[1],
          targetPos[2] - sourceCenter[2],
        ];

        const cloned = jscad.transforms.translate(delta, source);
        geometries.set(newId, cloned);

        const { positions, normals } = geometryToArrays(cloned);
        const bbox = computeBBox(cloned);

        self.postMessage(
          { type: "tool_result", op_id, status: "success", positions, normals, object_id: newId, bbox },
          { transfer: [positions.buffer, normals.buffer] } as any
        );
        break;
      }

      case "linear_pattern": {
        const sourceId = params.object_id as string;
        const source = geometries.get(sourceId);
        if (!source) throw new Error(`Source object ${sourceId} not found`);

        const direction = yUpToZUp(params.direction as Vec3);
        const count = params.count as number;
        const spacing = params.spacing as number;
        const objectIds = params.object_ids as string[];

        const results: Array<{
          object_id: string;
          positions: Float32Array;
          normals: Float32Array;
          bbox: number[];
        }> = [];
        const transferables: ArrayBuffer[] = [];

        for (let i = 0; i < count; i++) {
          const offset: Vec3 = [
            direction[0] * spacing * (i + 1),
            direction[1] * spacing * (i + 1),
            direction[2] * spacing * (i + 1),
          ];
          const copy = jscad.transforms.translate(offset, source);
          const oid = objectIds[i];
          geometries.set(oid, copy);

          const { positions, normals } = geometryToArrays(copy);
          const bbox = computeBBox(copy);
          results.push({ object_id: oid, positions, normals, bbox });
          transferables.push(positions.buffer, normals.buffer);
        }

        self.postMessage(
          { type: "tool_result_batch", op_id, results },
          { transfer: transferables } as any
        );
        break;
      }

      default:
        throw new Error(`Unknown tool: ${tool_name}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: "tool_result",
      op_id,
      status: "failure",
      error: message,
    });
  }
}

// ── Object deletion ──────────────────────────────────────────────────

function handleDeleteObject(objectId: string): void {
  const existed = geometries.delete(objectId);
  self.postMessage({
    type: "delete_result",
    object_id: objectId,
    status: existed ? "success" : "failure",
  });
}

// ── Clear all ────────────────────────────────────────────────────────

function handleClearAll(): void {
  geometries.clear();
  self.postMessage({ type: "clear_result", status: "success" });
}

// ── STL export ───────────────────────────────────────────────────────

async function handleExportAll(): Promise<void> {
  try {
    if (!stlSerializer) {
      stlSerializer = await import("@jscad/stl-serializer");
    }
    const geomArray = Array.from(geometries.values());
    if (geomArray.length === 0) {
      self.postMessage({ type: "error", message: "No geometries to export" });
      return;
    }
    const rawData: ArrayBuffer[] = stlSerializer.serialize(
      { binary: true },
      ...geomArray
    );
    const totalLength = rawData.reduce(
      (sum: number, buf: ArrayBuffer) => sum + buf.byteLength,
      0
    );
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of rawData) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    const data = combined.buffer;
    self.postMessage(
      { type: "export_result", data, format: "stl" },
      { transfer: [data] } as any
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: "error",
      message: `Export failed: ${message}`,
    });
  }
}

// ── Initialization ───────────────────────────────────────────────────

async function init(): Promise<void> {
  // Load earcut for polygon triangulation
  try {
    const earcutModule = await import("earcut");
    earcutFn = earcutModule.default || earcutModule;
  } catch {
    console.warn("[JSCAD Worker] earcut not available, using fan triangulation fallback");
  }

  // Load JSCAD modeling library
  jscad = await import("@jscad/modeling");

  // Signal ready to main thread
  self.postMessage({ type: "ready" });
}

// ── Message handler ──────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  if (!jscad) {
    await init();
  }

  const msg = e.data;
  switch (msg.type) {
    case "execute_tool":
      handleExecuteTool(msg.op_id, msg.tool_name, msg.parameters);
      break;
    case "delete_object":
      handleDeleteObject(msg.object_id);
      break;
    case "clear_all":
      handleClearAll();
      break;
    case "export_all":
      await handleExportAll();
      break;
    default:
      self.postMessage({
        type: "error",
        message: `Unknown message type: ${msg.type}`,
      });
  }
};

// Kick off initialization immediately
init();
