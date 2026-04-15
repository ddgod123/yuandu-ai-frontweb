"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import SmartImage from "@/components/common/SmartImage";
import { API_BASE, fetchWithAuthRetry } from "@/lib/auth-client";

const PAGE_SIZE = 12;

type ReviewCollection = {
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
};

type ReviewCollectionListResponse = {
  items?: ReviewCollection[];
  total?: number;
  page?: number;
  page_size?: number;
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

export default function MyUploadReviewPage() {
  const [items, setItems] = useState<ReviewCollection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deletingID, setDeletingID] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canLoadMore = useMemo(() => items.length < total, [items.length, total]);

  const loadItems = async (nextPage: number, append: boolean) => {
    setLoading(true);
    if (!append) setErrorMessage(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        page_size: String(PAGE_SIZE),
      });
      const res = await fetchWithAuthRetry(`${API_BASE}/me/uploads/review/collections?${params.toString()}`);
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "加载投稿审核列表失败");
        if (!append) {
          setItems([]);
          setTotal(0);
        }
        return;
      }
      const data = (await res.json()) as ReviewCollectionListResponse;
      const nextItems = Array.isArray(data.items) ? data.items : [];
      const nextTotal = typeof data.total === "number" ? data.total : nextItems.length;
      setTotal(nextTotal);
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
      setPage(nextPage);
    } catch {
      setErrorMessage("加载投稿审核列表失败");
      if (!append) {
        setItems([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems(1, false);
  }, []);

  const handleDeleteCollection = async (collectionID: number, title: string) => {
    if (!collectionID || deletingID) return;
    const confirmed = window.confirm(`确认删除合集「${title || "未命名合集"}」吗？删除后将不会在你的账号内展示。`);
    if (!confirmed) return;
    setDeletingID(collectionID);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/uploads/collections/${collectionID}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "删除失败，请稍后重试");
        return;
      }
      setItems((prev) =>
        prev.filter((row) => Number(row.collection?.id || 0) !== collectionID)
      );
      setTotal((prev) => Math.max(0, prev - 1));
      setSuccessMessage("合集已删除");
    } catch {
      setErrorMessage("删除失败，请稍后重试");
    } finally {
      setDeletingID(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <div className="sticky top-16 z-40 -mx-2 border-b border-slate-100 bg-white/80 px-4 py-5 backdrop-blur-xl shadow-sm sm:mx-0 sm:rounded-[2rem] sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 rounded-full bg-emerald-500" />
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-emerald-600 uppercase">
                <Sparkles size={12} className="animate-pulse" />
                Review Center
              </div>
              <h1 className="text-xl font-black text-slate-900">投稿审核</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 ring-1 ring-slate-100">
            <ShieldCheck size={14} />
            共 {total} 个待维护合集
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="mx-2 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-500 animate-in fade-in slide-in-from-top-2">
          <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="mx-2 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-600 animate-in fade-in slide-in-from-top-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {successMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const collection = item.collection;
          const review = item.review;
          const collectionID = Number(collection?.id || 0);
          const cover = (collection?.preview_images && collection.preview_images[0]) || collection?.cover_url || "";
          const reviewMeta = reviewStatusMeta(review?.review_status, collection?.status);
          const publishMeta = publishStatusMeta(review?.publish_status);
          const ReviewIcon = reviewMeta.icon;
          const PublishIcon = publishMeta.icon;
          
          return (
            <div
              key={collectionID}
              className="group relative flex flex-col transition-all duration-500 hover:-translate-y-1.5"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[2.5rem] bg-slate-50 shadow-sm ring-1 ring-inset ring-slate-100/50 transition-all duration-500 group-hover:shadow-[0_20px_40px_-15px_rgba(15,23,42,0.1)] group-hover:ring-emerald-100">
                {cover ? (
                  <SmartImage
                    url={cover}
                    alt={collection?.title || "cover"}
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    preferProxy={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-300">
                    暂无封面
                  </div>
                )}
                
                {/* 状态标签悬浮 */}
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black backdrop-blur-md shadow-sm ${reviewMeta.className.replace('bg-', 'bg-').replace('text-', 'text-')}`}>
                    <ReviewIcon size={12} />
                    {reviewMeta.label}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black backdrop-blur-md shadow-sm ${publishMeta.className}`}>
                    <PublishIcon size={12} />
                    {publishMeta.label}
                  </span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>

              <div className="mt-5 px-2">
                <div className="flex items-center justify-between">
                  <h3 className="line-clamp-1 text-lg font-black tracking-tight text-slate-900 transition-colors group-hover:text-emerald-600">
                    {collection?.title || "未命名合集"}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">#{collectionID}</span>
                </div>
                
                <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-400">
                  {collection?.description || "暂无描述"}
                </p>

                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50/50 p-3 ring-1 ring-slate-100/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">表情数量</span>
                    <span className="text-sm font-black text-slate-700">{Math.max(0, Number(collection?.file_count || 0))} P</span>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">提审次数</span>
                    <span className="text-sm font-black text-slate-700">{Math.max(0, Number(review?.submit_count || 0))} 次</span>
                  </div>
                </div>

                {review?.reject_reason ? (
                  <div className="mt-3 rounded-xl bg-rose-50/50 p-2.5 ring-1 ring-rose-100/50">
                    <p className="text-[10px] font-bold text-rose-600">
                      驳回原因：{review.reject_reason}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/mine/favorites/review/${collectionID}`}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 text-[11px] font-black text-slate-600 transition-all hover:border-emerald-200 hover:text-emerald-600 active:scale-[0.98]"
                  >
                    去管理（提交审核 / 上下架）
                    <ChevronRight size={14} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCollection(collectionID, collection?.title || "未命名合集")}
                    disabled={deletingID === collectionID}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-full border border-rose-200 px-3 text-[11px] font-black text-rose-500 transition hover:bg-rose-50 disabled:opacity-60"
                    title="删除合集"
                  >
                    {deletingID === collectionID ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    删除
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-slate-500">暂无可审核合集，请先到“我的上传”创建合集</p>
          <Link
            href="/mine/favorites/uploads"
            className="mt-4 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600"
          >
            前往我的上传
          </Link>
        </div>
      ) : null}

      {canLoadMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadItems(page + 1, true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            加载更多
          </button>
        </div>
      ) : null}
    </div>
  );
}
