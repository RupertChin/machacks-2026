import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageList } from "./MessageList";
import type { ChatMessage } from "@/hooks/useAgent";
import { Send } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  onSendMessage: (message: string) => void;
}

export function ChatPanel({ messages, isProcessing, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <MessageList messages={messages} />
      <form onSubmit={handleSubmit} className="p-2 border-t border-gray-800 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isProcessing ? "Agent working..." : "Type a command..."}
          disabled={isProcessing}
          className="flex-1 bg-gray-900 border-gray-700 text-white"
        />
        <Button type="submit" size="icon" disabled={isProcessing || !input.trim()} variant="secondary">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
