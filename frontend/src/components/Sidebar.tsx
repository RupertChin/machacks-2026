import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  return (
    <div className="w-[30%] min-w-[300px] border-l border-gray-800 bg-gray-950 flex flex-col">
      <Tabs defaultValue="chat" className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-2 mt-2 bg-gray-900">
          <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
          <TabsTrigger value="constraints" className="flex-1">Constraints</TabsTrigger>
        </TabsList>
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
