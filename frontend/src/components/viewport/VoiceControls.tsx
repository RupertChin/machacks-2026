import { useRef, useCallback } from "react";
import { Mic, Loader2 } from "lucide-react";
import type { VoiceStatus } from "@/hooks/useVoice";

interface VoiceControlsProps {
  status: VoiceStatus;
  isProcessing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function VoiceControls({ status, isProcessing, onStartRecording, onStopRecording }: VoiceControlsProps) {
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);

  const handlePointerDown = useCallback(() => {
    if (isProcessing) return;
    isHoldingRef.current = true;
    holdTimerRef.current = setTimeout(() => {
      if (isHoldingRef.current) {
        onStartRecording();
      }
    }, 150);
  }, [isProcessing, onStartRecording]);

  const handlePointerUp = useCallback(() => {
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (status === "recording") {
      onStopRecording();
    }
  }, [status, onStopRecording]);

  const handleClick = useCallback(() => {
    if (isProcessing) return;
    if (status === "recording") {
      onStopRecording();
    } else if (status === "idle") {
      onStartRecording();
    }
  }, [status, isProcessing, onStartRecording, onStopRecording]);

  const isRecording = status === "recording";
  const showProcessing = isProcessing || status === "sending";

  // Status text
  const statusText = () => {
    if (showProcessing) return "Agent working...";
    if (isRecording) return "Listening...";
    return "Push to talk";
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
      {/* Status indicator */}
      <div className="text-xs text-gray-400 bg-gray-900/80 px-3 py-1 rounded-full backdrop-blur-sm">
        {statusText()}
      </div>

      {/* Animated wave bars (recording only) */}
      {isRecording && (
        <div className="flex items-center gap-1 h-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-1 bg-red-400 rounded-full"
              style={{
                height: "100%",
                animation: `audioWave 0.8s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* Push-to-talk button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        disabled={showProcessing}
        className={`
          rounded-full flex items-center justify-center
          transition-all duration-200 select-none
          ${isRecording
            ? "w-20 h-20 bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-110"
            : showProcessing
              ? "w-14 h-14 bg-gray-700 cursor-not-allowed"
              : "w-14 h-14 bg-gray-700 hover:bg-gray-600 active:scale-95 shadow-lg shadow-gray-700/20"
          }
        `}
      >
        {showProcessing ? (
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        ) : (
          <Mic className={`text-white ${isRecording ? "h-8 w-8" : "h-6 w-6"}`} />
        )}
      </button>
    </div>
  );
}
