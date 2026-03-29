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
  const confidence = Number(payload.confidence || 0);
  const clarifyQuestions = Array.isArray(payload.clarify_questions) ? payload.clarify_questions : [];
  const hasPendingAction = Boolean(pendingActionKey);
  const advancedOptions =
    payload.advanced_options && typeof payload.advanced_options === "object"
      ? (payload.advanced_options as Record<string, unknown>)
      : {};
  const appliedStrategy =
    payload.applied_strategy_profile && typeof payload.applied_strategy_profile === "object"
      ? (payload.applied_strategy_profile as Record<string, unknown>)
      : {};
  const strategyOverrideReport =
    payload.strategy_override_report_v1 && typeof payload.strategy_override_report_v1 === "object"
      ? (payload.strategy_override_report_v1 as Record<string, unknown>)
      : {};
  const strategyOverrideCount = Number(strategyOverrideReport.override_count || 0);
  const sceneLabel =
    (typeof appliedStrategy.scene_label === "string" && appliedStrategy.scene_label.trim()) ||
    (typeof advancedOptions.scene === "string" && advancedOptions.scene.trim()) ||
    "-";
  const visualFocus = Array.isArray(advancedOptions.visual_focus)
    ? advancedOptions.visual_focus.map((item) => String(item)).filter(Boolean)
    : [];
  const enableMatting = Boolean(advancedOptions.enable_matting);
  const qualityWeights =
    payload.quality_weights && typeof payload.quality_weights === "object"
      ? (payload.quality_weights as Record<string, number>)
      : {};
  const riskFlags = Array.isArray(payload.risk_flags) ? payload.risk_flags : [];
  const technicalReject =
    payload.technical_reject && typeof payload.technical_reject === "object"
      ? payload.technical_reject
      : {};

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
        <div>置信度：{confidence > 0 ? `${Math.round(confidence * 100)}%` : "-"}</div>
        <div>预估耗时：{eta > 0 ? `${eta}s` : "-"}</div>
        <div>场景策略：{sceneLabel}</div>
        <div>策略覆盖：{strategyOverrideCount > 0 ? `${strategyOverrideCount} 项` : "无"}</div>
        <div>抠图开关：{enableMatting ? "开启" : "关闭"}</div>
        <div>
          权重：S {Number(qualityWeights.semantic || 0).toFixed(2)} / C {Number(qualityWeights.clarity || 0).toFixed(2)} / L{" "}
          {Number(qualityWeights.loop || 0).toFixed(2)} / E {Number(qualityWeights.efficiency || 0).toFixed(2)}
        </div>
        <div>
          技术门槛：模糊={String(technicalReject.max_blur_tolerance || "-")} · 水印=
          {technicalReject.avoid_watermarks ? "避开" : "允许"} · 暗光=
          {technicalReject.avoid_extreme_dark ? "避开" : "允许"}
        </div>
      </div>

      {riskFlags.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {riskFlags.map((flag, idx) => (
            <span
              key={`${flag}-${idx}`}
              className="max-w-[220px] truncate rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"
            >
              风险：{flag}
            </span>
          ))}
        </div>
      ) : null}

      {visualFocus.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {visualFocus.map((focus, idx) => (
            <span
              key={`${focus}-${idx}`}
              className="max-w-[220px] truncate rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700"
            >
              聚焦：{focus}
            </span>
          ))}
        </div>
      ) : null}

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

      {clarifyQuestions.length ? (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-800">
          <div className="mb-1 font-semibold">建议补充信息</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {clarifyQuestions.slice(0, 4).map((question, idx) => (
              <li key={`${question}-${idx}`}>{question}</li>
            ))}
          </ul>
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
