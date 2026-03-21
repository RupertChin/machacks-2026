// JSCAD coordinate transforms and worker interface
// SOLE transform boundary: all y-up ↔ z-up conversions happen here

export function yUpToZUp(v: [number, number, number]): [number, number, number] {
  return [v[0], -v[2], v[1]];
}

export function zUpToYUp(v: [number, number, number]): [number, number, number] {
  return [v[0], v[2], -v[1]];
}
