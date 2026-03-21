import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserMessage } from "./UserMessage";
import { AgentMessage } from "./AgentMessage";
import { ToolCallEntry } from "./ToolCallEntry";
import type { ChatMessage } from "@/hooks/useAgent";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
        Start by typing a command or using push-to-talk
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-3">
      <div className="space-y-3">
        {messages.map((msg) => {
          switch (msg.type) {
            case "user":
              return <UserMessage key={msg.id} message={msg} />;
            case "agent":
              return <AgentMessage key={msg.id} message={msg} />;
            case "tool_call":
            case "tool_result_internal":
              return <ToolCallEntry key={msg.id} message={msg} />;
            case "error":
              return (
                <div key={msg.id} className="px-3 py-2 rounded-lg bg-red-900/30 text-red-300 text-sm border border-red-800">
                  {msg.content}
                </div>
              );
            default:
              return null;
          }
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
