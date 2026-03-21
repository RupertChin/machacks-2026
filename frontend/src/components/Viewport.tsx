import { forwardRef } from "react";
import { ThreeCanvas, type ThreeCanvasHandle } from "./viewport/ThreeCanvas";
import { VoiceControls } from "./viewport/VoiceControls";
import { WebcamOverlay } from "./viewport/WebcamOverlay";
import { RotateCcw } from "lucide-react";
import type { VoiceStatus } from "@/hooks/useVoice";

interface ViewportProps {
  voiceStatus: VoiceStatus;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isProcessing: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  rawLandmarks?: { x: number; y: number; z: number }[] | null;
  gestureState?: string;
  objectCount: number;
  onResetCamera?: () => void;
}

export const Viewport = forwardRef<ThreeCanvasHandle, ViewportProps>(function Viewport(
  { voiceStatus, onStartRecording, onStopRecording, isProcessing, videoRef, rawLandmarks, gestureState, objectCount, onResetCamera },
  ref,
) {
  return (
    <div className="flex-1 relative bg-gray-900">
      <ThreeCanvas ref={ref} />

      {/* Webcam overlay */}
      {videoRef && (
        <WebcamOverlay
          videoRef={videoRef}
          rawLandmarks={rawLandmarks || null}
          gestureState={gestureState || "idle"}
        />
      )}

      {/* Object count overlay */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-gray-900/80 px-2 py-1 rounded backdrop-blur-sm">
        {objectCount} object{objectCount !== 1 ? "s" : ""}
      </div>

      {/* Reset camera button */}
      {onResetCamera && (
        <button
          onClick={onResetCamera}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 text-xs text-gray-400 hover:text-white bg-gray-900/80 hover:bg-gray-800 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="h-3 w-3" />
          Reset View
        </button>
      )}

      {/* Voice controls */}
      <VoiceControls
        status={voiceStatus}
        isProcessing={isProcessing}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
      />
    </div>
  );
});
