import { ExportButton } from "./ExportButton";
import { DesignReviewButton } from "./DesignReviewButton";
import { ClearSceneButton } from "./ClearSceneButton";

interface ToolbarProps {
  onExport: () => void;
  onDesignReview: () => void;
  onClearScene: () => void;
  isProcessing: boolean;
}

export function Toolbar({ onExport, onDesignReview, onClearScene, isProcessing }: ToolbarProps) {
  return (
    <div className="h-12 border-b border-gray-800 flex items-center px-4 gap-2 bg-gray-950">
      <span className="font-semibold text-sm mr-4">GestureCAD</span>
      <div className="flex-1" />
      <DesignReviewButton onClick={onDesignReview} disabled={isProcessing} />
      <ExportButton onClick={onExport} />
      <ClearSceneButton onClick={onClearScene} />
    </div>
  );
}
