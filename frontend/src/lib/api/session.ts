const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function createSession(): Promise<{ session_id: string; created_at: string }> {
  const res = await fetch(`${API_URL}/session`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

export async function getSessionState(sessionId: string): Promise<any> {
  const res = await fetch(`${API_URL}/session/${sessionId}/state`);
  if (!res.ok) throw new Error(`Failed to get session state: ${res.status}`);
  return res.json();
}
