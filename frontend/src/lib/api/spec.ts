import { createParser } from "eventsource-parser";
import type { SSECallback } from "./agent";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function uploadSpec(
  sessionId: string,
  file: File,
  onEvent: SSECallback,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/session/${sessionId}/upload-spec`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }

  // Consume SSE
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  const parser = createParser((event) => {
    if (event.type === "event") {
      try {
        const data = JSON.parse(event.data);
        onEvent(event.event || "message", data);
      } catch {
        // Ignore
      }
    }
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
}

export async function deleteSpec(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/session/${sessionId}/spec`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete spec failed: ${res.status}`);
  }
}

export async function toggleConstraint(
  sessionId: string,
  constraintId: string,
  active: boolean,
): Promise<any> {
  const res = await fetch(
    `${API_URL}/session/${sessionId}/constraints/${constraintId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    },
  );
  if (!res.ok) throw new Error(`Toggle constraint failed: ${res.status}`);
  return res.json();
}
