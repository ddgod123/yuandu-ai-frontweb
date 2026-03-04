"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Heart, Loader2 } from "lucide-react";
import AuthPromptModal from "@/components/common/AuthPromptModal";
import {
  API_BASE,
  fetchWithAuth,
  fetchWithAuthRetry,
  hasValidAccessToken,
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

function isImageFile(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return IMAGE_EXT_REGEX.test(clean);
}

function buildImageCandidates(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];
  if (!isImageFile(trimmed)) return [];

  const candidates: string[] = [];
  const add = (value: string) => {
    if (value && isImageFile(value) && !candidates.includes(value)) {
      candidates.push(value);
    }
  };

  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  const preferHttps = protocol === "https:";

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
    return candidates;
  }

  if (trimmed.startsWith("/")) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    add(origin ? `${origin}${trimmed}` : trimmed);
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
    return candidates;
  }

  add(trimmed);
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

function isLikelyObjectKey(value: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  return trimmed.includes("/");
}

async function resolveCollectionCoverURL(rawCover: string | undefined, signal: AbortSignal) {
  const trimmed = (rawCover || "").trim();
  if (!trimmed) return "";
  if (!isLikelyObjectKey(trimmed)) return trimmed;

  try {
    const params = new URLSearchParams({ key: trimmed });
    const res = await fetchWithAuthRetry(`${API_BASE}/storage/url?${params.toString()}`, {
      signal,
    });
    if (res.ok) {
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        return data.url;
      }
    }
  } catch {
    if (signal.aborted) return "";
  }
  return trimmed;
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
    router.push(`/login?next=${encodeURIComponent("/profile/favorites/collections")}`);
  };

  const ensureAuthenticated = (message: string) => {
    if (hasValidAccessToken()) return true;
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
          throw new Error("failed to load");
        }
        const data = (await res.json()) as FavoriteCollectionResponse;
        const nextItems = Array.isArray(data.items) ? data.items : [];
        const nextTotal = typeof data.total === "number" ? data.total : nextItems.length;
        const resolvedItems = await Promise.all(
          nextItems.map(async (record) => {
            let coverURL = await resolveCollectionCoverURL(record.collection.cover_url, controller.signal);
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
    if (!ensureAuthenticated("请先登录再继续收藏")) return;
    setRemovingCollection(collectionId);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuth(`${API_BASE}/collections/${collectionId}/favorite`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续收藏");
        return;
      }
      if (!res.ok) {
        throw new Error("failed remove");
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
    <div className="mx-auto max-w-6xl">
      <AuthPromptModal
        open={Boolean(authPromptMessage)}
        message={authPromptMessage || ""}
        onClose={closeAuthPrompt}
        onLogin={handleGoLogin}
      />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">我的收藏 · 合集</h1>
        <div className="text-xs font-semibold text-slate-400">共 {total} 个收藏合集</div>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          {errorMessage}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-16 text-center text-sm font-semibold text-slate-400 shadow-sm">
          你还没有收藏任何合集
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
              className="group overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                {collection.cover_url ? (
                  <FallbackImage
                    key={collection.cover_url}
                    url={collection.cover_url}
                    alt={collection.title}
                  />
                ) : (
                  <div className="h-full w-full bg-slate-100" />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-1 text-base font-black text-slate-900">{collection.title}</h2>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRemoveFavoriteCollection(collection.id);
                    }}
                    disabled={removingCollection === collection.id}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100 disabled:opacity-60"
                    aria-label="取消收藏"
                  >
                    {removingCollection === collection.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Heart size={14} className="fill-current" />
                    )}
                  </button>
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-500">创作者：{author}</div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  收藏于：{formatFavoriteDate(record.created_at)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">数量</div>
                    <div className="text-sm font-black text-slate-900">{collection.file_count || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">收藏</div>
                    <div className="text-sm font-black text-slate-900">{collection.favorite_count || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">下载</div>
                    <div className="text-sm font-black text-slate-900">{collection.download_count || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">点赞</div>
                    <div className="text-sm font-black text-slate-900">{collection.like_count || 0}</div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {canLoadMore ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "加载中..." : "加载更多"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
