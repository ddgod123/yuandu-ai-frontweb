"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import SmartImage from "@/components/common/SmartImage";
import { API_BASE, fetchWithAuthRetry } from "@/lib/auth-client";

type ReviewDetail = {
  collection?: {
    id: number;
    title?: string;
    description?: string;
    cover_url?: string;
    preview_images?: string[];
    file_count?: number;
    updated_at?: string;
    status?: string;
    visibility?: string;
  };
  review?: {
    review_status?: string;
    publish_status?: string;
    submit_count?: number;
    reject_reason?: string;
    offline_reason?: string;
    last_submitted_at?: string;
    last_reviewed_at?: string;
  };
  actions?: {
    can_submit_review?: boolean;
    can_publish?: boolean;
    can_unpublish?: boolean;
  };
};

type ReviewLogItem = {
  id?: number;
  action?: string;
  from_review_status?: string;
  to_review_status?: string;
  from_publish_status?: string;
  to_publish_status?: string;
  operator_role?: string;
  operator_name?: string;
  reason?: string;
  created_at?: string;
};

type ReviewLogListResponse = {
  items?: ReviewLogItem[];
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

async function parseApiError(res: Response) {
  try {
    const payload = (await res.clone().json()) as ApiErrorPayload;
    const message = (payload.message || payload.error || "").trim();
    const normalized = message.toLowerCase();
    if (normalized === "collection is under review") return "合集正在审核中，暂不可编辑内容";
    if (normalized === "collection already under review") return "合集已在审核中";
    if (normalized === "collection is disabled") return "合集不可用，无法操作";
    if (normalized === "collection is not publishable") return "当前状态不可上架";
    if (normalized === "collection is not online") return "当前状态不可下架";
    return message;
  } catch {
    return "";
  }
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN");
}

function reviewStatusMeta(reviewStatus?: string, collectionStatus?: string) {
  const collectionState = String(collectionStatus || "").toLowerCase();
  if (collectionState === "disabled") {
    return { label: "不可用", className: "bg-slate-500/10 text-slate-600 ring-slate-200", icon: ShieldAlert };
  }
  const value = String(reviewStatus || "").toLowerCase();
  switch (value) {
    case "reviewing":
      return { label: "待审核", className: "bg-amber-500/10 text-amber-700 ring-amber-100", icon: Clock3 };
    case "approved":
      return { label: "已通过", className: "bg-emerald-500/10 text-emerald-700 ring-emerald-100", icon: ShieldCheck };
    case "rejected":
      return { label: "已驳回", className: "bg-rose-500/10 text-rose-700 ring-rose-100", icon: ShieldAlert };
    default:
      return { label: "未提审", className: "bg-slate-500/10 text-slate-600 ring-slate-200", icon: Clock3 };
  }
}

function publishStatusMeta(status?: string) {
  const value = String(status || "").toLowerCase();
  if (value === "online") {
    return { label: "上架中", className: "bg-emerald-500/10 text-emerald-700 ring-emerald-100", icon: CheckCircle2 };
  }
  return { label: "未上架", className: "bg-slate-500/10 text-slate-600 ring-slate-200", icon: XCircle };
}

function reviewStatusLabel(value?: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "reviewing") return "待审核";
  if (normalized === "approved") return "已通过";
  if (normalized === "rejected") return "已驳回";
  if (normalized === "disabled") return "不可用";
  if (normalized === "draft") return "未提审";
  return "-";
}

function publishStatusLabel(value?: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "online" || normalized === "public") return "上架中";
  if (normalized === "offline" || normalized === "private") return "未上架";
  return "-";
}

function actionLabel(value?: string) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized) return "系统操作";
  if (normalized.includes("submit")) return "提交审核";
  if (normalized.includes("approve")) return "审核通过";
  if (normalized.includes("reject")) return "审核驳回";
  if (normalized.includes("publish") || normalized.includes("online")) return "上架";
  if (normalized.includes("unpublish") || normalized.includes("offline")) return "下架";
  if (normalized.includes("disable")) return "设为不可用";
  return value || "系统操作";
}

