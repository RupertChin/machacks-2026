import type { Constraint } from "@/lib/types/constraints";

interface ConstraintItemProps {
  constraint: Constraint;
  onToggle: (active: boolean) => void;
}

export function ConstraintItem({ constraint, onToggle }: ConstraintItemProps) {
  return (
    <div className={`px-3 py-2 rounded-md text-sm ${constraint.active ? "bg-gray-900" : "bg-gray-900/50 opacity-60"}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-gray-200 text-xs leading-relaxed">{constraint.description}</p>
          {constraint.value && (
            <p className="text-gray-400 text-xs mt-0.5">
              {typeof constraint.value === "object"
                ? Object.entries(constraint.value as Record<string, any>)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ")
                : String(constraint.value)}
              {constraint.unit ? ` ${constraint.unit}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(!constraint.active);
          }}
          className={`mt-0.5 w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
            constraint.active ? "bg-blue-600" : "bg-gray-700"
          }`}
        >
          <div
            className={`w-3 h-3 rounded-full bg-white transition-transform ${
              constraint.active ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
