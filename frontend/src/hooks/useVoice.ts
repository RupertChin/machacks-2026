import { useState, useRef, useCallback } from "react";

export type VoiceStatus = "idle" | "recording" | "sending" | "processing";

export function useVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);

  const startRecording = useCallback(async (sharedStream?: MediaStream | null) => {
    try {
      isRecordingRef.current = true;

      // Validate cached stream still has live audio tracks
      if (streamRef.current) {
        const hasLiveTrack = streamRef.current.getAudioTracks().some(t => t.readyState === "live");
        if (!hasLiveTrack) {
          streamRef.current = null;
        }
      }

      if (!streamRef.current) {
        // Prefer shared stream's live audio track (avoids getUserMedia from non-user-gesture context)
        const audioTrack = sharedStream?.getAudioTracks().find(t => t.readyState === "live");
        if (audioTrack) {
          streamRef.current = new MediaStream([audioTrack]);
        } else {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      }

      const stream = streamRef.current;
      chunksRef.current = [];

      // MIME type cascade: webm > mp4 > default
      let mimeType: string | undefined;
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch (err) {
      console.error("Failed to start recording:", err);
      isRecordingRef.current = false;
      setStatus("idle");
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        reject(new Error("No active recording"));
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        isRecordingRef.current = false;
        // Don't set status here — let callers manage the transition
        // (e.g., "recording" → "sending" → "idle")
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    isRecordingRef.current = false;
    setStatus("idle");
  }, []);

  return { status, setStatus, startRecording, stopRecording, cleanup, isRecordingRef };
}
