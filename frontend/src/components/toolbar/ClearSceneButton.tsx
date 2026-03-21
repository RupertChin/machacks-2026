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
  objectCount: number;
}

export function ClearSceneButton({ onClick, objectCount }: ClearSceneButtonProps) {
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
            {objectCount > 0 && (
              <p className="text-sm text-yellow-400 mt-2">
                {objectCount} object{objectCount !== 1 ? "s" : ""} will be removed.
              </p>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirm}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
