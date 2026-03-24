"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, Download, Heart, Loader2, Sparkles, FolderHeart, ChevronRight, FileType, HardDrive, ExternalLink } from "lucide-react";
import AuthPromptModal from "@/components/common/AuthPromptModal";
import {
  API_BASE,
  ensureAuthSession,
  fetchWithAuthRetry,
} from "@/lib/auth-client";
import { requestDownloadLink, triggerURLDownload } from "@/lib/download-client";
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

function resolveFavoriteEmojiError(status: number, code: string, fallback: string) {
  if (status === 403) {
    if (code === "user_disabled") return "账号状态异常，暂时无法操作";
    if (code === "subscription_required") return "当前账号暂无该权限，请先开通订阅";
    return "暂无权限，请稍后再试";
  }
  if (status === 404) return "目标表情不存在或已下架";
  if (status === 429) return "操作过于频繁，请稍后重试";
  if (status >= 500) return "服务繁忙，请稍后重试";
  return fallback;
}

function resolveDownloadError(status: number, code: string, fallback: string) {
  if (status === 403) {
    if (code === "user_disabled") return "账号状态异常，暂时无法下载";
    if (code === "subscription_required") return "下载需要订阅权限，请先开通订阅";
    return "暂无下载权限";
  }
  if (status === 404) return "表情不存在或已下架";
  if (status === 429) return "下载过于频繁，请稍后重试";
  if (status >= 500) return "下载服务繁忙，请稍后重试";
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
    router.push(`/login?next=${encodeURIComponent("/mine/favorites/emojis")}`);
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
        const res = await fetchWithAuthRetry(`${API_BASE}/favorites?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.status === 401) {
          setErrorMessage(null);
          setAuthPromptMessage("请先登录后查看收藏");
          return;
        }
        if (!res.ok) {
          const apiErr = await parseApiError(res);
          setErrorMessage(apiErr.message || resolveFavoriteEmojiError(res.status, apiErr.code, "加载收藏表情失败，请稍后重试"));
          return;
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
    if (!(await ensureAuthenticated("请先登录再继续下载"))) return;
    setDownloadingEmoji(emojiId);
    setErrorMessage(null);
    try {
      const result = await requestDownloadLink(`${API_BASE}/emojis/${emojiId}/download`);
      if (!result.ok) {
        if (result.error.status === 401) {
          openAuthPrompt("请先登录再继续下载");
          return;
        }
        setErrorMessage(
          result.error.message ||
            resolveDownloadError(result.error.status, result.error.code, "下载失败，请稍后重试")
        );
        return;
      }
      triggerURLDownload(result.data.url, result.data.name || `emoji-${emojiId}`);
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
    if (!(await ensureAuthenticated("请先登录再继续收藏"))) return;
    setRemovingEmoji(emojiId);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/favorites/${emojiId}`, {
        method: "DELETE",
      });
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续收藏");
        return;
      }
      if (!res.ok) {
        const apiErr = await parseApiError(res);
        setErrorMessage(apiErr.message || resolveFavoriteEmojiError(res.status, apiErr.code, "取消收藏失败，请稍后重试"));
        return;
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
    <div className="mx-auto max-w-6xl space-y-8">
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
            FAVORITE EMOJIS
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">我的收藏 · 表情</h1>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-400 ring-1 ring-slate-100">
          <Heart size={16} className="text-rose-500" />
          共 {total} 张收藏表情
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
            <Heart size={40} />
          </div>
          <h3 className="text-lg font-black text-slate-900">暂无收藏表情</h3>
          <p className="mt-2 text-sm font-medium text-slate-400">去首页发现更多有趣的表情吧</p>
          <Link href="/" className="mt-8 rounded-2xl bg-slate-900 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0">
            立即去探索
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((record) => {
          const emoji = record.emoji;
          const preview = emoji.preview_url || emoji.file_url || "";
          const formatLabel = getEmojiFormatLabel(record);
          return (
            <div
              key={`${record.emoji_id}-${record.created_at}`}
              className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-3 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-emerald-100 hover:shadow-2xl hover:shadow-emerald-500/10"
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-50">
                {preview ? (
                  <FallbackImage url={preview} alt={emoji.title || `emoji-${emoji.id}`} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-200">
                    <FolderHeart size={32} />
                  </div>
                )}
                
                {/* 格式标签 */}
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-slate-900/80 px-2 py-1 text-[9px] font-black text-white backdrop-blur-md">
                  <FileType size={10} />
                  {formatLabel}
                </div>

                {/* 取消收藏按钮 */}
                <div className="absolute right-2 top-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleRemoveFavorite(emoji.id)}
                    disabled={removingEmoji === emoji.id}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-rose-500 shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-white active:scale-95 disabled:opacity-60"
                  >
                    {removingEmoji === emoji.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Heart size={14} className="fill-current" />
                    )}
                  </button>
                </div>

                {/* 悬停时的渐变遮罩 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>

              <div className="mt-4 flex flex-1 flex-col space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <HardDrive size={10} className="text-slate-300" />
                    {getEmojiSizeLabel(emoji.size_bytes)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadEmoji(emoji.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-black transition-all ${
                      downloadedEmoji === emoji.id
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-900 hover:text-white hover:shadow-lg hover:shadow-slate-200"
                    } disabled:opacity-60`}
                    disabled={downloadingEmoji === emoji.id}
                  >
                    {downloadingEmoji === emoji.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : downloadedEmoji === emoji.id ? (
                      <>
                        <Check size={14} />
                        已下载
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        下载
                      </>
                    )}
                  </button>
                </div>

                <Link
                  href={`/collections/${emoji.collection_id}`}
                  className="flex items-center justify-center gap-1 rounded-xl border border-slate-100 bg-slate-50/50 py-2 text-[10px] font-bold text-slate-500 transition-all hover:bg-white hover:border-emerald-100 hover:text-emerald-600"
                >
                  <ExternalLink size={10} />
                  查看合集
                </Link>
              </div>
            </div>
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
                加载更多表情
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
