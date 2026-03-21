import { useRef, useCallback, useEffect } from "react";
import { Viewport } from "./components/Viewport";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/toolbar/Toolbar";
import { GestureController } from "./components/viewport/GestureController";
import { useSession } from "./hooks/useSession";
import { useJscad } from "./hooks/useJscad";
import { useAgent } from "./hooks/useAgent";
import { useVoice } from "./hooks/useVoice";
import { useConstraints } from "./hooks/useConstraints";
import { useGestures } from "./hooks/useGestures";
import { exportSTL } from "./lib/jscad/exporter";
import type { ThreeCanvasHandle } from "./components/viewport/ThreeCanvas";

function App() {
  const canvasRef = useRef<ThreeCanvasHandle>(null);

  // Session
  const { sessionId, loading: sessionLoading, error: sessionError } = useSession();

  // JSCAD engine + mesh management
  const { executeTool, clearAll, getSceneObjectIds, getEngine } = useJscad(canvasRef);

  // Voice recording
  const { status: voiceStatus, setStatus: setVoiceStatus, startRecording, stopRecording, cleanup: cleanupVoice, isRecordingRef } = useVoice();

  // Track how recording was initiated to avoid conflicts
  const recordingSourceRef = useRef<"button" | "gesture" | null>(null);

  // Gesture tracking (only suppress during button-initiated recording)
  const { gesture, videoRef, rawLandmarks, isLoading: gesturesLoading, getMediaStream } = useGestures(
    voiceStatus === "recording" && recordingSourceRef.current === "button"
  );

  // Agent communication
  const { messages, isProcessing, sendVoiceMessage, sendChatMessage } = useAgent(
    sessionId,
    executeTool,
    getSceneObjectIds,
  );

  // Constraints
  const {
    constraints,
    specMetadata,
    uploadProgress,
    handleUploadSpec,
    handleDeleteSpec,
    handleToggleConstraint,
  } = useConstraints(sessionId);

  // Voice controls handlers
  const handleStartRecording = useCallback(async () => {
    recordingSourceRef.current = "button";
    await startRecording();
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    try {
      const blob = await stopRecording();
      setVoiceStatus("sending");
      await sendVoiceMessage(blob);
    } catch (err) {
      console.error("Voice recording error:", err);
    } finally {
      recordingSourceRef.current = null;
      setVoiceStatus("idle");
    }
  }, [stopRecording, sendVoiceMessage, setVoiceStatus]);

  // Peace sign gesture → push-to-talk
  const prevGestureStateRef = useRef(gesture.state);
  useEffect(() => {
    const prev = prevGestureStateRef.current;
    const curr = gesture.state;
    prevGestureStateRef.current = curr;

    if (prev === curr) return;

    // Index finger raised → begin recording (only if idle and not already recording)
    if (curr === "recording" && voiceStatus === "idle" && !isProcessing) {
      recordingSourceRef.current = "gesture";
      // Pass shared media stream to avoid getUserMedia (which requires user gesture)
      startRecording(getMediaStream());
    }

    // Gesture ended → stop recording (only if we started it via gesture)
    if (prev === "recording" && curr !== "recording" && recordingSourceRef.current === "gesture") {
      if (isRecordingRef.current) {
        stopRecording()
          .then((blob) => {
            setVoiceStatus("sending");
            return sendVoiceMessage(blob);
          })
          .catch((err) => console.error("Gesture voice recording error:", err))
          .finally(() => {
            recordingSourceRef.current = null;
            setVoiceStatus("idle");
          });
      }
    }
  }, [gesture.state, isProcessing, startRecording, stopRecording, sendVoiceMessage, setVoiceStatus, getMediaStream, isRecordingRef]);

  // Toolbar handlers
  const handleExport = useCallback(async () => {
    const engine = getEngine();
    if (engine) {
      await exportSTL(engine);
    }
  }, [getEngine]);

  const handleDesignReview = useCallback(() => {
    sendChatMessage("Please review my current design against the spec constraints");
  }, [sendChatMessage]);

  const handleClearScene = useCallback(async () => {
    await clearAll();
  }, [clearAll]);

  // Camera controller from ThreeCanvas
  const cameraController = canvasRef.current?.getCameraController() ?? null;

  // Loading state
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-950 text-gray-400">
        Initializing session...
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-950 text-red-400">
        Failed to connect: {sessionError}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-white">
      <Toolbar
        onExport={handleExport}
        onDesignReview={handleDesignReview}
        onClearScene={handleClearScene}
        isProcessing={isProcessing}
      />
      <div className="flex flex-1 overflow-hidden">
        <Viewport
          ref={canvasRef}
          voiceStatus={voiceStatus}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          isProcessing={isProcessing}
          videoRef={videoRef}
          rawLandmarks={rawLandmarks}
          gestureState={gesture.state}
        />
        <Sidebar
          messages={messages}
          isProcessing={isProcessing}
          onSendMessage={sendChatMessage}
          constraints={constraints}
          specMetadata={specMetadata}
          onUploadSpec={handleUploadSpec}
          onDeleteSpec={handleDeleteSpec}
          onToggleConstraint={handleToggleConstraint}
          uploadProgress={uploadProgress}
        />
      </div>

      {/* Renderless gesture controller */}
      <GestureController
        cameraController={cameraController}
        gestureOutput={gesture}
        suppressCamera={voiceStatus === "recording"}
      />
    </div>
  );
}

export default App;
