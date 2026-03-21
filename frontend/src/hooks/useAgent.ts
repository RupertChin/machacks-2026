import { useState, useCallback, useRef } from "react";
import { sendVoice, sendChat, postToolResult } from "@/lib/api/agent";
import type { ToolResultPayload } from "@/lib/types/tools";

export type MessageType = "user" | "agent" | "tool_call" | "tool_result_internal" | "error";

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  // For tool_call messages
  toolName?: string;
  toolParams?: Record<string, any>;
  toolStatus?: "pending" | "success" | "failure";
  // For tool_result_internal
  toolResult?: any;
  // For voice messages
  isVoice?: boolean;
}

let messageCounter = 0;
function nextMessageId(): string {
  return `msg_${++messageCounter}`;
}

export function useAgent(
  sessionId: string | null,
  executeTool: (opId: string, toolName: string, params: Record<string, any>) => Promise<ToolResultPayload>,
  getSceneObjectIds: () => string[],
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const currentAgentMsgRef = useRef<string | null>(null);

  const addMessage = useCallback((msg: Omit<ChatMessage, "id" | "timestamp">) => {
    const fullMsg: ChatMessage = {
      ...msg,
      id: nextMessageId(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, fullMsg]);
    return fullMsg.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  }, []);

  const handleSSEEvent = useCallback(
    async (eventType: string, data: any) => {
      switch (eventType) {
        case "transcript": {
          addMessage({
            type: "user",
            content: data.text,
            isVoice: true,
          });
          break;
        }

        case "agent_text": {
          if (data.done) {
            currentAgentMsgRef.current = null;
            break;
          }
          if (!currentAgentMsgRef.current) {
            const id = addMessage({ type: "agent", content: data.text });
            currentAgentMsgRef.current = id;
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentAgentMsgRef.current
                  ? { ...m, content: m.content + data.text }
                  : m
              )
            );
          }
          break;
        }

        case "tool_call": {
          const { op_id, tool_name, parameters } = data;
          const msgId = addMessage({
            type: "tool_call",
            content: `${tool_name}`,
            toolName: tool_name,
            toolParams: parameters,
            toolStatus: "pending",
          });

          // Execute tool on JSCAD
          try {
            const result = await executeTool(op_id, tool_name, parameters);
            updateMessage(msgId, {
              toolStatus: result.status === "success" ? "success" : "failure",
            });

            // POST result to backend
            if (sessionId) {
              await postToolResult(sessionId, result);
            }
          } catch (err: any) {
            updateMessage(msgId, { toolStatus: "failure" });
            if (sessionId) {
              await postToolResult(sessionId, {
                op_id,
                status: "failure",
                error: err.message,
              });
            }
          }
          break;
        }

        case "tool_result_internal": {
          addMessage({
            type: "tool_result_internal",
            content: data.tool_name,
            toolName: data.tool_name,
            toolParams: data.parameters,
            toolResult: data.result,
          });
          break;
        }

        case "error": {
          addMessage({
            type: "error",
            content: data.message,
          });
          break;
        }

        case "done": {
          setIsProcessing(false);
          currentAgentMsgRef.current = null;
          break;
        }
      }
    },
    [sessionId, addMessage, updateMessage, executeTool],
  );

  const sendVoiceMessage = useCallback(
    async (audioBlob: Blob) => {
      if (!sessionId) return;
      setIsProcessing(true);
      currentAgentMsgRef.current = null;
      try {
        const objectIds = getSceneObjectIds();
        await sendVoice(sessionId, audioBlob, objectIds, handleSSEEvent);
      } catch (err: any) {
        addMessage({ type: "error", content: err.message });
      } finally {
        setIsProcessing(false);
      }
    },
    [sessionId, handleSSEEvent, addMessage, getSceneObjectIds],
  );

  const sendChatMessage = useCallback(
    async (message: string) => {
      if (!sessionId || !message.trim()) return;
      setIsProcessing(true);
      currentAgentMsgRef.current = null;

      addMessage({ type: "user", content: message });

      try {
        const objectIds = getSceneObjectIds();
        await sendChat(sessionId, message, objectIds, handleSSEEvent);
      } catch (err: any) {
        addMessage({ type: "error", content: err.message });
      } finally {
        setIsProcessing(false);
      }
    },
    [sessionId, handleSSEEvent, addMessage, getSceneObjectIds],
  );

  return {
    messages,
    isProcessing,
    sendVoiceMessage,
    sendChatMessage,
  };
}
