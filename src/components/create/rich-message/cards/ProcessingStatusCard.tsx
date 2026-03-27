import { aiStatusBadgeClass, aiStatusLabel } from "../utils";
import type { ProcessingStatusPayload, RichMessageAction } from "@/types/rich-message";

type ProcessingStatusCardProps = {
  payload: ProcessingStatusPayload;
  actions?: RichMessageAction[];
  onAction?: (action: RichMessageAction) => void;
};

export function ProcessingStatusCard({ payload, actions, onAction }: ProcessingStatusCardProps) {
  const details = payload.details && typeof payload.details === "object" ? payload.details : null;
  const status = String(payload.status || "").trim().toLowerCase();
  const shouldPulse = !["done", "error", "warn", "repaired", "failed", "cancelled"].includes(status);
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${shouldPulse ? "animate-pulse" : ""}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-800">{payload.stage_title || payload.stage_key || "处理中"}</div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${aiStatusBadgeClass(payload.status)}`}>
          {aiStatusLabel(payload.status)}
        </span>
      </div>
      <div className="text-xs text-slate-600">{payload.summary || "-"}</div>

      {details ? (
        <details className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">查看详情 JSON</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-emerald-100">
            {JSON.stringify(details, null, 2)}
          </pre>
        </details>
      ) : null}

      {actions?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
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
