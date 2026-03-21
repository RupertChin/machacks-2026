import { forwardRef } from "react";
import { ThreeCanvas, type ThreeCanvasHandle } from "./viewport/ThreeCanvas";
import { VoiceControls } from "./viewport/VoiceControls";
import { WebcamOverlay } from "./viewport/WebcamOverlay";
import type { VoiceStatus } from "@/hooks/useVoice";

interface ViewportProps {
  voiceStatus: VoiceStatus;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isProcessing: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  rawLandmarks?: { x: number; y: number; z: number }[] | null;
  gestureState?: string;
}

export const Viewport = forwardRef<ThreeCanvasHandle, ViewportProps>(function Viewport(
  { voiceStatus, onStartRecording, onStopRecording, isProcessing, videoRef, rawLandmarks, gestureState },
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
