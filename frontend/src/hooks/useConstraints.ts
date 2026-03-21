import { useState, useCallback } from "react";
import { uploadSpec, deleteSpec, toggleConstraint } from "@/lib/api/spec";
import type { Constraint, SpecMetadata } from "@/lib/types/constraints";

export function useConstraints(sessionId: string | null) {
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [specMetadata, setSpecMetadata] = useState<SpecMetadata | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleUploadSpec = useCallback(
    async (file: File) => {
      if (!sessionId) return;
      setUploadProgress("parsing");

      try {
        await uploadSpec(sessionId, file, (eventType, data) => {
          switch (eventType) {
            case "upload_progress":
              setUploadProgress(data.stage);
              break;
            case "upload_complete":
              setConstraints(data.constraints);
              setSpecMetadata({
                spec_id: data.spec_id,
                filename: data.filename,
                page_count: data.page_count,
                uploaded_at: new Date().toISOString(),
              });
              setUploadProgress(null);
              break;
            case "upload_error":
              setUploadProgress(null);
              console.error("Upload error:", data.message);
              break;
          }
        });
      } catch (err) {
        setUploadProgress(null);
        console.error("Upload failed:", err);
      }
    },
    [sessionId],
  );

  const handleDeleteSpec = useCallback(async () => {
    if (!sessionId) return;
    try {
      await deleteSpec(sessionId);
      setConstraints([]);
      setSpecMetadata(null);
    } catch (err) {
      console.error("Delete spec failed:", err);
    }
  }, [sessionId]);

  const handleToggleConstraint = useCallback(
    async (constraintId: string, active: boolean) => {
      if (!sessionId) return;
      try {
        const updated = await toggleConstraint(sessionId, constraintId, active);
        setConstraints((prev) =>
          prev.map((c) => (c.id === constraintId ? { ...c, ...updated } : c))
        );
      } catch (err) {
        console.error("Toggle constraint failed:", err);
      }
    },
    [sessionId],
  );

  return {
    constraints,
    specMetadata,
    uploadProgress,
    handleUploadSpec,
    handleDeleteSpec,
    handleToggleConstraint,
  };
}
