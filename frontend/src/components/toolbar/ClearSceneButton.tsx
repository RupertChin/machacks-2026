import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface ClearSceneButtonProps {
  onClick: () => void;
}

export function ClearSceneButton({ onClick }: ClearSceneButtonProps) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onClick();
    setOpen(false);
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-gray-300 hover:text-red-400">
        <Trash2 className="h-4 w-4 mr-1" />
        Clear
      </Button>
      <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle>Clear Scene</DialogTitle>
            <DialogDescription>
              This will remove all objects from the scene. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirm}>Clear All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
