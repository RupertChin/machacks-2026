import { useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ConstraintItem } from "./ConstraintItem";
import type { Constraint, SpecMetadata } from "@/lib/types/constraints";
import { Upload, FileText, X, Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface ConstraintPanelProps {
  constraints: Constraint[];
  specMetadata: SpecMetadata | null;
  onUploadSpec: (file: File) => void;
  onDeleteSpec: () => void;
  onToggleConstraint: (id: string, active: boolean) => void;
  uploadProgress: string | null;
}

function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ConstraintPanel({
  constraints,
  specMetadata,
  onUploadSpec,
  onDeleteSpec,
  onToggleConstraint,
  uploadProgress,
}: ConstraintPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") {
        onUploadSpec(file);
      }
    },
    [onUploadSpec],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onUploadSpec(file);
        e.target.value = "";
      }
    },
    [onUploadSpec],
  );

  // Upload progress indicator
  if (uploadProgress) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="text-sm capitalize">{uploadProgress}...</p>
      </div>
    );
  }

  // Empty state
  if (!specMetadata) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-8"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-500 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-10 w-10 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 text-sm mb-1">Upload a technical spec sheet (PDF)</p>
          <p className="text-gray-600 text-xs">to enable constraint-aware design</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  }

  // Group constraints by category
  const grouped = constraints.reduce<Record<string, Constraint[]>>((acc, c) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Enhanced spec document card */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-cadence flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-200 truncate block">{specMetadata.filename}</span>
            {specMetadata.uploaded_at && (
              <span className="text-xs text-gray-500">{timeAgo(specMetadata.uploaded_at)}</span>
            )}
          </div>
          <Badge variant="secondary" className="text-xs bg-cadence/20 text-cadence">{constraints.length}</Badge>
          <button onClick={onDeleteSpec} className="text-gray-500 hover:text-red-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Constraint list with collapsible categories */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
          {Object.entries(grouped).map(([category, items]) => {
            const isCollapsed = collapsedCategories.has(category);
            return (
              <div key={category} className="mb-3">
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 px-2 py-1 w-full text-left hover:bg-gray-900/50 rounded transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-gray-500" />
                  )}
                  <span className="text-xs font-medium text-gray-400 uppercase">{category}</span>
                  <Badge variant="outline" className="text-xs h-4 px-1">{items.length}</Badge>
                </button>
                {!isCollapsed && (
                  <div className="space-y-1 mt-1">
                    {items.map((c) => (
                      <ConstraintItem
                        key={c.id}
                        constraint={c}
                        onToggle={(active) => onToggleConstraint(c.id, active)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
