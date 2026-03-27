import type {
  AI1PlanCardPayload,
  FinalGalleryPayload,
  ProcessingStatusPayload,
  RichMessage,
  RichMessageAction,
  UploadProgressPayload,
} from "@/types/rich-message";
import { AI1PlanCard } from "./cards/AI1PlanCard";
import { FinalGalleryCard } from "./cards/FinalGalleryCard";
import { ProcessingStatusCard } from "./cards/ProcessingStatusCard";
import { UploadProgressCard } from "./cards/UploadProgressCard";

type MessageRendererProps = {
  message: RichMessage;
  onAction?: (action: RichMessageAction, message: RichMessage) => void;
  pendingActionKey?: string | null;
};

export function MessageRenderer({ message, onAction, pendingActionKey }: MessageRendererProps) {
  const sharedActionHandler = (action: RichMessageAction) => onAction?.(action, message);
  const payload = message.payload;

  switch (message.type) {
    case "upload_progress":
      return payload ? (
        <UploadProgressCard
          payload={payload as UploadProgressPayload}
          actions={message.actions}
          onAction={sharedActionHandler}
        />
      ) : null;
    case "ai1_plan_card":
      return payload ? (
        <AI1PlanCard
          payload={payload as AI1PlanCardPayload}
          actions={message.actions}
          onAction={sharedActionHandler}
          pendingActionKey={pendingActionKey}
        />
      ) : null;
    case "processing_status":
      return payload ? (
        <ProcessingStatusCard
          payload={payload as ProcessingStatusPayload}
          actions={message.actions}
          onAction={sharedActionHandler}
        />
      ) : null;
    case "final_gallery":
      return payload ? (
        <FinalGalleryCard payload={payload as FinalGalleryPayload} actions={message.actions} onAction={sharedActionHandler} />
      ) : null;
    case "text":
    default:
      return (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
          {message.content || "-"}
        </div>
      );
  }
}
