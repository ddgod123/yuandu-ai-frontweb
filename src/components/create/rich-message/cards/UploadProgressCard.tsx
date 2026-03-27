import { formatDateTime } from "../utils";
import type { RichMessageAction, UploadProgressPayload } from "@/types/rich-message";

type UploadProgressCardProps = {
  payload: UploadProgressPayload;
  actions?: RichMessageAction[];
  onAction?: (action: RichMessageAction) => void;
};

export function UploadProgressCard({ payload, actions, onAction }: UploadProgressCardProps) {
  const progress = Math.max(0, Math.min(100, Number(payload.progress_percent || 0)));
  const requestedFormat = String(payload.requested_format || "").toUpperCase();
  const generatedFormats = Array.isArray(payload.generated_formats) ? payload.generated_formats : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">任务进度</div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
          {progress.toFixed(0)}%
        </span>
      </div>
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${Math.max(progress, 2)}%` }} />
      </div>
      <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        <div>阶段：{payload.stage_label || payload.stage || "-"}</div>
        <div>状态：{payload.status_label || payload.status || "-"}</div>
        <div>请求格式：{requestedFormat || "-"}</div>
        <div>产出格式：{generatedFormats.length ? generatedFormats.map((item) => item.toUpperCase()).join(", ") : "-"}</div>
        <div>队列：{payload.queue_label || "-"}</div>
        <div>更新时间：{formatDateTime(payload.updated_at)}</div>
      </div>

      {actions?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={Boolean(action.disabled)}
              onClick={() => onAction?.(action)}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

