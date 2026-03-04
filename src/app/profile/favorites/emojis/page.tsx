"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, Download, Heart, Loader2 } from "lucide-react";
import AuthPromptModal from "@/components/common/AuthPromptModal";
import {
  API_BASE,
  fetchWithAuth,
  fetchWithAuthRetry,
  hasValidAccessToken,
} from "@/lib/auth-client";
const PAGE_SIZE = 36;
const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;

type FavoriteEmojiRecord = {
  emoji_id: number;
  created_at: string;
  emoji: {
    id: number;
    collection_id: number;
    title?: string;
    file_url?: string;
    preview_url?: string;
    format?: string;
    size_bytes?: number;
    favorited?: boolean;
  };
};

type FavoriteEmojiResponse = {
  items?: FavoriteEmojiRecord[];
  total?: number;
};

function triggerURLDownload(url: string, filename?: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "emoji";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function parseDownloadFileName(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim() || fallback;
    } catch {
      return fallback;
    }
  }
  const plainMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim() || fallback;
  }
  return fallback;
}

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
  const src = candidates[index];

  if (!src) {
    return <div className="h-full w-full bg-slate-50" />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => {
        setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
      }}
    />
  );
}

function getEmojiFormatLabel(record: FavoriteEmojiRecord) {
  const raw = (record.emoji?.format || "").trim();
  if (raw) {
    const normalized = raw.includes("/") ? raw.split("/").pop() || raw : raw;
    const clean = normalized.replace(/^x-/, "").replace(/^image\//, "").trim();
    if (clean) return clean.toUpperCase();
  }
  const source = (record.emoji?.file_url || record.emoji?.preview_url || "").split("?")[0].split("#")[0];
  const ext = source.includes(".") ? source.split(".").pop() || "" : "";
  return ext ? ext.toUpperCase() : "IMG";
}

function getEmojiSizeLabel(sizeBytes?: number) {
  if (!sizeBytes || sizeBytes <= 0) return "大小未知";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FavoriteEmojisPage() {
  const router = useRouter();
  const [items, setItems] = useState<FavoriteEmojiRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadingEmoji, setDownloadingEmoji] = useState<number | null>(null);
  const [downloadedEmoji, setDownloadedEmoji] = useState<number | null>(null);
  const [removingEmoji, setRemovingEmoji] = useState<number | null>(null);
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
    router.push(`/login?next=${encodeURIComponent("/profile/favorites/emojis")}`);
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
        const res = await fetchWithAuthRetry(`${API_BASE}/favorites?${params.toString()}`, {
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
        const data = (await res.json()) as FavoriteEmojiResponse;
        const nextItems = Array.isArray(data.items) ? data.items : [];
        const nextTotal = typeof data.total === "number" ? data.total : nextItems.length;
        setTotal(nextTotal);
        setItems((prev) => (page === 1 ? nextItems : [...prev, ...nextItems]));
      } catch {
        if (controller.signal.aborted) return;
        setErrorMessage("加载收藏表情失败，请稍后重试");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadFavorites();
    return () => controller.abort();
  }, [page]);

  const handleDownloadEmoji = async (emojiId: number) => {
    if (!emojiId || downloadingEmoji) return;
    if (!ensureAuthenticated("请先登录再继续下载")) return;
    setDownloadingEmoji(emojiId);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuth(`${API_BASE}/emojis/${emojiId}/download-file`);
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续下载");
        return;
      }
      if (!res.ok) {
        throw new Error("failed download");
      }
      const blob = await res.blob();
      const fileName = parseDownloadFileName(
        res.headers.get("Content-Disposition"),
        `emoji-${emojiId}`
      );
      const objectURL = window.URL.createObjectURL(blob);
      triggerURLDownload(objectURL, fileName);
      window.setTimeout(() => {
        window.URL.revokeObjectURL(objectURL);
      }, 2000);
      setDownloadedEmoji(emojiId);
      window.setTimeout(() => {
        setDownloadedEmoji((prev) => (prev === emojiId ? null : prev));
      }, 1600);
    } catch {
      setErrorMessage("下载失败，请稍后重试");
    } finally {
      setDownloadingEmoji(null);
    }
  };

  const handleRemoveFavorite = async (emojiId: number) => {
    if (!emojiId || removingEmoji === emojiId) return;
    if (!ensureAuthenticated("请先登录再继续收藏")) return;
    setRemovingEmoji(emojiId);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuth(`${API_BASE}/favorites/${emojiId}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续收藏");
        return;
      }
      if (!res.ok) {
        throw new Error("failed remove");
      }
      setItems((prev) => prev.filter((item) => item.emoji_id !== emojiId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch {
      setErrorMessage("取消收藏失败，请稍后重试");
    } finally {
      setRemovingEmoji(null);
    }
  };

  const canLoadMore = items.length < total;

  return (
    <div className="mx-auto max-w-6xl">
      <AuthPromptModal
        open={Boolean(authPromptMessage)}
        message={authPromptMessage || ""}
        onClose={closeAuthPrompt}
        onLogin={handleGoLogin}
      />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">我的收藏 · 表情</h1>
        <div className="text-xs font-semibold text-slate-400">共 {total} 张收藏表情</div>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          {errorMessage}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-16 text-center text-sm font-semibold text-slate-400 shadow-sm">
          你还没有收藏任何单张表情
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((record) => {
          const emoji = record.emoji;
          const preview = emoji.preview_url || emoji.file_url || "";
          const formatLabel = getEmojiFormatLabel(record);
          return (
            <div
              key={`${record.emoji_id}-${record.created_at}`}
              className="group rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-50">
                {preview ? <FallbackImage url={preview} alt={emoji.title || `emoji-${emoji.id}`} /> : null}
                <div className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-black text-white">
                  {formatLabel}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="text-[11px] font-semibold text-slate-400">{getEmojiSizeLabel(emoji.size_bytes)}</div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleRemoveFavorite(emoji.id)}
                    disabled={removingEmoji === emoji.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100 disabled:opacity-60"
                    aria-label="取消收藏"
                  >
                    {removingEmoji === emoji.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Heart size={14} className="fill-current" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadEmoji(emoji.id)}
                    className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60"
                    disabled={downloadingEmoji === emoji.id}
                  >
                    {downloadingEmoji === emoji.id ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        下载中
                      </>
                    ) : downloadedEmoji === emoji.id ? (
                      <>
                        <Check size={12} />
                        已下载
                      </>
                    ) : (
                      <>
                        <Download size={12} />
                        下载
                      </>
                    )}
                  </button>
                </div>
                <Link
                  href={`/collections/${emoji.collection_id}`}
                  className="block rounded-lg border border-slate-200 px-2 py-1 text-center text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  查看合集
                </Link>
              </div>
            </div>
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
