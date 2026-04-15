"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Heart, Loader2, Calendar, User, Hash, Download, ThumbsUp, Sparkles, FolderHeart, ChevronRight } from "lucide-react";
import AuthPromptModal from "@/components/common/AuthPromptModal";
import {
  API_BASE,
  ensureAuthSession,
  fetchWithAuthRetry,
} from "@/lib/auth-client";
const PAGE_SIZE = 12;
const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;

type FavoriteCollectionRecord = {
  collection_id: number;
  created_at: string;
  collection: {
    id: number;
    title: string;
    cover_url?: string;
    file_count?: number;
    favorite_count?: number;
    like_count?: number;
    download_count?: number;
    creator_name?: string;
    creator_name_zh?: string;
    creator_name_en?: string;
    creator_avatar_url?: string;
  };
};

type FavoriteCollectionResponse = {
  items?: FavoriteCollectionRecord[];
  total?: number;
};

type ApiEmojiPreview = {
  preview_url?: string;
  file_url?: string;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

async function parseApiError(res: Response) {
  try {
    const payload = (await res.clone().json()) as ApiErrorPayload;
    return {
      code: (payload?.error || "").trim(),
      message: (payload?.message || "").trim(),
    };
  } catch {
    return { code: "", message: "" };
  }
}

function resolveCollectionFavoriteError(status: number, code: string, fallback: string) {
  if (status === 403) {
    if (code === "user_disabled") return "账号状态异常，暂时无法操作收藏";
    if (code === "subscription_required") return "当前账号暂无收藏权限，请先开通订阅";
    return "暂无权限，请稍后再试";
  }
  if (status === 404) return "目标合集不存在或已下架";
  if (status === 429) return "操作过于频繁，请稍后重试";
  if (status >= 500) return "服务繁忙，请稍后重试";
  return fallback;
}

function isImageFile(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return IMAGE_EXT_REGEX.test(clean);
}

function extractObjectKey(rawUrl: string) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";
  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
      const parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
      return decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
    }
  } catch {
    // ignore parse errors
  }
  return trimmed.replace(/^\/+/, "").split("?")[0].split("#")[0];
}

function buildStorageProxyCandidate(rawUrl: string) {
  const key = extractObjectKey(rawUrl);
  if (!key || !key.startsWith("emoji/")) return "";
  return `${API_BASE}/storage/proxy?key=${encodeURIComponent(key)}`;
}

