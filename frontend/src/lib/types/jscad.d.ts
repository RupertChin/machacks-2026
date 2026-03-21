declare module "@jscad/modeling" {
  export const primitives: any;
  export const booleans: any;
  export const transforms: any;
  export const geometries: any;
}

declare module "@jscad/stl-serializer" {
  export function serialize(options: any, ...geometries: any[]): any;
}