export default function UploadReviewManagePage() {
  const params = useParams<{ id: string }>();
  const collectionID = Number(params?.id || 0);

  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [logs, setLogs] = useState<ReviewLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingType, setActingType] = useState<"submit" | "publish" | "unpublish" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPage = useCallback(async () => {
    if (!collectionID) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [detailRes, logsRes] = await Promise.all([
        fetchWithAuthRetry(`${API_BASE}/me/uploads/collections/${collectionID}/review-detail`),
        fetchWithAuthRetry(`${API_BASE}/me/uploads/collections/${collectionID}/review-logs?page=1&page_size=50`),
      ]);
      if (!detailRes.ok) {
        const msg = await parseApiError(detailRes);
        setErrorMessage(msg || "加载审核管理失败");
        setDetail(null);
        setLogs([]);
        return;
      }
      const detailData = (await detailRes.json()) as ReviewDetail;
      setDetail(detailData);

      if (logsRes.ok) {
        const logData = (await logsRes.json()) as ReviewLogListResponse;
        setLogs(Array.isArray(logData.items) ? logData.items : []);
      } else {
        setLogs([]);
      }
    } catch {
      setErrorMessage("加载审核管理失败");
      setDetail(null);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [collectionID]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const callAction = async (action: "submit" | "publish" | "unpublish") => {
    if (!collectionID) return;
    setActingType(action);
    setErrorMessage(null);
    try {
      const endpoint =
        action === "submit"
          ? `${API_BASE}/me/uploads/collections/${collectionID}/submit-review`
          : action === "publish"
            ? `${API_BASE}/me/uploads/collections/${collectionID}/publish`
            : `${API_BASE}/me/uploads/collections/${collectionID}/unpublish`;
      const body =
        action === "unpublish"
          ? JSON.stringify({
              reason: "用户主动下架",
            })
          : undefined;
      const res = await fetchWithAuthRetry(endpoint, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "操作失败，请稍后重试");
        return;
      }
      await loadPage();
    } catch {
      setErrorMessage("操作失败，请稍后重试");
    } finally {
      setActingType(null);
    }
  };

  const collection = detail?.collection;
  const review = detail?.review;
  const actions = detail?.actions;
  const cover = (collection?.preview_images && collection.preview_images[0]) || collection?.cover_url || "";

  const reviewMeta = useMemo(
    () => reviewStatusMeta(review?.review_status, collection?.status),
    [review?.review_status, collection?.status]
  );
  const publishMeta = useMemo(() => publishStatusMeta(review?.publish_status), [review?.publish_status]);
  const ReviewIcon = reviewMeta.icon;
  const PublishIcon = publishMeta.icon;

  if (!collectionID || Number.isNaN(collectionID)) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          无效的合集 ID
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/mine/favorites/review"
            className="group flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-emerald-200 hover:text-emerald-600"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">投稿审核 · 详情管理</h1>
            <p className="text-sm text-slate-500">提交审核并维护合集上架状态</p>
          </div>
        </div>
        <div className="inline-flex items-center rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 ring-1 ring-slate-100">
          合集 ID：#{collectionID}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-600">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8">
          <div className="flex h-56 items-center justify-center text-sm font-semibold text-slate-400">
            <Loader2 size={20} className="mr-2 animate-spin text-emerald-500" />
            正在加载详情...
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex items-start gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                  {cover ? (
                    <SmartImage
                      url={cover}
                      alt={collection?.title || "cover"}
                      className="object-cover"
                      preferProxy={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-slate-300">
                      暂无封面
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="line-clamp-1 text-xl font-black text-slate-900">
                    {collection?.title || "未命名合集"}
                  </h2>
                  <p className="line-clamp-2 text-sm text-slate-500">
                    {collection?.description || "暂无描述"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${reviewMeta.className}`}>
                      <ReviewIcon size={12} />
                      {reviewMeta.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${publishMeta.className}`}>
                      <PublishIcon size={12} />
                      {publishMeta.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] text-slate-400">表情包数量</p>
                  <p className="mt-0.5 font-black text-slate-800">{Math.max(0, Number(collection?.file_count || 0))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">提审次数</p>
                  <p className="mt-0.5 font-black text-slate-800">{Math.max(0, Number(review?.submit_count || 0))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">最近提审</p>
                  <p className="mt-0.5 font-black text-slate-800">{formatDate(review?.last_submitted_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">最近审核</p>
                  <p className="mt-0.5 font-black text-slate-800">{formatDate(review?.last_reviewed_at)}</p>
                </div>
              </div>

              {review?.reject_reason ? (
                <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                  驳回原因：{review.reject_reason}
                </div>
              ) : null}
            </div>

            <div className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24">
              <h3 className="text-sm font-black text-slate-900">操作面板</h3>
              <p className="mt-1 text-xs text-slate-500">提交审核与上下架仅在本页处理</p>

              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  disabled={!actions?.can_submit_review || Boolean(actingType)}
                  onClick={() => void callAction("submit")}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-emerald-600 hover:border-emerald-600 disabled:opacity-40"
                >
                  {actingType === "submit" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  提交审核
                </button>
                <button
                  type="button"
                  disabled={!actions?.can_publish || Boolean(actingType)}
                  onClick={() => void callAction("publish")}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
                >
                  {actingType === "publish" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  上架
                </button>
                <button
                  type="button"
                  disabled={!actions?.can_unpublish || Boolean(actingType)}
                  onClick={() => void callAction("unpublish")}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-40"
                >
                  {actingType === "unpublish" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  下架
                </button>
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                <p>提交审核：{actions?.can_submit_review ? "可操作" : "不可操作"}</p>
                <p className="mt-0.5">上架：{actions?.can_publish ? "可操作" : "不可操作"}</p>
                <p className="mt-0.5">下架：{actions?.can_unpublish ? "可操作" : "不可操作"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">审核日志</h3>
              <span className="text-xs font-semibold text-slate-400">共 {logs.length} 条</span>
            </div>

            {!logs.length ? (
              <div className="py-12 text-center text-sm font-semibold text-slate-400">暂无审核日志</div>
            ) : (
              <div className="mt-4 space-y-3">
                {logs.map((log, index) => (
                  <div key={`${log.id || "log"}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                          {actionLabel(log.action)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {log.operator_name || "系统"}（{log.operator_role || "系统"}）
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(log.created_at)}</span>
                    </div>

                    <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <p>
                        审核状态：{reviewStatusLabel(log.from_review_status)} →{" "}
                        <span className="font-bold text-emerald-700">{reviewStatusLabel(log.to_review_status)}</span>
                      </p>
                      <p>
                        上架状态：{publishStatusLabel(log.from_publish_status)} →{" "}
                        <span className="font-bold text-emerald-700">{publishStatusLabel(log.to_publish_status)}</span>
                      </p>
                    </div>

                    {log.reason ? <p className="mt-2 text-xs text-slate-500">备注：{log.reason}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
