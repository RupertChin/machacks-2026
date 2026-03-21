import type { ChatMessage } from "@/hooks/useAgent";
import { Mic } from "lucide-react";

interface UserMessageProps {
  message: ChatMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm">
        <div className="flex items-center gap-1.5">
          {message.isVoice && <Mic className="h-3 w-3 opacity-60 flex-shrink-0" />}
          <span>{message.content}</span>
        </div>
      </div>
    </div>
  );
}
