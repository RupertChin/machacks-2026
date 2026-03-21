import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Trash2, AlertTriangle, Box } from "lucide-react";

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
      <button
        onClick={() => setOpen(true)}
        className="bg-[#7F1D1D] text-[#F87171] hover:bg-red-900 rounded-md px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear Scene
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 gap-0 border rounded-2xl w-[400px]"
          style={{
            backgroundColor: '#111827',
            borderColor: '#374151',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Header */}
          <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-4">
            {/* Warning Icon */}
            <div
              className="flex items-center justify-center w-14 h-14 rounded-full"
              style={{ backgroundColor: 'rgba(127, 29, 29, 0.25)' }}
            >
              <AlertTriangle className="h-7 w-7" style={{ color: '#F87171' }} />
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-white">Clear Scene?</h2>

            {/* Description */}
            <p
              className="text-sm text-center leading-relaxed max-w-[320px]"
              style={{ color: '#9CA3AF' }}
            >
              This will permanently remove all objects from the viewport. This action cannot be undone.
            </p>

            {/* Object Count */}
            {objectCount > 0 && (
              <div
                className="flex items-center gap-2 rounded-lg px-4 py-2"
                style={{
                  backgroundColor: 'rgba(127, 29, 29, 0.19)',
                  border: '1px solid rgba(127, 29, 29, 0.38)',
                }}
              >
                <Box className="h-3.5 w-3.5" style={{ color: '#FB923C' }} />
                <span
                  className="font-mono text-xs font-medium"
                  style={{ color: '#FB923C' }}
                >
                  {objectCount} object{objectCount !== 1 ? "s" : ""} will be removed
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-full h-px" style={{ backgroundColor: '#1F2937' }} />

          {/* Actions */}
          <div className="flex flex-col items-center gap-3 px-6 pt-4 pb-6">
            <div className="flex gap-3 w-full justify-center">
              {/* Cancel */}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-5 py-2.5 text-sm font-medium"
                style={{
                  backgroundColor: '#1F2937',
                  color: '#D1D5DB',
                  border: '1px solid #374151',
                }}
              >
                Cancel
              </button>

              {/* Confirm */}
              <button
                onClick={handleConfirm}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white flex items-center gap-2 hover:brightness-110 transition"
                style={{ backgroundColor: '#DC2626' }}
              >
                <Trash2 className="h-4 w-4" />
                Clear Everything
              </button>
            </div>

            <span
              className="font-mono text-[11px] opacity-60"
              style={{ color: '#6B7280' }}
            >
              Press ESC to cancel
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
