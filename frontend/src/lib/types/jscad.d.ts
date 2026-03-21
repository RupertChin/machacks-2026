declare module "@jscad/modeling" {
  export namespace primitives {
    function cuboid(options: { size: [number, number, number]; center?: [number, number, number] }): Geom3;
    function cylinder(options: { radius: number; height: number; center?: [number, number, number]; segments?: number }): Geom3;
    function sphere(options: { radius: number; center?: [number, number, number]; segments?: number }): Geom3;
    function torus(options: { innerRadius: number; outerRadius: number; innerSegments?: number; outerSegments?: number }): Geom3;
  }
  export namespace booleans {
    function subtract(a: Geom3, ...b: Geom3[]): Geom3;
    function union(...geometries: Geom3[]): Geom3;
    function intersect(...geometries: Geom3[]): Geom3;
  }
  export namespace transforms {
    function translate(offset: [number, number, number], geometry: Geom3): Geom3;
    function rotate(angles: [number, number, number], geometry: Geom3): Geom3;
    function scale(factors: [number, number, number], geometry: Geom3): Geom3;
    function center(options: { axes?: [boolean, boolean, boolean] }, geometry: Geom3): Geom3;
  }
  export namespace geometries {
    namespace geom3 {
      interface Poly3 {
        vertices: [number, number, number][];
      }
      function toPolygons(geometry: Geom3): Poly3[];
    }
  }
  export namespace measurements {
    function measureCenter(geometry: Geom3): [number, number, number];
    function measureBoundingBox(geometry: Geom3): [[number, number, number], [number, number, number]];
  }
  export interface Geom3 {
    polygons: any[];
    transforms: number[];
  }
}

declare module "@jscad/stl-serializer" {
  import type { Geom3 } from "@jscad/modeling";
  export function serialize(options: { binary: boolean }, ...geometries: Geom3[]): ArrayBuffer[];
}
