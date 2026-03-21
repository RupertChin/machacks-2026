import { Eye } from "lucide-react";

interface DesignReviewButtonProps {
  onClick: () => void;
  disabled: boolean;
}

export function DesignReviewButton({ onClick, disabled }: DesignReviewButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-[#1E293B] text-[#94A3B8] hover:text-white rounded-md px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
    >
      <Eye className="h-3.5 w-3.5" />
      Design Review
    </button>
  );
}
