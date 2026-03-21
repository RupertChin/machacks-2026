import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportButtonProps {
  onClick: () => void;
}

export function ExportButton({ onClick }: ExportButtonProps) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="text-gray-300 hover:text-white">
      <Download className="h-4 w-4 mr-1" />
      Export STL
    </Button>
  );
}
