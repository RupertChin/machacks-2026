import { useRef, useCallback } from "react";
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
  const { executeTool, clearAll, getSceneObjectIds, getEngine, objectCount } = useJscad(canvasRef);

  // Voice recording
  const { status: voiceStatus, setStatus: setVoiceStatus, startRecording, stopRecording, cleanup: cleanupVoice } = useVoice();

  // Gesture tracking (suppressed during voice recording)
  const { gesture, videoRef, rawLandmarks, isLoading: gesturesLoading } = useGestures(
    voiceStatus === "recording"
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
      setVoiceStatus("idle");
    }
  }, [stopRecording, sendVoiceMessage, setVoiceStatus]);

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

  const handleResetCamera = useCallback(() => {
    const controller = canvasRef.current?.getCameraController();
    controller?.reset();
  }, []);

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
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-white overflow-hidden">
      <Toolbar
        onExport={handleExport}
        onDesignReview={handleDesignReview}
        onClearScene={handleClearScene}
        isProcessing={isProcessing}
        objectCount={objectCount}
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
          objectCount={objectCount}
          onResetCamera={handleResetCamera}
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
      />
    </div>
  );
}

export default App;
