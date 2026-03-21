import { Download } from "lucide-react";

interface ExportButtonProps {
  onClick: () => void;
}

export function ExportButton({ onClick }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      className="bg-[#1E293B] text-[#94A3B8] hover:text-white rounded-md px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      Export STL
    </button>
  );
}
