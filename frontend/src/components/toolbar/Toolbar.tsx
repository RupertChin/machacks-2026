import { Link } from "react-router-dom";
import { ExportButton } from "./ExportButton";
import { DesignReviewButton } from "./DesignReviewButton";
import { ClearSceneButton } from "./ClearSceneButton";

interface ToolbarProps {
  onExport: () => void;
  onDesignReview: () => void;
  onClearScene: () => void;
  isProcessing: boolean;
  objectCount: number;
}

export function Toolbar({ onExport, onDesignReview, onClearScene, isProcessing, objectCount }: ToolbarProps) {
  return (
    <div className="h-12 border-b border-gray-800 flex items-center px-4 gap-2 bg-gray-950">
      <Link to="/" className="font-semibold text-sm mr-4 hover:opacity-80 transition-opacity">
        <span className="text-cadence">CAD</span>ence
      </Link>
      <div className="flex-1" />
      <DesignReviewButton onClick={onDesignReview} disabled={isProcessing} />
      <ExportButton onClick={onExport} />
      <ClearSceneButton onClick={onClearScene} objectCount={objectCount} />
    </div>
  );
}
