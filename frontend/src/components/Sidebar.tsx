import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ChatPanel } from "./sidebar/ChatPanel";
import { ConstraintPanel } from "./sidebar/ConstraintPanel";
import type { ChatMessage } from "@/hooks/useAgent";
import type { Constraint, SpecMetadata } from "@/lib/types/constraints";

interface SidebarProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  onSendMessage: (message: string) => void;
  constraints: Constraint[];
  specMetadata: SpecMetadata | null;
  onUploadSpec: (file: File) => void;
  onDeleteSpec: () => void;
  onToggleConstraint: (id: string, active: boolean) => void;
  uploadProgress: string | null;
}

export function Sidebar({
  messages,
  isProcessing,
  onSendMessage,
  constraints,
  specMetadata,
  onUploadSpec,
  onDeleteSpec,
  onToggleConstraint,
  uploadProgress,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState("chat");

  const tabStyle = (tab: string) =>
    activeTab === tab
      ? { backgroundColor: '#22D3EE', color: '#0A0F1C' }
      : {};

  return (
    <div className="w-[30%] min-w-[300px] border-l border-[#1E293B] bg-[#0A0F1C] flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="mx-2 mt-2 bg-[#1E293B] rounded-lg h-9 p-[3px] flex">
          <button
            onClick={() => setActiveTab("chat")}
            className="flex-1 font-mono text-xs font-bold tracking-widest text-[#64748B] rounded-md transition-colors"
            style={tabStyle("chat")}
          >
            CHAT
          </button>
          <button
            onClick={() => setActiveTab("constraints")}
            className="flex-1 font-mono text-xs font-bold tracking-widest text-[#64748B] rounded-md transition-colors"
            style={tabStyle("constraints")}
          >
            CONSTRAINTS
          </button>
        </div>
        <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col m-0">
          <ChatPanel
            messages={messages}
            isProcessing={isProcessing}
            onSendMessage={onSendMessage}
          />
        </TabsContent>
        <TabsContent value="constraints" className="flex-1 overflow-hidden flex flex-col m-0">
          <ConstraintPanel
            constraints={constraints}
            specMetadata={specMetadata}
            onUploadSpec={onUploadSpec}
            onDeleteSpec={onDeleteSpec}
            onToggleConstraint={onToggleConstraint}
            uploadProgress={uploadProgress}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
