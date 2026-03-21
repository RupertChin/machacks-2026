/**
 * Simple material factory with a rotating color palette for CAD objects.
 *
 * Each call to `createMaterial()` without an explicit color picks the next
 * color in the palette, cycling back to the beginning when exhausted.
 */

import * as THREE from "three";

const PALETTE = [
  "#4488ff",
  "#ff4488",
  "#44ff88",
  "#ff8844",
  "#8844ff",
  "#88ff44",
  "#ff44ff",
  "#44ffff",
];

let colorIndex = 0;

/** Create a MeshStandardMaterial with the given color, or the next palette color. */
export function createMaterial(
  color?: string
): THREE.MeshStandardMaterial {
  const c = color ?? PALETTE[colorIndex++ % PALETTE.length];
  return new THREE.MeshStandardMaterial({ color: c });
}

/** Reset the palette index back to the first color. */
export function resetPalette(): void {
  colorIndex = 0;
}
