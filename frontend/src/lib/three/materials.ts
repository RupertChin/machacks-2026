import * as THREE from "three";

const COLOR_PALETTE = [
  "#4488ff", // blue
  "#ff4444", // red
  "#44cc44", // green
  "#ffaa00", // orange
  "#cc44cc", // purple
  "#44cccc", // cyan
  "#ff8844", // coral
  "#8888ff", // lavender
  "#88cc44", // lime
  "#ff44aa", // pink
];

let colorIndex = 0;

export function getNextColor(): string {
  const color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
  colorIndex++;
  return color;
}

export function resetColorIndex(): void {
  colorIndex = 0;
}

export function createMaterial(color?: string): THREE.MeshStandardMaterial {
  const c = color || getNextColor();
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(c),
    metalness: 0.1,
    roughness: 0.6,
  });
}

export function disposeMaterial(material: THREE.Material): void {
  material.dispose();
}
