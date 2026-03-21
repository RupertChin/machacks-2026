import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";

interface DesignReviewButtonProps {
  onClick: () => void;
  disabled: boolean;
}

export function DesignReviewButton({ onClick, disabled }: DesignReviewButtonProps) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={disabled} className="text-gray-300 hover:text-white">
      <ClipboardCheck className="h-4 w-4 mr-1" />
      Review
    </Button>
  );
}
