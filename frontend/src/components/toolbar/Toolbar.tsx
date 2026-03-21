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
    <div className="h-12 border-b border-[#1E293B] flex items-center px-4 gap-2 bg-[#0F172A]">
      <Link to="/" className="font-mono font-bold text-lg tracking-wide mr-4 hover:opacity-80 transition-opacity">
        <span style={{ color: '#22D3EE' }}>CAD</span><span className="text-white">ence</span>
      </Link>
      <div className="flex-1" />
      <DesignReviewButton onClick={onDesignReview} disabled={isProcessing} />
      <ExportButton onClick={onExport} />
      <ClearSceneButton onClick={onClearScene} objectCount={objectCount} />
    </div>
  );
}
