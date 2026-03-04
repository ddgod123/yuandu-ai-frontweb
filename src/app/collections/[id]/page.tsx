"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Check, Download, Heart, Loader2, ThumbsUp } from "lucide-react";
import { API_BASE, fetchWithAuth, fetchWithAuthRetry, hasValidAccessToken } from "@/lib/auth-client";
import AuthPromptModal from "@/components/common/AuthPromptModal";
const PAGE_SIZE = 60;

type TagBrief = {
  id: number;
  name: string;
  slug?: string;
};

type ApiCollection = {
  id: number;
  title: string;
  description?: string;
  cover_url?: string;
  file_count?: number;
  download_code?: string;
  favorite_count?: number;
  like_count?: number;
  download_count?: number;
  favorited?: boolean;
  liked?: boolean;
  tags?: TagBrief[];
};

type ZipItem = {
  id: number;
  key: string;
  name: string;
  size_bytes?: number;
  uploaded_at?: string;
};

type ApiEmoji = {
  id: number;
  title: string;
  preview_url?: string;
  file_url?: string;
  format?: string;
  size_bytes?: number;
  favorited?: boolean;
};

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;

function isImageFile(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return IMAGE_EXT_REGEX.test(clean);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectURL = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectURL);
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

function buildCollectionZipName(title?: string | null, collectionId?: number) {
  const raw = (title || "").trim();
  const sanitized = raw.replace(/[\\/:*?"<>|]/g, "_").trim();
  const base = sanitized || `collection-${collectionId || "download"}`;
  return `${base}.zip`;
}

function buildImageCandidates(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];

  // 非图片后缀直接跳过，避免 .ds_store、txt 等导致 404
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
    if (origin) {
      add(`${origin}${trimmed}`);
    } else {
      add(trimmed);
    }
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

function getEmojiFormatLabel(emoji: ApiEmoji) {
  const raw = (emoji.format || "").trim();
  if (raw) {
    const normalized = raw.includes("/") ? raw.split("/").pop() || raw : raw;
    const clean = normalized.replace(/^x-/, "").replace(/^image\//, "").trim();
    if (clean) {
      return clean.toUpperCase();
    }
  }
  const source = (emoji.file_url || emoji.preview_url || "").split("?")[0].split("#")[0];
  const ext = source.includes(".") ? source.split(".").pop() || "" : "";
  return ext ? ext.toUpperCase() : "IMG";
}

function getEmojiSizeLabel(sizeBytes?: number) {
  if (!sizeBytes || sizeBytes <= 0) return "大小未知";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id;
  const collectionId = Number(Array.isArray(idParam) ? idParam[0] : idParam);

  const [collection, setCollection] = useState<ApiCollection | null>(null);
  const [emojis, setEmojis] = useState<ApiEmoji[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingAllZipBundle, setDownloadingAllZipBundle] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [downloadingEmoji, setDownloadingEmoji] = useState<number | null>(null);
  const [togglingEmojiFavorite, setTogglingEmojiFavorite] = useState<number | null>(null);
  const [downloadedEmoji, setDownloadedEmoji] = useState<number | null>(null);
  const [zipItems, setZipItems] = useState<ZipItem[]>([]);
  const [loadingZips, setLoadingZips] = useState(false);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!collectionId) return;
    const controller = new AbortController();

    const loadDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/collections/${collectionId}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ApiCollection;
        setCollection(data);
      } catch {
        if (controller.signal.aborted) return;
      } finally {
        if (!controller.signal.aborted) {
          setLoadingDetail(false);
        }
      }
    };

    loadDetail();

    return () => {
      controller.abort();
    };
  }, [collectionId]);

  useEffect(() => {
    if (!collectionId) return;
    const controller = new AbortController();

    const loadZips = async () => {
      setLoadingZips(true);
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/collections/${collectionId}/zips`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as { items?: ZipItem[] };
        setZipItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (controller.signal.aborted) return;
      } finally {
        if (!controller.signal.aborted) {
          setLoadingZips(false);
        }
      }
    };

    loadZips();

    return () => {
      controller.abort();
    };
  }, [collectionId]);

  useEffect(() => {
    if (!collectionId) return;
    const controller = new AbortController();

    const loadEmojis = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          collection_id: String(collectionId),
          page: String(page),
          page_size: String(PAGE_SIZE),
        });
        const res = await fetchWithAuthRetry(`${API_BASE}/emojis?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          return;
        }
        const payload = (await res.json()) as { items?: ApiEmoji[]; total?: number };
        const items = Array.isArray(payload.items) ? payload.items : [];
        const totalCount = typeof payload.total === "number" ? payload.total : items.length;

        setTotal(totalCount);
        setEmojis((prev) => (page === 1 ? items : [...prev, ...items]));
      } catch {
        if (controller.signal.aborted) return;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadEmojis();

    return () => {
      controller.abort();
    };
  }, [collectionId, page]);

  const canLoadMore = emojis.length < total;

  const openAuthPrompt = (message: string) => {
    setAuthPromptMessage(message);
  };

  const closeAuthPrompt = () => {
    setAuthPromptMessage(null);
  };

  const handleGoLogin = () => {
    const nextPath = collectionId ? `/collections/${collectionId}` : "/";
    setAuthPromptMessage(null);
    router.push(`/login?next=${encodeURIComponent(nextPath)}`);
  };

  const ensureAuthenticated = (message: string) => {
    if (hasValidAccessToken()) return true;
    openAuthPrompt(message);
    return false;
  };

  const handleDownloadZip = async (zipKey?: string) => {
    if (!collectionId || downloadingZip) return;
    if (!ensureAuthenticated("请先登录再继续下载")) return;
    setNotice(null);
    setDownloadingZip(true);
    try {
      const params = new URLSearchParams();
      if (zipKey) {
        params.set("zip_key", zipKey);
      }
      const url = params.toString()
        ? `${API_BASE}/collections/${collectionId}/download-zip?${params.toString()}`
        : `${API_BASE}/collections/${collectionId}/download-zip`;
      const res = await fetchWithAuth(url);
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续下载");
        return;
      }
      if (res.status === 403) {
        setNotice("暂无下载权限");
        return;
      }
      if (!res.ok) {
        setNotice("下载失败，请稍后重试");
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data?.url) {
        window.open(data.url, "_blank");
        bumpCollectionDownloadCount();
      } else {
        setNotice("下载链接不可用");
      }
    } catch {
      setNotice("下载失败，请稍后重试");
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadAllZips = async () => {
    if (!collectionId || downloadingZip || zipItems.length === 0) return;
    if (!ensureAuthenticated("请先登录再继续下载")) return;
    setNotice(null);
    setDownloadingZip(true);
    setDownloadingAllZipBundle(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/collections/${collectionId}/download-zip-all`);
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续下载");
        return;
      }
      if (res.status === 403) {
        setNotice("暂无下载权限");
        return;
      }
      if (!res.ok) {
        setNotice("下载失败，请稍后重试");
        return;
      }

      const blob = await res.blob();
      const fileName = buildCollectionZipName(collection?.title, collectionId);
      triggerBlobDownload(blob, fileName);
      bumpCollectionDownloadCount();
      setNotice("已下载打包文件");
    } catch {
      setNotice("下载失败，请稍后重试");
    } finally {
      setDownloadingZip(false);
      setDownloadingAllZipBundle(false);
    }
  };

  const handleZipButtonClick = () => {
    if (loadingZips) return;
    if (zipItems.length <= 1) {
      handleDownloadZip(zipItems[0]?.key);
      return;
    }
    handleDownloadAllZips();
  };

  const handleDownloadEmoji = async (emojiId: number) => {
    if (!emojiId || downloadingEmoji) return;
    if (!ensureAuthenticated("请先登录再继续下载")) return;
    setNotice(null);
    setDownloadingEmoji(emojiId);
    try {
      const res = await fetchWithAuth(`${API_BASE}/emojis/${emojiId}/download-file`);
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续下载");
        return;
      }
      if (res.status === 403) {
        setNotice("暂无下载权限");
        return;
      }
      if (!res.ok) {
        setNotice("下载失败，请稍后重试");
        return;
      }
      const blob = await res.blob();
      const fileName = parseDownloadFileName(
        res.headers.get("Content-Disposition"),
        `emoji-${emojiId}`
      );
      triggerBlobDownload(blob, fileName);
      setDownloadedEmoji(emojiId);
      window.setTimeout(() => {
        setDownloadedEmoji((prev) => (prev === emojiId ? null : prev));
      }, 1600);
    } catch {
      setNotice("下载失败，请稍后重试");
    } finally {
      setDownloadingEmoji(null);
    }
  };

  const toggleEmojiFavorite = async (emoji: ApiEmoji) => {
    if (!emoji?.id || togglingEmojiFavorite === emoji.id) return;
    if (!ensureAuthenticated("请先登录再继续收藏")) return;
    setNotice(null);
    setTogglingEmojiFavorite(emoji.id);
    try {
      const isRemoving = Boolean(emoji.favorited);
      const url = isRemoving
        ? `${API_BASE}/favorites/${emoji.id}`
        : `${API_BASE}/favorites`;
      const res = await fetchWithAuthRetry(url, {
        method: isRemoving ? "DELETE" : "POST",
        headers: isRemoving ? undefined : { "Content-Type": "application/json" },
        body: isRemoving ? undefined : JSON.stringify({ emoji_id: emoji.id }),
      });
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续收藏");
        return;
      }
      if (!res.ok) {
        setNotice("收藏操作失败，请稍后重试");
        return;
      }
      setEmojis((prev) =>
        prev.map((item) =>
          item.id === emoji.id
            ? {
                ...item,
                favorited: !isRemoving,
              }
            : item
        )
      );
    } catch {
      setNotice("收藏操作失败，请稍后重试");
    } finally {
      setTogglingEmojiFavorite(null);
    }
  };

  const updateCollectionActionSummary = (payload: {
    like_count?: number;
    favorite_count?: number;
    download_count?: number;
    liked?: boolean;
    favorited?: boolean;
  }) => {
    setCollection((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        like_count:
          typeof payload.like_count === "number" ? payload.like_count : prev.like_count,
        favorite_count:
          typeof payload.favorite_count === "number" ? payload.favorite_count : prev.favorite_count,
        download_count:
          typeof payload.download_count === "number" ? payload.download_count : prev.download_count,
        liked: typeof payload.liked === "boolean" ? payload.liked : prev.liked,
        favorited: typeof payload.favorited === "boolean" ? payload.favorited : prev.favorited,
      };
    });
  };

  const bumpCollectionDownloadCount = () => {
    setCollection((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        download_count: (prev.download_count || 0) + 1,
      };
    });
  };

  const toggleCollectionLike = async () => {
    if (!collectionId || togglingLike || !collection) return;
    if (!ensureAuthenticated("请先登录再继续点赞")) return;
    setNotice(null);
    setTogglingLike(true);
    try {
      const method = collection.liked ? "DELETE" : "POST";
      const res = await fetchWithAuthRetry(`${API_BASE}/collections/${collectionId}/like`, {
        method,
      });
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续点赞");
        return;
      }
      if (!res.ok) {
        setNotice("操作失败，请稍后重试");
        return;
      }
      const data = (await res.json()) as {
        like_count?: number;
        favorite_count?: number;
        download_count?: number;
        liked?: boolean;
        favorited?: boolean;
      };
      updateCollectionActionSummary(data);
    } catch {
      setNotice("操作失败，请稍后重试");
    } finally {
      setTogglingLike(false);
    }
  };

  const toggleCollectionFavorite = async () => {
    if (!collectionId || togglingFavorite || !collection) return;
    if (!ensureAuthenticated("请先登录再继续收藏")) return;
    setNotice(null);
    setTogglingFavorite(true);
    try {
      const method = collection.favorited ? "DELETE" : "POST";
      const res = await fetchWithAuthRetry(`${API_BASE}/collections/${collectionId}/favorite`, {
        method,
      });
      if (res.status === 401) {
        openAuthPrompt("请先登录再继续收藏");
        return;
      }
      if (!res.ok) {
        setNotice("操作失败，请稍后重试");
        return;
      }
      const data = (await res.json()) as {
        like_count?: number;
        favorite_count?: number;
        download_count?: number;
        liked?: boolean;
        favorited?: boolean;
      };
      updateCollectionActionSummary(data);
    } catch {
      setNotice("操作失败，请稍后重试");
    } finally {
      setTogglingFavorite(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {downloadingAllZipBundle ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]">
          <div className="flex w-[320px] max-w-[90vw] flex-col items-center rounded-2xl bg-white px-8 py-7 shadow-2xl">
            <Loader2 size={30} className="animate-spin text-emerald-600" />
            <div className="mt-4 text-base font-black text-slate-900">正在下载中...</div>
            <p className="mt-2 text-center text-xs font-semibold text-slate-500">
              正在打包并下载合集 ZIP，请稍候
            </p>
          </div>
        </div>
      ) : null}

      <AuthPromptModal
        open={Boolean(authPromptMessage)}
        message={authPromptMessage || ""}
        onClose={closeAuthPrompt}
        onLogin={handleGoLogin}
      />

      <div className="border-b border-slate-100 bg-white/90 backdrop-blur-xl sticky top-16 z-40">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/categories"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase">合集详情</div>
              <h1 className="text-xl font-black text-slate-900">
                {collection?.title || (loadingDetail ? "加载中..." : "未找到合集")}
              </h1>
            </div>
          </div>
          <button
            onClick={handleZipButtonClick}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-600 transition-colors disabled:opacity-60"
            disabled={downloadingZip || loadingZips || !collectionId}
          >
            <Download size={16} />
            {loadingZips
              ? "加载中..."
              : downloadingZip
              ? "生成中..."
              : zipItems.length > 1
              ? "下载全部 ZIP"
              : "下载合集 ZIP"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {notice ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            {notice}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="text-sm font-semibold text-slate-500">
            共 {collection?.file_count || total} 张表情
          </div>
          <div className="flex flex-wrap items-center justify-center gap-10">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleCollectionLike}
                disabled={togglingLike}
                className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition ${
                  collection?.liked
                    ? "bg-gradient-to-br from-emerald-500 to-teal-500"
                    : "bg-gradient-to-br from-cyan-400 to-blue-500"
                } disabled:opacity-70`}
              >
                <ThumbsUp size={20} />
              </button>
              <div className="text-xs font-semibold text-slate-500">点赞</div>
              <div className="text-sm font-black text-slate-900">{collection?.like_count || 0}</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleCollectionFavorite}
                disabled={togglingFavorite}
                className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition ${
                  collection?.favorited
                    ? "bg-gradient-to-br from-rose-500 to-pink-500"
                    : "bg-gradient-to-br from-cyan-400 to-blue-500"
                } disabled:opacity-70`}
              >
                <Heart size={20} />
              </button>
              <div className="text-xs font-semibold text-slate-500">收藏</div>
              <div className="text-sm font-black text-slate-900">{collection?.favorite_count || 0}</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleZipButtonClick}
                disabled={downloadingZip || loadingZips || !collectionId}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg disabled:opacity-70"
              >
                <Download size={20} />
              </button>
              <div className="text-xs font-semibold text-slate-500">下载</div>
              <div className="text-sm font-black text-slate-900">{collection?.download_count || 0}</div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900">单张表情下载</h2>
            <div className="text-xs font-semibold text-slate-400">已展示 {emojis.length} / {total}</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {emojis.map((emoji) => {
              const preview = emoji.preview_url || emoji.file_url || "";
              const formatLabel = getEmojiFormatLabel(emoji);
              return (
                <div
                  key={emoji.id}
                  className="group rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-50">
                    {preview ? <FallbackImage url={preview} alt={emoji.title} /> : null}
                    <div className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-black text-white">
                      {formatLabel}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-slate-400">
                      {getEmojiSizeLabel(emoji.size_bytes)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleEmojiFavorite(emoji)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                          emoji.favorited
                            ? "border-rose-200 bg-rose-50 text-rose-500"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                        disabled={togglingEmojiFavorite === emoji.id}
                        aria-label={emoji.favorited ? "取消收藏" : "收藏"}
                      >
                        {togglingEmojiFavorite === emoji.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Heart size={14} className={emoji.favorited ? "fill-current" : ""} />
                        )}
                      </button>
                      <button
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
                  </div>
                </div>
              );
            })}
          </div>

          {canLoadMore ? (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setPage((prev) => prev + 1)}
                className="rounded-full border border-slate-200 px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                disabled={loading}
              >
                {loading ? "加载中..." : "加载更多"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="h-20" />
    </div>
  );
}
