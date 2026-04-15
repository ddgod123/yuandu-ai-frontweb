"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import SmartImage from "@/components/common/SmartImage";
import { API_BASE } from "@/lib/auth-client";

const PAGE_SIZE = 20;

type OriginalCollection = {
  id: number;
  title?: string;
  description?: string;
  cover_url?: string;
  preview_images?: string[];
  file_count?: number;
  updated_at?: string;
  created_at?: string;
};

type OriginalCollectionListResponse = {
  items?: OriginalCollection[];
  total?: number;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

async function parseApiError(res: Response) {
  try {
    const payload = (await res.clone().json()) as ApiErrorPayload;
    return (payload.message || payload.error || "").trim();
  } catch {
    return "";
  }
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("zh-CN");
}

export default function OriginalEmojisPage() {
  const [items, setItems] = useState<OriginalCollection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canLoadMore = useMemo(() => items.length < total, [items.length, total]);

  const loadCollections = async (nextPage: number, append: boolean) => {
    setLoading(true);
    if (!append) setErrorMessage(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        page_size: String(PAGE_SIZE),
        preview_count: "15",
        source: "ugc_upload",
        is_original: "true",
      });
      const res = await fetch(`${API_BASE}/collections?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "加载原创表情失败，请稍后重试");
        if (!append) {
          setItems([]);
          setTotal(0);
        }
        return;
      }
      const data = (await res.json()) as OriginalCollectionListResponse;
      const nextItems = Array.isArray(data.items) ? data.items : [];
      const nextTotal = typeof data.total === "number" ? data.total : nextItems.length;
      setTotal(nextTotal);
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
      setPage(nextPage);
    } catch {
      setErrorMessage("加载原创表情失败，请稍后重试");
      if (!append) {
        setItems([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCollections(1, false);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-600 ring-1 ring-emerald-100">
              <Sparkles size={12} />
              ORIGINAL EMOJIS
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">原创表情</h1>
            <p className="mt-1 text-sm text-slate-500">展示用户原创并通过审核上架的表情包合集</p>
          </div>
          <div className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
            共 {total} 个原创合集
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {errorMessage}
          </div>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm font-semibold text-slate-500">
            <Loader2 size={18} className="mr-2 animate-spin" />
            加载中...
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white py-20 text-center text-sm font-semibold text-slate-500">
            暂无已上架原创表情
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const cover = (item.preview_images && item.preview_images[0]) || item.cover_url || "";
            return (
              <div
                key={item.id}
                className="group overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
                  {cover ? (
                    <SmartImage
                      url={cover}
                      alt={item.title || "cover"}
                      className="object-cover transition duration-300 group-hover:scale-105"
                      preferProxy={false}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-300">
                      暂无封面
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="line-clamp-1 text-base font-black text-slate-900">{item.title || "未命名合集"}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">{item.description || "暂无描述"}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{Math.max(0, Number(item.file_count || 0))} 张</span>
                    <span>更新于 {formatDate(item.updated_at || item.created_at)}</span>
                  </div>

                  <Link
                    href={`/collections/${item.id}`}
                    className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    查看合集
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {canLoadMore ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadCollections(page + 1, true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              加载更多
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
