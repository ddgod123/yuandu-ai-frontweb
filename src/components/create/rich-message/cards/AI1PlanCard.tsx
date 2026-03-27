import type { AI1PlanCardPayload, RichMessageAction } from "@/types/rich-message";

type AI1PlanCardProps = {
  payload: AI1PlanCardPayload;
  actions?: RichMessageAction[];
  onAction?: (action: RichMessageAction) => void;
  pendingActionKey?: string | null;
};

function actionClass(style?: string) {
  switch (style) {
    case "primary":
      return "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700";
    case "danger":
      return "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100";
    default:
      return "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
  }
}

export function AI1PlanCard({ payload, actions, onAction, pendingActionKey }: AI1PlanCardProps) {
  const tags = Array.isArray(payload.detected_tags) ? payload.detected_tags : [];
  const mustCapture = Array.isArray(payload.must_capture) ? payload.must_capture : [];
  const avoid = Array.isArray(payload.avoid) ? payload.avoid : [];
  const hasRisk = Boolean(payload.risk_warning?.has_risk);
  const eta = Number(payload.estimated_eta_seconds || 0);
  const hasPendingAction = Boolean(pendingActionKey);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-emerald-800">AI1 导演提案</div>
        <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-700">
          {String(payload.requested_format || "").toUpperCase() || "N/A"}
        </span>
      </div>

      {payload.summary ? <div className="mb-2 text-sm text-slate-800">{payload.summary}</div> : null}
      <div className="grid gap-1 text-xs text-slate-700 sm:grid-cols-2">
        <div>意图理解：{payload.intent_understanding || "-"}</div>
        <div>执行策略：{payload.strategy_summary || "-"}</div>
        <div>风格：{payload.style_direction || "-"}</div>
        <div>目标：{payload.objective || "-"}</div>
        <div>交互动作：{payload.interactive_action || "-"}</div>
        <div>预估耗时：{eta > 0 ? `${eta}s` : "-"}</div>
      </div>

      {tags.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag, idx) => (
            <span
              key={`${tag}-${idx}`}
              title={tag}
              className="max-w-[220px] truncate rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-700"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {mustCapture.length ? (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-semibold text-emerald-800">必须捕捉</div>
          <div className="flex flex-wrap gap-1">
            {mustCapture.map((entry, idx) => (
              <span
                key={`${entry}-${idx}`}
                title={entry}
                className="max-w-[220px] truncate rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
              >
                {entry}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {avoid.length ? (
        <div className="mt-2">
          <div className="mb-1 text-[11px] font-semibold text-rose-700">规避项</div>
          <div className="flex flex-wrap gap-1">
            {avoid.map((entry, idx) => (
              <span
                key={`${entry}-${idx}`}
                title={entry}
                className="max-w-[220px] truncate rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700"
              >
                {entry}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {hasRisk ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          风险提示：{payload.risk_warning?.message || "检测到潜在风险，请确认后继续。"}
        </div>
      ) : null}

      {actions?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={Boolean(action.disabled) || hasPendingAction}
              onClick={() => {
                if (hasPendingAction) return;
                onAction?.(action);
              }}
              className={`rounded-md border px-2.5 py-1 text-[11px] transition ${actionClass(action.style)} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {pendingActionKey === action.key ? "处理中..." : action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
