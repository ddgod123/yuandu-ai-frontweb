"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Check, Download, Heart, Loader2, ThumbsUp, Layers, Info, Bookmark, ChevronDown } from "lucide-react";
import { API_BASE, emitAuthChange, ensureAuthSession, fetchWithAuthRetry } from "@/lib/auth-client";
import { requestDownloadLink, triggerURLDownload } from "@/lib/download-client";
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

function buildCollectionZipName(title?: string | null, collectionId?: number) {
  const raw = (title || "").trim();
  const sanitized = raw.replace(/[\\/:*?"<>|]/g, "_").trim();
  const base = sanitized || `collection-${collectionId || "download"}`;
  return `${base}.zip`;
}

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

function resolveActionNotice(status: number, code: string, fallback: string, actionLabel: string) {
  if (status === 403) {
    if (code === "user_disabled") return "账号状态异常，暂时无法操作";
    if (code === "subscription_required") return `${actionLabel}需要订阅权限，请先开通订阅`;
    return "暂无权限，请稍后再试";
  }
  if (status === 404) return "目标内容不存在或已下架";
  if (status === 429) return `${actionLabel}过于频繁，请稍后重试`;
  if (status >= 500) return "服务繁忙，请稍后重试";
  return fallback;
}

function resolveDownloadNotice(status: number, code: string, fallback: string, targetLabel: string) {
  if (status === 403) {
    if (code === "user_disabled") return "账号状态异常，暂时无法下载";
    if (code === "subscription_required") return `${targetLabel}需要订阅权限，请到个人中心开通`;
    if (code === "subscription_or_entitlement_required" || code === "collection_download_entitlement_required") {
      return `${targetLabel}需要订阅或次卡权益，请前往「我的订阅」兑换次卡`;
    }
    if (code === "collection_download_entitlement_exhausted") return "该合集次卡次数已用尽，请重新兑换";
    if (code === "collection_download_entitlement_expired") return "该合集次卡已过期，请重新兑换";
    if (code === "collection_download_entitlement_disabled") return "该合集次卡已被停用，请联系运营";
    return "暂无下载权限";
  }
  if (status === 404) return "资源不存在或已下架";
  if (status === 429) return "下载过于频繁，请稍后重试";
  if (status >= 500) return "下载服务繁忙，请稍后重试";
  return fallback;
}

function buildImageCandidates(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];
  const proxyCandidate = buildStorageProxyCandidate(trimmed);
  // 非图片后缀直接跳过，避免 .ds_store、txt 等导致 404；但允许 proxy 兜底
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

  const ensureAuthenticated = async (message: string) => {
    if (await ensureAuthSession()) return true;
    openAuthPrompt(message);
    return false;
  };

  const handleDownloadZip = async (zipKey?: string) => {
    if (!collectionId || downloadingZip) return;
    if (!(await ensureAuthenticated("请先登录再继续下载"))) return;
    setNotice(null);
    setDownloadingZip(true);
    try {
      const params = new URLSearchParams();
      if (zipKey) {
        params.set("zip_key", zipKey);
      }
      const endpoint = params.toString()
        ? `${API_BASE}/collections/${collectionId}/download-zip?${params.toString()}`
        : `${API_BASE}/collections/${collectionId}/download-zip`;
      const result = await requestDownloadLink(endpoint);
      if (!result.ok) {
        if (result.error.status === 401) {
          openAuthPrompt("请先登录再继续下载");
          return;
        }
        setNotice(
          result.error.message ||
            resolveDownloadNotice(result.error.status, result.error.code, "下载失败，请稍后重试", "下载合集")
        );
        return;
      }
      triggerURLDownload(result.data.url, result.data.name || buildCollectionZipName(collection?.title, collectionId));
      bumpCollectionDownloadCount();
    } catch {
      setNotice("下载失败，请稍后重试");
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadAllZips = async () => {
    if (!collectionId || downloadingZip || zipItems.length === 0) return;
    if (!(await ensureAuthenticated("请先登录再继续下载"))) return;
    setNotice(null);
    setDownloadingZip(true);
    setDownloadingAllZipBundle(true);
    try {
      const result = await requestDownloadLink(`${API_BASE}/collections/${collectionId}/download-zip-all`);
      if (!result.ok) {
        if (result.error.status === 401) {
          openAuthPrompt("请先登录再继续下载");
          return;
        }
        setNotice(
          result.error.message ||
            resolveDownloadNotice(result.error.status, result.error.code, "下载失败，请稍后重试", "下载合集")
        );
        return;
      }
      const fileName = buildCollectionZipName(collection?.title, collectionId);
      triggerURLDownload(result.data.url, result.data.name || fileName);
      bumpCollectionDownloadCount();
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
      void handleDownloadZip(zipItems[0]?.key);
      return;
    }
    void handleDownloadAllZips();
  };

  const handleDownloadEmoji = async (emojiId: number) => {
    if (!emojiId || downloadingEmoji) return;
    if (!(await ensureAuthenticated("请先登录再继续下载"))) return;
    setNotice(null);
    setDownloadingEmoji(emojiId);
    try {
      const result = await requestDownloadLink(`${API_BASE}/emojis/${emojiId}/download`);
      if (!result.ok) {
        if (result.error.status === 401) {
          openAuthPrompt("请先登录再继续下载");
          return;
        }
        setNotice(
          result.error.message ||
            resolveDownloadNotice(result.error.status, result.error.code, "下载失败，请稍后重试", "下载表情")
        );
        return;
      }
      triggerURLDownload(result.data.url, result.data.name || `emoji-${emojiId}`);
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
    if (!(await ensureAuthenticated("请先登录再继续收藏"))) return;
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
        const apiErr = await parseApiError(res);
        setNotice(apiErr.message || resolveActionNotice(res.status, apiErr.code, "收藏操作失败，请稍后重试", "收藏"));
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
    emitAuthChange();
  };

  const toggleCollectionLike = async () => {
    if (!collectionId || togglingLike || !collection) return;
    if (!(await ensureAuthenticated("请先登录再继续点赞"))) return;
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
        const apiErr = await parseApiError(res);
        setNotice(apiErr.message || resolveActionNotice(res.status, apiErr.code, "点赞失败，请稍后重试", "点赞"));
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
      setNotice("点赞失败，请稍后重试");
    } finally {
      setTogglingLike(false);
    }
  };

  const toggleCollectionFavorite = async () => {
    if (!collectionId || togglingFavorite || !collection) return;
    if (!(await ensureAuthenticated("请先登录再继续收藏"))) return;
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
        const apiErr = await parseApiError(res);
        setNotice(apiErr.message || resolveActionNotice(res.status, apiErr.code, "收藏失败，请稍后重试", "收藏"));
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
      setNotice("收藏失败，请稍后重试");
    } finally {
      setTogglingFavorite(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/30">
      {downloadingAllZipBundle ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]">
          <div className="flex w-[320px] max-w-[90vw] flex-col items-center rounded-[2rem] bg-white px-8 py-7 shadow-2xl">
            <Loader2 size={30} className="animate-spin text-emerald-600" />
            <div className="mt-4 text-base font-black text-slate-900">正在打包中...</div>
            <p className="mt-2 text-center text-xs font-semibold text-slate-500">
              正在准备您的合集 ZIP，请稍候
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

      {/* Sticky Header */}
      <div className="sticky top-16 z-40 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/categories"
              className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-emerald-200 hover:text-emerald-500 hover:shadow-md"
            >
              <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Layers size={12} />
                合集详情
              </div>
              <h1 className="text-xl font-black text-slate-900 line-clamp-1">
                {collection?.title || (loadingDetail ? "加载中..." : "未找到合集")}
              </h1>
            </div>
          </div>
          <button
            onClick={handleZipButtonClick}
            className="group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 active:scale-95 disabled:opacity-60"
            disabled={downloadingZip || loadingZips || !collectionId}
          >
            <Download size={16} className="relative z-10" />
            <span className="relative z-10">
              {loadingZips
                ? "加载中..."
                : downloadingZip
                ? "生成中..."
                : zipItems.length > 1
                ? "下载全部 ZIP"
                : "下载合集 ZIP"}
            </span>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* 背景装饰 */}
        <div className="fixed right-0 top-0 -z-10 h-[500px] w-[500px] -translate-y-1/4 translate-x-1/4 rounded-full bg-emerald-50/30 blur-[100px]" />
        <div className="fixed bottom-0 left-0 -z-10 h-[500px] w-[500px] translate-y-1/4 -translate-x-1/4 rounded-full bg-blue-50/30 blur-[100px]" />

        {notice ? (
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700 animate-in fade-in slide-in-from-top-2">
            <Info size={18} />
            {notice}
          </div>
        ) : null}

        {/* 统计与交互区 */}
        <div className="mb-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-slate-400">
              本合集共收录 <span className="text-slate-900 font-black">{(collection?.file_count || total).toLocaleString()}</span> 张表情
            </h2>
            <div className="h-1 w-12 rounded-full bg-emerald-500" />
          </div>

          <div className="flex items-center gap-6 self-center md:self-end">
            {/* 点赞 */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleCollectionLike}
                disabled={togglingLike}
                className={`group flex h-16 w-16 items-center justify-center rounded-[1.5rem] shadow-lg transition-all active:scale-90 ${
                  collection?.liked
                    ? "bg-emerald-500 text-white shadow-emerald-200"
                    : "bg-white text-slate-400 border border-slate-100 hover:border-emerald-200 hover:text-emerald-500"
                } disabled:opacity-70`}
              >
                <ThumbsUp size={24} className={collection?.liked ? "fill-current" : ""} />
              </button>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">点赞</span>
              <span className="text-sm font-black text-slate-900">{collection?.like_count || 0}</span>
            </div>

            {/* 收藏 */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleCollectionFavorite}
                disabled={togglingFavorite}
                className={`group flex h-16 w-16 items-center justify-center rounded-[1.5rem] shadow-lg transition-all active:scale-90 ${
                  collection?.favorited
                    ? "bg-amber-500 text-white shadow-amber-200"
                    : "bg-white text-slate-400 border border-slate-100 hover:border-amber-200 hover:text-amber-500"
                } disabled:opacity-70`}
              >
                <Bookmark size={24} className={collection?.favorited ? "fill-current" : ""} />
              </button>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">收藏</span>
              <span className="text-sm font-black text-slate-900">{collection?.favorite_count || 0}</span>
            </div>

            {/* 下载数展示 */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-slate-50 text-slate-300 border border-slate-100">
                <Download size={24} />
              </div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">总下载</span>
              <span className="text-sm font-black text-slate-900">{collection?.download_count || 0}</span>
            </div>
          </div>
        </div>

        {/* 表情列表 */}
        <div className="space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              单张表情下载
              <span className="text-xs font-bold text-slate-300">/ Single Download</span>
            </h3>
            <div className="rounded-lg bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-400">
              已展示 {emojis.length} / {total}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {emojis.map((emoji) => {
              const preview = emoji.preview_url || emoji.file_url || "";
              const formatLabel = getEmojiFormatLabel(emoji);
              const isDownloaded = downloadedEmoji === emoji.id;
              
              return (
                <div
                  key={emoji.id}
                  className="group relative flex flex-col rounded-[2rem] border border-slate-100 bg-white p-3 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-15px_rgba(15,23,42,0.1)]"
                >
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-50">
                    {preview ? <FallbackImage url={preview} alt={emoji.title} /> : null}
                    <div className="absolute left-2 top-2 rounded-lg bg-black/50 px-2 py-1 text-[9px] font-black text-white backdrop-blur-md">
                      {formatLabel}
                    </div>
                    
                    {/* 悬浮遮罩 */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-slate-400">
                        {getEmojiSizeLabel(emoji.size_bytes)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleEmojiFavorite(emoji)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                          emoji.favorited
                            ? "bg-rose-50 text-rose-500"
                            : "text-slate-300 hover:bg-slate-50 hover:text-rose-400"
                        }`}
                        disabled={togglingEmojiFavorite === emoji.id}
                      >
                        {togglingEmojiFavorite === emoji.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Heart size={14} className={emoji.favorited ? "fill-current" : ""} />
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => handleDownloadEmoji(emoji.id)}
                      className={`flex h-9 w-full items-center justify-center gap-2 rounded-xl text-[11px] font-bold transition-all ${
                        isDownloaded
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-900 hover:text-white hover:shadow-lg hover:shadow-slate-200"
                      } disabled:opacity-60`}
                      disabled={downloadingEmoji === emoji.id}
                    >
                      {downloadingEmoji === emoji.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : isDownloaded ? (
                        <>
                          <Check size={14} />
                          已保存
                        </>
                      ) : (
                        <>
                          <Download size={14} />
                          下载
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {canLoadMore ? (
            <div className="mt-16 flex justify-center">
              <button
                onClick={() => setPage((prev) => prev + 1)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-10 py-4 text-sm font-bold text-slate-600 shadow-sm transition-all hover:border-emerald-200 hover:text-emerald-600 hover:shadow-md active:scale-95"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>加载更多表情</span>
                    <ChevronDown size={18} className="transition-transform group-hover:translate-y-0.5" />
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="h-20" />
    </div>
  );
}
