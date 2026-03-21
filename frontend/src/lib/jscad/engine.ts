// JSCAD coordinate transforms and worker interface
// SOLE transform boundary: all y-up <-> z-up conversions happen here

import type { WorkerRequest, WorkerResponse } from "@/lib/types/tools";

export function yUpToZUp(v: [number, number, number]): [number, number, number] {
  return [v[0], -v[2], v[1]];
}

export function zUpToYUp(v: [number, number, number]): [number, number, number] {
  return [v[0], v[2], -v[1]];
}

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
};

export class JscadEngine {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private ready = false;
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private onCrash?: () => void;

  constructor(onCrash?: () => void) {
    this.onCrash = onCrash;
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.spawnWorker();
  }

  private spawnWorker(): void {
    this.worker = new Worker(
      new URL("./worker.ts", import.meta.url),
      { type: "module" }
    );

    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as WorkerResponse & { type: string };

      if ((msg as any).type === "ready") {
        this.ready = true;
        this.readyResolve();
        return;
      }

      // Route responses to pending requests
      if (msg.type === "tool_result" || msg.type === "tool_result_batch") {
        const opId = (msg as any).op_id;
        const pending = this.pendingRequests.get(opId);
        if (pending) {
          this.pendingRequests.delete(opId);
          pending.resolve(msg);
        }
      } else if (msg.type === "delete_result") {
        // delete_result has no op_id; resolve by object_id convention
        const objectId = (msg as any).object_id as string;
        const pending = this.pendingRequests.get(`__delete__${objectId}`);
        if (pending) {
          this.pendingRequests.delete(`__delete__${objectId}`);
          pending.resolve(msg);
        }
      } else if (msg.type === "clear_result") {
        const pending = this.pendingRequests.get("__clear__");
        if (pending) {
          this.pendingRequests.delete("__clear__");
          pending.resolve(msg);
        }
      } else if (msg.type === "export_result") {
        const pending = this.pendingRequests.get("__export__");
        if (pending) {
          this.pendingRequests.delete("__export__");
          pending.resolve(msg);
        }
      } else if (msg.type === "error") {
        // General error -- log it
        console.error("[JSCAD Worker Error]", (msg as any).message);
      }
    };

    this.worker.onerror = (err) => {
      console.error("[JSCAD Worker Crash]", err);
      this.ready = false;
      // Reject all pending requests
      for (const [, pending] of this.pendingRequests) {
        pending.reject(new Error("Worker crashed"));
      }
      this.pendingRequests.clear();
      // Respawn
      this.worker?.terminate();
      this.readyPromise = new Promise((resolve) => {
        this.readyResolve = resolve;
      });
      this.spawnWorker();
      this.onCrash?.();
    };
  }

  async waitReady(): Promise<void> {
    return this.readyPromise;
  }

  async executeTool(opId: string, toolName: string, parameters: Record<string, any>): Promise<WorkerResponse> {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(opId, { resolve, reject });
      this.worker!.postMessage({
        type: "execute_tool",
        op_id: opId,
        tool_name: toolName,
        parameters,
      } satisfies WorkerRequest);
    });
  }

  async deleteObject(objectId: string): Promise<void> {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(`__delete__${objectId}`, {
        resolve: () => resolve(),
        reject,
      });
      this.worker!.postMessage({
        type: "delete_object",
        object_id: objectId,
      } satisfies WorkerRequest);
    });
  }

  async clearAll(): Promise<void> {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set("__clear__", {
        resolve: () => resolve(),
        reject,
      });
      this.worker!.postMessage({ type: "clear_all" } satisfies WorkerRequest);
    });
  }

  async exportAll(): Promise<ArrayBuffer> {
    await this.readyPromise;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set("__export__", {
        resolve: (msg: any) => resolve(msg.data),
        reject,
      });
      this.worker!.postMessage({ type: "export_all", format: "stl" } satisfies WorkerRequest);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pendingRequests.clear();
  }
}
