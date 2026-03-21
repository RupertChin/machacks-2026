import { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { JscadEngine } from "@/lib/jscad/engine";
import { createMaterial } from "@/lib/three/materials";
import type { WorkerResponse, ToolResultPayload } from "@/lib/types/tools";
import type { ThreeCanvasHandle } from "@/components/viewport/ThreeCanvas";

export function useJscad(canvasRef: React.RefObject<ThreeCanvasHandle | null>) {
  const engineRef = useRef<JscadEngine | null>(null);
  const sceneObjectIdsRef = useRef<Set<string>>(new Set());
  const [objectCount, setObjectCount] = useState(0);

  useEffect(() => {
    engineRef.current = new JscadEngine(() => {
      console.warn("JSCAD Worker crashed — geometry state lost");
      sceneObjectIdsRef.current.clear();
      setObjectCount(0);
    });

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const executeTool = useCallback(
    async (
      opId: string,
      toolName: string,
      parameters: Record<string, any>,
    ): Promise<ToolResultPayload> => {
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas) {
        return { op_id: opId, status: "failure", error: "Engine not ready" };
      }

      try {
        // Handle delete_object separately
        if (toolName === "delete_object") {
          const objectId = parameters.object_id;
          await engine.deleteObject(objectId);
          canvas.removeMesh(objectId);
          sceneObjectIdsRef.current.delete(objectId);
          setObjectCount(sceneObjectIdsRef.current.size);
          return {
            op_id: opId,
            status: "success",
            result: { object_id: objectId },
          };
        }

        // Handle set_color on main thread (no Worker)
        if (toolName === "set_color") {
          const objectId = parameters.object_id;
          const mesh = canvas.getMesh(objectId);
          if (mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.color.set(parameters.color);
          }
          return {
            op_id: opId,
            status: "success",
            result: { object_id: objectId },
          };
        }

        // Handle rename_object (no-op on frontend)
        if (toolName === "rename_object") {
          return {
            op_id: opId,
            status: "success",
            result: { object_id: parameters.object_id },
          };
        }

        // Capture color from first consumed object before removing (for union/intersect)
        const consumedIds = parameters.consumed_object_ids as string[] | undefined;
        let inheritedColor: string | undefined;
        if (consumedIds && consumedIds.length > 0) {
          const firstMesh = canvas.getMesh(consumedIds[0]);
          if (firstMesh && firstMesh.material instanceof THREE.MeshStandardMaterial) {
            inheritedColor = "#" + firstMesh.material.color.getHexString();
          }
        }

        // Remove consumed objects for boolean operations
        if (consumedIds) {
          for (const id of consumedIds) {
            canvas.removeMesh(id);
            sceneObjectIdsRef.current.delete(id);
          }
        }

        // Execute on Worker
        const response = await engine.executeTool(opId, toolName, parameters);

        if (response.type === "tool_result" && response.status === "success") {
          const r = response as any;
          // Create mesh from positions + normals
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(r.positions, 3));
          geometry.setAttribute("normal", new THREE.BufferAttribute(r.normals, 3));

          const color = parameters.color || inheritedColor;
          const material = createMaterial(color);
          const mesh = new THREE.Mesh(geometry, material);

          canvas.addMesh(r.object_id, mesh);
          sceneObjectIdsRef.current.add(r.object_id);
          setObjectCount(sceneObjectIdsRef.current.size);

          return {
            op_id: opId,
            status: "success",
            result: {
              object_id: r.object_id,
              bbox: r.bbox as [number, number, number, number, number, number],
            },
          };
        } else if (response.type === "tool_result_batch") {
          const r = response as any;
          const objectIds: string[] = [];

          for (const item of r.results) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(item.positions, 3));
            geometry.setAttribute("normal", new THREE.BufferAttribute(item.normals, 3));

            const color = parameters.color;
            const material = createMaterial(color);
            const mesh = new THREE.Mesh(geometry, material);

            canvas.addMesh(item.object_id, mesh);
            sceneObjectIdsRef.current.add(item.object_id);
            objectIds.push(item.object_id);
          }
          setObjectCount(sceneObjectIdsRef.current.size);

          // Compute overall bbox from all results
          let bbox: [number, number, number, number, number, number] | undefined;
          if (r.results.length > 0) {
            const first = r.results[0].bbox;
            bbox = [first[0], first[1], first[2], first[3], first[4], first[5]];
            for (const item of r.results) {
              bbox[0] = Math.min(bbox[0], item.bbox[0]);
              bbox[1] = Math.min(bbox[1], item.bbox[1]);
              bbox[2] = Math.min(bbox[2], item.bbox[2]);
              bbox[3] = Math.max(bbox[3], item.bbox[3]);
              bbox[4] = Math.max(bbox[4], item.bbox[4]);
              bbox[5] = Math.max(bbox[5], item.bbox[5]);
            }
          }

          return {
            op_id: opId,
            status: "success",
            result: { object_ids: objectIds, bbox },
          };
        } else {
          const r = response as any;
          return {
            op_id: opId,
            status: "failure",
            error: r.error || "Unknown failure",
          };
        }
      } catch (err: any) {
        return {
          op_id: opId,
          status: "failure",
          error: err.message || String(err),
        };
      }
    },
    [canvasRef],
  );

  const clearAll = useCallback(async () => {
    await engineRef.current?.clearAll();
    canvasRef.current?.clearAll();
    sceneObjectIdsRef.current.clear();
    setObjectCount(0);
  }, [canvasRef]);

  const getSceneObjectIds = useCallback(() => {
    return Array.from(sceneObjectIdsRef.current);
  }, []);

  const getEngine = useCallback(() => engineRef.current, []);

  return { executeTool, clearAll, getSceneObjectIds, getEngine, objectCount };
}
