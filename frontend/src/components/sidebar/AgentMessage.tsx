import type { ChatMessage } from "@/hooks/useAgent";
import { Bot } from "lucide-react";

interface AgentMessageProps {
  message: ChatMessage;
  isFirst?: boolean;
}

export function AgentMessage({ message, isFirst }: AgentMessageProps) {
  return (
    <div className="flex justify-start">
      <div className={`max-w-[85%] bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 text-sm ${isFirst ? "border-l-2 border-cadence" : ""}`}>
        <div className="flex gap-2">
          <Bot className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>
      </div>
    </div>
  );
}
