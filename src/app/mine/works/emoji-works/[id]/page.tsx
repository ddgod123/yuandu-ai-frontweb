"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Image as ImageIcon } from "lucide-react";
import SmartImage from "@/components/common/SmartImage";
import { API_BASE, fetchWithAuthRetry } from "@/lib/auth-client";

type UploadCollection = {
  id: number;
  title: string;
  description?: string;
  file_count?: number;
  created_at?: string;
  updated_at?: string;
};

type UploadEmoji = {
  id: number;
  collection_id: number;
  title: string;
  preview_url?: string;
  format?: string;
  size_bytes?: number;
  created_at?: string;
};

type EmojiListResponse = {
  items?: UploadEmoji[];
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

function formatBytes(size?: number) {
  const value = Math.max(0, Number(size || 0));
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmojiWorksDetailPage() {
  const params = useParams<{ id: string }>();
  const collectionID = Number(params?.id || 0);

  const [collection, setCollection] = useState<UploadCollection | null>(null);
  const [emojis, setEmojis] = useState<UploadEmoji[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentCount = useMemo(
    () => Math.max(0, Number(collection?.file_count || emojis.length || 0)),
    [collection?.file_count, emojis.length]
  );

  const loadDetail = useCallback(async () => {
    if (!collectionID) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [collectionRes, emojiRes] = await Promise.all([
        fetchWithAuthRetry(`${API_BASE}/me/uploads/collections/${collectionID}`),
        fetchWithAuthRetry(`${API_BASE}/me/uploads/collections/${collectionID}/emojis?page=1&page_size=100`),
      ]);

      if (!collectionRes.ok) {
        const msg = await parseApiError(collectionRes);
        setErrorMessage(msg || "加载合集失败");
        setCollection(null);
        setEmojis([]);
        return;
      }
      if (!emojiRes.ok) {
        const msg = await parseApiError(emojiRes);
        setErrorMessage(msg || "加载表情失败");
        setCollection(null);
        setEmojis([]);
        return;
      }

      const collectionData = (await collectionRes.json()) as UploadCollection;
      const emojiData = (await emojiRes.json()) as EmojiListResponse;
      setCollection(collectionData);
      setEmojis(Array.isArray(emojiData.items) ? emojiData.items : []);
    } catch {
      setErrorMessage("加载失败，请稍后重试");
      setCollection(null);
      setEmojis([]);
    } finally {
      setLoading(false);
    }
  }, [collectionID]);

  useEffect(() => {
    if (!collectionID) return;
    void loadDetail();
  }, [collectionID, loadDetail]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/mine/works/emoji-works"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          返回表情包作品
        </Link>
        <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-100">
          共 {currentCount} 张
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">{collection?.title || "表情包作品详情"}</h1>
        <p className="mt-1 text-sm text-slate-500">{collection?.description || "该合集暂无描述"}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
          <span>创建于 {formatDate(collection?.created_at)}</span>
          <span>更新于 {formatDate(collection?.updated_at)}</span>
          <span>共 {currentCount} 张</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm font-semibold text-slate-500">
          <Loader2 size={18} className="mr-2 animate-spin" />
          加载中...
        </div>
      ) : emojis.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-14 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
            <ImageIcon size={26} />
          </div>
          <p className="text-sm font-semibold text-slate-500">该合集还没有表情内容</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {emojis.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-50">
                {item.preview_url ? (
                  <SmartImage
                    url={item.preview_url}
                    alt={item.title || "emoji"}
                    className="object-cover"
                    preferProxy={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <ImageIcon size={30} />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-1 text-sm font-bold text-slate-900">{item.title || "未命名表情"}</p>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>{(item.format || "img").toUpperCase()}</span>
                  <span>{formatBytes(item.size_bytes)}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-400">上传于 {formatDate(item.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
