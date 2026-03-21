import { createParser } from "eventsource-parser";
import type { ToolResultPayload } from "@/lib/types/tools";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type SSECallback = (event: string, data: any) => void;

export async function sendVoice(
  sessionId: string,
  audioBlob: Blob,
  sceneObjectIds: string[],
  onEvent: SSECallback,
): Promise<void> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");
  formData.append("scene_object_ids", JSON.stringify(sceneObjectIds));

  const res = await fetch(`${API_URL}/session/${sessionId}/voice`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voice request failed (${res.status}): ${text}`);
  }

  await consumeSSE(res, onEvent);
}

export async function sendChat(
  sessionId: string,
  message: string,
  sceneObjectIds: string[],
  onEvent: SSECallback,
): Promise<void> {
  const res = await fetch(`${API_URL}/session/${sessionId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, scene_object_ids: sceneObjectIds }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat request failed (${res.status}): ${text}`);
  }

  await consumeSSE(res, onEvent);
}

export async function postToolResult(
  sessionId: string,
  payload: ToolResultPayload,
): Promise<void> {
  const res = await fetch(`${API_URL}/session/${sessionId}/tool-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok && res.status !== 410) {
    throw new Error(`Tool result POST failed: ${res.status}`);
  }
}

async function consumeSSE(res: Response, onEvent: SSECallback): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  const parser = createParser((event) => {
    if (event.type === "event") {
      try {
        const data = JSON.parse(event.data);
        onEvent(event.event || "message", data);
      } catch {
        // Ignore parse errors (e.g., ping events)
      }
    }
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
}
