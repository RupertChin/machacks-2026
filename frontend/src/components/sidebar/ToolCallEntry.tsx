import { useState } from "react";
import type { ChatMessage } from "@/hooks/useAgent";
import { Wrench, Search, ChevronDown, ChevronRight, Loader2, Check, X } from "lucide-react";

interface ToolCallEntryProps {
  message: ChatMessage;
}

export function ToolCallEntry({ message }: ToolCallEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const isInternal = message.type === "tool_result_internal";
  const Icon = isInternal ? Search : Wrench;
  const iconColor = isInternal ? "text-purple-400" : "text-yellow-400";

  const statusIcon = () => {
    if (isInternal) return <Check className="h-3 w-3 text-green-400" />;
    switch (message.toolStatus) {
      case "pending":
        return <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />;
      case "success":
        return <Check className="h-3 w-3 text-green-400" />;
      case "failure":
        return <X className="h-3 w-3 text-red-400" />;
      default:
        return null;
    }
  };

  // Build parameter summary
  const paramSummary = () => {
    const params = message.toolParams;
    if (!params) return "";
    const entries = Object.entries(params)
      .filter(([k]) => !["object_id", "consumed_object_ids", "new_object_id", "object_ids"].includes(k))
      .slice(0, 3)
      .map(([k, v]) => {
        const val = typeof v === "object" ? JSON.stringify(v) : String(v);
        return `${k}=${val.length > 20 ? val.slice(0, 20) + "..." : val}`;
      });
    return entries.join(", ");
  };

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-gray-700"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${iconColor} flex-shrink-0`} />
        <code className="text-gray-300 font-mono">{message.toolName}</code>
        <span className="text-gray-500 truncate flex-1">{paramSummary()}</span>
        {statusIcon()}
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-gray-500" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-500" />
        )}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-800">
          <pre className="text-gray-400 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(message.toolParams, null, 2)}
          </pre>
          {message.toolResult && (
            <div className="mt-2">
              <span className="text-gray-500">Result:</span>
              <pre className="text-gray-400 whitespace-pre-wrap overflow-x-auto mt-1">
                {typeof message.toolResult === "string"
                  ? message.toolResult
                  : JSON.stringify(message.toolResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
