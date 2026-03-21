import earcut from "earcut";

interface Poly3 {
  vertices: [number, number, number][];
}

/**
 * Convert JSCAD geom3 polygons to flat Float32Arrays (positions + normals).
 * Uses earcut for triangulation to handle concave polygons from boolean ops.
 */
export function polygonsToArrays(polygons: Poly3[]): {
  positions: Float32Array;
  normals: Float32Array;
} {
  const positionsList: number[] = [];
  const normalsList: number[] = [];

  for (const poly of polygons) {
    const verts = poly.vertices;
    if (verts.length < 3) continue;

    // Compute polygon normal using Newell's method
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
      // Simple triangle — no earcut needed
      for (const v of verts) {
        positionsList.push(v[0], v[1], v[2]);
        normalsList.push(nx, ny, nz);
      }
      continue;
    }

    // Project 3D vertices to 2D for earcut
    // Choose projection plane based on dominant normal axis
    const absNx = Math.abs(nx), absNy = Math.abs(ny), absNz = Math.abs(nz);
    let coords: number[];
    if (absNx >= absNy && absNx >= absNz) {
      // Project onto YZ plane
      coords = verts.flatMap(v => [v[1], v[2]]);
    } else if (absNy >= absNx && absNy >= absNz) {
      // Project onto XZ plane
      coords = verts.flatMap(v => [v[0], v[2]]);
    } else {
      // Project onto XY plane
      coords = verts.flatMap(v => [v[0], v[1]]);
    }

    const indices = earcut(coords);
    for (const idx of indices) {
      const v = verts[idx];
      positionsList.push(v[0], v[1], v[2]);
      normalsList.push(nx, ny, nz);
    }
  }

  return {
    positions: new Float32Array(positionsList),
    normals: new Float32Array(normalsList),
  };
}

/**
 * Convert Z-up coordinates to Y-up for Three.js output.
 * Applied to all geometry coming out of JSCAD.
 */
export function zUpToYUp(v: [number, number, number]): [number, number, number] {
  return [v[0], v[2], -v[1]];
}