function buildImageCandidates(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];
  const proxyCandidate = buildStorageProxyCandidate(trimmed);
  if (!isImageFile(trimmed) && !proxyCandidate) return [];

  const candidates: string[] = [];
  const isProxyURL = (value: string) => value.includes("/api/storage/proxy?");
  const add = (value: string) => {
    if (!value) return;
    if (!isProxyURL(value) && !isImageFile(value)) return;
    if (!candidates.includes(value)) {
      candidates.push(value);
    }
  };

  // 开发阶段默认优先走后端 storage proxy，避免依赖未备案/冻结域名。
  add(proxyCandidate);

  // 避免 SSR/CSR 首帧因 window 协议差异导致 hydration mismatch。
  const preferHttps = true;

  if (trimmed.startsWith("//")) {
    const httpsURL = `https:${trimmed}`;
    const httpURL = `http:${trimmed}`;
    if (preferHttps) {
      add(httpsURL);
      add(httpURL);
    } else {
      add(httpURL);
      add(httpsURL);
    }
    add(proxyCandidate);
    return candidates;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const httpsURL = trimmed.replace(/^http:\/\//i, "https://");
    const httpURL = trimmed.replace(/^https:\/\//i, "http://");
    if (preferHttps) {
      add(httpsURL);
      add(httpURL);
    } else {
      add(httpURL);
      add(httpsURL);
    }
    add(proxyCandidate);
    return candidates;
  }

  if (trimmed.startsWith("/")) {
    add(trimmed);
    add(proxyCandidate);
    return candidates;
  }

  const hostCandidate = trimmed.split("/")[0];
  if (hostCandidate.includes(".") || hostCandidate.includes(":")) {
    if (preferHttps) {
      add(`https://${trimmed}`);
      add(`http://${trimmed}`);
    } else {
      add(`http://${trimmed}`);
      add(`https://${trimmed}`);
    }
    add(proxyCandidate);
    return candidates;
  }

  add(trimmed);
  add(proxyCandidate);
  return candidates;
}

function FallbackImage({ url, alt }: { url: string; alt: string }) {
  const candidates = useMemo(() => buildImageCandidates(url), [url]);
  const [index, setIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);
  const src = candidates[index];

  if (!src || failedAll) {
    return <div className="h-full w-full bg-slate-100" />;
  }

  return (
    <div className="relative h-full w-full">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className="object-cover transition duration-500 group-hover:scale-105"
        onError={() => {
          setIndex((prev) => {
            if (prev + 1 < candidates.length) {
              return prev + 1;
            }
            setFailedAll(true);
            return prev;
          });
        }}
      />
    </div>
  );
}

function formatFavoriteDate(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN");
}

async function fetchCollectionPreview(collectionID: number, signal: AbortSignal) {
  try {
    const params = new URLSearchParams({
      collection_id: String(collectionID),
      page: "1",
      page_size: "1",
    });
    const res = await fetchWithAuthRetry(`${API_BASE}/emojis?${params.toString()}`, {
      signal,
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { items?: ApiEmojiPreview[] };
    const first = Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null;
    return (first?.preview_url || first?.file_url || "").trim();
  } catch {
    if (signal.aborted) return "";
  }
  return "";
}

export default function FavoriteCollectionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<FavoriteCollectionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removingCollection, setRemovingCollection] = useState<number | null>(null);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);

  const openAuthPrompt = (message: string) => {
    setErrorMessage(null);
    setAuthPromptMessage(message);
  };

  const closeAuthPrompt = () => {
    setAuthPromptMessage(null);
  };

  const handleGoLogin = () => {
    setAuthPromptMessage(null);
    router.push(`/login?next=${encodeURIComponent("/mine/favorites/collections")}`);
  };

  const ensureAuthenticated = async (message: string) => {
    if (await ensureAuthSession()) return true;
    openAuthPrompt(message);
    return false;
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadFavorites = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(PAGE_SIZE),
        });
        const res = await fetchWithAuthRetry(`${API_BASE}/favorites/collections?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.status === 401) {
          setErrorMessage(null);
          setAuthPromptMessage("请先登录后查看收藏");
          return;
        }
        if (!res.ok) {
          const apiErr = await parseApiError(res);
          setErrorMessage(apiErr.message || resolveCollectionFavoriteError(res.status, apiErr.code, "加载收藏合集失败，请稍后重试"));
          return;
        }
        const data = (await res.json()) as FavoriteCollectionResponse;
        const nextItems = Array.isArray(data.items) ? data.items : [];
        const nextTotal = typeof data.total === "number" ? data.total : nextItems.length;
        const resolvedItems = await Promise.all(
          nextItems.map(async (record) => {
            let coverURL = (record.collection.cover_url || "").trim();
            if (!isImageFile(coverURL)) {
              const previewURL = await fetchCollectionPreview(record.collection.id, controller.signal);
              if (previewURL) {
                coverURL = previewURL;
              }
            }
            return {
              ...record,
              collection: {
                ...record.collection,
                cover_url: coverURL,
              },
            };
          })
        );
        setTotal(nextTotal);
        setItems((prev) => (page === 1 ? resolvedItems : [...prev, ...resolvedItems]));
      } catch {
        if (controller.signal.aborted) return;
        setErrorMessage("加载收藏合集失败，请稍后重试");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadFavorites();
    return () => controller.abort();
  }, [page]);

  const canLoadMore = items.length < total;

  const handleRemoveFavoriteCollection = async (collectionId: number) => {
    if (!collectionId || removingCollection === collectionId) return;
    if (!(await ensureAuthenticated("请先登录再继续收藏"))) return;
    setRemovingCollection(collectionId);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/collections/${collectionId}/favorite`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续收藏");
        return;
      }
      if (!res.ok) {
        const apiErr = await parseApiError(res);
        setErrorMessage(apiErr.message || resolveCollectionFavoriteError(res.status, apiErr.code, "取消合集收藏失败，请稍后重试"));
        return;
      }
      setItems((prev) => prev.filter((item) => item.collection_id !== collectionId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch {
      setErrorMessage("取消合集收藏失败，请稍后重试");
    } finally {
      setRemovingCollection(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <AuthPromptModal
        open={Boolean(authPromptMessage)}
        message={authPromptMessage || ""}
        onClose={closeAuthPrompt}
        onLogin={handleGoLogin}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between px-2">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-600 ring-1 ring-emerald-100">
            <Sparkles size={12} className="animate-pulse" />
            FAVORITE COLLECTIONS
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">我的收藏 · 合集</h1>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-400 ring-1 ring-slate-100">
          <FolderHeart size={16} />
          共 {total} 个收藏合集
        </div>
      </div>

      {errorMessage ? (
        <div className="mx-2 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-500 animate-in fade-in slide-in-from-top-2">
          <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          {errorMessage}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-slate-100 bg-white py-24 text-center shadow-sm">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-200">
            <FolderHeart size={40} />
          </div>
          <h3 className="text-lg font-black text-slate-900">暂无收藏合集</h3>
          <p className="mt-2 text-sm font-medium text-slate-400">去首页发现更多精彩的表情包合集吧</p>
          <Link href="/" className="mt-8 rounded-2xl bg-slate-900 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0">
            立即去探索
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((record) => {
          const collection = record.collection;
          const author =
            collection.creator_name ||
            collection.creator_name_zh ||
            collection.creator_name_en ||
            "官方";
          return (
            <Link
              key={`${record.collection_id}-${record.created_at}`}
              href={`/collections/${collection.id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-50">
                {collection.cover_url ? (
                  <FallbackImage
                    key={collection.cover_url}
                    url={collection.cover_url}
                    alt={collection.title}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-200">
                    <FolderHeart size={48} />
                  </div>
                )}
                
                {/* 收藏按钮 */}
                <div className="absolute right-2 top-2 z-10">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRemoveFavoriteCollection(collection.id);
                    }}
                    disabled={removingCollection === collection.id}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow backdrop-blur-md transition-all hover:scale-105 hover:bg-white active:scale-95 disabled:opacity-60"
                    aria-label="取消收藏"
                  >
                    {removingCollection === collection.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Heart size={14} className="fill-current" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-2.5">
                <div className="space-y-1.5">
                  <h2 className="line-clamp-1 text-sm font-black text-slate-900 transition-colors group-hover:text-emerald-600">
                    {collection.title}
                  </h2>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-400">
                    <div className="inline-flex min-w-0 items-center gap-1">
                      <User size={10} className="shrink-0 text-slate-300" />
                      <span className="truncate">{author}</span>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-1">
                      <Calendar size={10} className="text-slate-300" />
                      {formatFavoriteDate(record.created_at)}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-4 gap-1 text-[10px] font-bold">
                  <div className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-1.5 py-1 text-slate-600">
                    <Hash size={10} className="text-slate-400" />
                    {collection.file_count || 0}
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-1.5 py-1 text-amber-700">
                    <Heart size={10} className="text-amber-500" />
                    {collection.favorite_count || 0}
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-1.5 py-1 text-emerald-700">
                    <Download size={10} className="text-emerald-500" />
                    {collection.download_count || 0}
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-1.5 py-1 text-rose-700">
                    <ThumbsUp size={10} className="text-rose-500" />
                    {collection.like_count || 0}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
 
      {canLoadMore ? (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={loading}
            className="group flex h-12 items-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-8 text-sm font-black text-slate-600 transition-all hover:border-emerald-500 hover:text-emerald-600 hover:shadow-lg hover:shadow-emerald-500/5 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                加载更多收藏
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
