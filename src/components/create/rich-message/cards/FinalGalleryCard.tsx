import Link from "next/link";
import type { FinalGalleryPayload, RichMessageAction } from "@/types/rich-message";

type FinalGalleryCardProps = {
  payload: FinalGalleryPayload;
  actions?: RichMessageAction[];
  onAction?: (action: RichMessageAction) => void;
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

export function FinalGalleryCard({ payload, actions, onAction }: FinalGalleryCardProps) {
  const assets = Array.isArray(payload.assets) ? payload.assets : [];

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-emerald-800">结果画廊</div>
        <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-700">
          {String(payload.requested_format || "").toUpperCase() || "N/A"}
        </span>
      </div>
      <div className="mb-2 text-xs text-slate-700">
        输出数量：{Number(payload.output_count || assets.length || 0)} · 任务 #{payload.job_id}
      </div>

      {assets.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {assets.slice(0, 9).map((asset, idx) => (
            <a
              key={asset.id || asset.url || idx}
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              {asset.thumb_url || asset.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.thumb_url || asset.url}
                  alt={asset.file_name || `asset-${idx + 1}`}
                  className="h-24 w-full object-cover transition group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-24 items-center justify-center text-[11px] text-slate-400">预览不可用</div>
              )}
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs text-slate-500">
          暂无可预览资源，可前往“我的作品”查看完整结果。
        </div>
      )}

      {payload.note ? <div className="mt-2 text-xs text-slate-600">{payload.note}</div> : null}

      {actions?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {actions.map((action) =>
            action.href ? (
              <Link
                key={action.key}
                href={action.href}
                target={action.target || "_self"}
                className={`rounded-md border px-2.5 py-1 text-[11px] transition ${actionClass(action.style)}`}
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={action.key}
                type="button"
                disabled={Boolean(action.disabled)}
                onClick={() => onAction?.(action)}
                className={`rounded-md border px-2.5 py-1 text-[11px] transition ${actionClass(action.style)} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {action.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

