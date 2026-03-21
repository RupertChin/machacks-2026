import { useState, useEffect } from "react";
import { createSession } from "@/lib/api/session";

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createSession()
      .then((res) => {
        setSessionId(res.session_id);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { sessionId, loading, error };
}
