"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Check, Download, Heart, Loader2, ThumbsUp, Layers, Info, Bookmark, ChevronDown, Eye } from "lucide-react";
import { API_BASE, emitAuthChange, ensureAuthSession, fetchWithAuthRetry } from "@/lib/auth-client";
import { emitBehaviorEvent } from "@/lib/behavior-events";
import { requestDownloadLink, triggerURLDownload } from "@/lib/download-client";
import AuthPromptModal from "@/components/common/AuthPromptModal";
import {
  ApiEmoji,
  useCollectionDetailData,
} from "@/hooks/useCollectionDetailData";
const PAGE_SIZE = 30;

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

function parseDownloadFilenameFromHeader(contentDisposition?: string | null) {
  const raw = String(contentDisposition || "").trim();
  if (!raw) return "";

  const utf8Match = raw.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }

  const plainMatch = raw.match(/filename\s*=\s*\"?([^\";]+)\"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }
  return "";
}

function inferEmojiDownloadExt(emoji?: ApiEmoji | null) {
  const format = String(emoji?.format || "")
    .trim()
    .toLowerCase()
    .replace(/^image\//, "");
  if (format === "jpeg") return "jpg";
  if (format) return format;

  const source = String(emoji?.file_url || emoji?.preview_url || "")
    .split("?")[0]
    .split("#")[0];
  const ext = source.includes(".") ? source.split(".").pop() || "" : "";
  return ext ? ext.toLowerCase() : "png";
}

function sanitizeDownloadStem(raw: string) {
  return (
    (raw || "")
      .trim()
      .replace(/[\\/:*?"<>|\s]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80) || "emoji"
  );
}

function buildEmojiDownloadName(emoji?: ApiEmoji | null, preferredName = "") {
  const ext = inferEmojiDownloadExt(emoji);
  const base = (preferredName || emoji?.title || `emoji-${emoji?.id || "download"}`).trim();
  if (!base) return `emoji.${ext}`;
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return sanitizeDownloadStem(base.replace(/\.[a-z0-9]{2,5}$/i, "")) + base.match(/\.[a-z0-9]{2,5}$/i)?.[0];
  return `${sanitizeDownloadStem(base)}.${ext}`;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  if (!blob || blob.size <= 0) return;
  const objectURL = URL.createObjectURL(blob);
  triggerURLDownload(objectURL, fileName);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectURL);
  }, 1800);
}

function FallbackImage({ url, alt }: { url: string; alt: string }) {
  const candidates = useMemo(() => buildImageCandidates(url), [url]);
  const [index, setIndex] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState("");
  const src = candidates[index];
  const showSkeleton = loadedSrc !== src;

  if (!src) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-100">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100" />
      </div>
    );
  }

  return (
    <>
      {showSkeleton ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100" />
      ) : null}
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className="absolute inset-0 h-full w-full object-cover"
        onLoad={() => setLoadedSrc(src)}
        onError={() => {
          setLoadedSrc("");
          setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
        }}
      />
    </>
  );
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id;
  const collectionId = Number(Array.isArray(idParam) ? idParam[0] : idParam);

  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingAllZipBundle, setDownloadingAllZipBundle] = useState(false);
  const [togglingLike, setTogglingLike] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [downloadingEmoji, setDownloadingEmoji] = useState<number | null>(null);
  const [togglingEmojiFavorite, setTogglingEmojiFavorite] = useState<number | null>(null);
  const [downloadedEmoji, setDownloadedEmoji] = useState<number | null>(null);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);

  const {
    collection,
    setCollection,
    emojis,
    setEmojis,
    total,
    loading,
    loadingDetail,
    zipItems,
    loadingZips,
  } = useCollectionDetailData(collectionId, page, PAGE_SIZE);

  useEffect(() => {
    if (!collectionId) return;
    emitBehaviorEvent("page_view_collection_detail", {
      collection_id: collectionId,
      metadata: {
        page: "collection_detail",
      },
    });
  }, [collectionId]);

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
    if (!(await ensureAuthenticated("请先登录再继续下载"))) {
      emitBehaviorEvent("collection_zip_download", {
        collection_id: collectionId,
        success: false,
        error_code: "unauthorized",
        metadata: {
          mode: zipKey ? "single_zip" : "latest_zip",
        },
      });
      return;
    }
    emitBehaviorEvent("collection_zip_download", {
      collection_id: collectionId,
      metadata: {
        mode: zipKey ? "single_zip" : "latest_zip",
      },
    });
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
          emitBehaviorEvent("collection_zip_download", {
            collection_id: collectionId,
            success: false,
            error_code: "unauthorized",
            metadata: {
              mode: zipKey ? "single_zip" : "latest_zip",
            },
          });
          openAuthPrompt("请先登录再继续下载");
          return;
        }
        emitBehaviorEvent("collection_zip_download", {
          collection_id: collectionId,
          success: false,
          error_code: result.error.code || `http_${result.error.status}`,
          metadata: {
            mode: zipKey ? "single_zip" : "latest_zip",
          },
        });
        setNotice(
          result.error.message ||
            resolveDownloadNotice(result.error.status, result.error.code, "下载失败，请稍后重试", "下载合集")
        );
        return;
      }
      triggerURLDownload(result.data.url, result.data.name || buildCollectionZipName(collection?.title, collectionId));
      bumpCollectionDownloadCount();
      emitBehaviorEvent("collection_zip_download", {
        collection_id: collectionId,
        success: true,
        metadata: {
          mode: zipKey ? "single_zip" : "latest_zip",
        },
      });
    } catch {
      emitBehaviorEvent("collection_zip_download", {
        collection_id: collectionId,
        success: false,
        error_code: "network_error",
        metadata: {
          mode: zipKey ? "single_zip" : "latest_zip",
        },
      });
      setNotice("下载失败，请稍后重试");
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadAllZips = async () => {
    if (!collectionId || downloadingZip || zipItems.length === 0) return;
    if (!(await ensureAuthenticated("请先登录再继续下载"))) {
      emitBehaviorEvent("collection_zip_download", {
        collection_id: collectionId,
        success: false,
        error_code: "unauthorized",
        metadata: {
          mode: "zip_bundle_all",
        },
      });
      return;
    }
    emitBehaviorEvent("collection_zip_download", {
      collection_id: collectionId,
      metadata: {
        mode: "zip_bundle_all",
      },
    });
    setNotice(null);
    setDownloadingZip(true);
    setDownloadingAllZipBundle(true);
    try {
      const result = await requestDownloadLink(`${API_BASE}/collections/${collectionId}/download-zip-all`);
      if (!result.ok) {
        if (result.error.status === 401) {
          emitBehaviorEvent("collection_zip_download", {
            collection_id: collectionId,
            success: false,
            error_code: "unauthorized",
            metadata: {
              mode: "zip_bundle_all",
            },
          });
          openAuthPrompt("请先登录再继续下载");
          return;
        }
        emitBehaviorEvent("collection_zip_download", {
          collection_id: collectionId,
          success: false,
          error_code: result.error.code || `http_${result.error.status}`,
          metadata: {
            mode: "zip_bundle_all",
          },
        });
        setNotice(
          result.error.message ||
            resolveDownloadNotice(result.error.status, result.error.code, "下载失败，请稍后重试", "下载合集")
        );
        return;
      }
      const fileName = buildCollectionZipName(collection?.title, collectionId);
      triggerURLDownload(result.data.url, result.data.name || fileName);
      bumpCollectionDownloadCount();
      emitBehaviorEvent("collection_zip_download", {
        collection_id: collectionId,
        success: true,
        metadata: {
          mode: "zip_bundle_all",
        },
      });
    } catch {
      emitBehaviorEvent("collection_zip_download", {
        collection_id: collectionId,
        success: false,
        error_code: "network_error",
        metadata: {
          mode: "zip_bundle_all",
        },
      });
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

  const handleDownloadEmoji = async (emoji: ApiEmoji) => {
    const emojiId = Number(emoji?.id || 0);
    if (!emojiId || downloadingEmoji) return;
    if (!(await ensureAuthenticated("请先登录再继续下载"))) {
      emitBehaviorEvent("emoji_download", {
        collection_id: collectionId || undefined,
        emoji_id: emojiId,
        success: false,
        error_code: "unauthorized",
      });
      return;
    }
    emitBehaviorEvent("emoji_download", {
      collection_id: collectionId || undefined,
      emoji_id: emojiId,
    });
    setNotice(null);
    setDownloadingEmoji(emojiId);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/emojis/${emojiId}/download-file`);
      if (res.status === 401) {
        emitBehaviorEvent("emoji_download", {
          collection_id: collectionId || undefined,
          emoji_id: emojiId,
          success: false,
          error_code: "unauthorized",
        });
        openAuthPrompt("请先登录再继续下载");
        return;
      }
      if (!res.ok) {
        const apiErr = await parseApiError(res);
        emitBehaviorEvent("emoji_download", {
          collection_id: collectionId || undefined,
          emoji_id: emojiId,
          success: false,
          error_code: apiErr.code || `http_${res.status}`,
        });
        setNotice(
          apiErr.message ||
            resolveDownloadNotice(res.status, apiErr.code, "下载失败，请稍后重试", "下载表情")
        );
        return;
      }
      const blob = await res.blob();
      if (!blob || blob.size <= 0) {
        emitBehaviorEvent("emoji_download", {
          collection_id: collectionId || undefined,
          emoji_id: emojiId,
          success: false,
          error_code: "empty_file",
        });
        setNotice("下载文件为空，请稍后重试");
        return;
      }
      const headerName = parseDownloadFilenameFromHeader(res.headers.get("content-disposition"));
      const fileName = buildEmojiDownloadName(emoji, headerName);
      triggerBlobDownload(blob, fileName);
      emitBehaviorEvent("emoji_download", {
        collection_id: collectionId || undefined,
        emoji_id: emojiId,
        success: true,
      });
      setDownloadedEmoji(emojiId);
      window.setTimeout(() => {
        setDownloadedEmoji((prev) => (prev === emojiId ? null : prev));
      }, 1600);
    } catch {
      emitBehaviorEvent("emoji_download", {
        collection_id: collectionId || undefined,
        emoji_id: emojiId,
        success: false,
        error_code: "network_error",
      });
      setNotice("下载失败，请稍后重试");
    } finally {
      setDownloadingEmoji(null);
    }
  };

  const toggleEmojiFavorite = async (emoji: ApiEmoji) => {
    if (!emoji?.id || togglingEmojiFavorite === emoji.id) return;
    const isRemoving = Boolean(emoji.favorited);
    if (!(await ensureAuthenticated("请先登录再继续收藏"))) {
      emitBehaviorEvent("emoji_favorite_toggle", {
        collection_id: collectionId || undefined,
        emoji_id: emoji.id,
        success: false,
        error_code: "unauthorized",
        metadata: {
          action: isRemoving ? "unfavorite" : "favorite",
        },
      });
      return;
    }
    emitBehaviorEvent("emoji_favorite_toggle", {
      collection_id: collectionId || undefined,
      emoji_id: emoji.id,
      metadata: {
        action: isRemoving ? "unfavorite" : "favorite",
      },
    });
    setNotice(null);
    setTogglingEmojiFavorite(emoji.id);
    try {
      const url = isRemoving
        ? `${API_BASE}/favorites/${emoji.id}`
        : `${API_BASE}/favorites`;
      const res = await fetchWithAuthRetry(url, {
        method: isRemoving ? "DELETE" : "POST",
        headers: isRemoving ? undefined : { "Content-Type": "application/json" },
        body: isRemoving ? undefined : JSON.stringify({ emoji_id: emoji.id }),
      });
      if (res.status === 401) {
        emitBehaviorEvent("emoji_favorite_toggle", {
          collection_id: collectionId || undefined,
          emoji_id: emoji.id,
          success: false,
          error_code: "unauthorized",
          metadata: {
            action: isRemoving ? "unfavorite" : "favorite",
          },
        });
        openAuthPrompt("请先登录再继续收藏");
        return;
      }
      if (!res.ok) {
        const apiErr = await parseApiError(res);
        emitBehaviorEvent("emoji_favorite_toggle", {
          collection_id: collectionId || undefined,
          emoji_id: emoji.id,
          success: false,
          error_code: apiErr.code || `http_${res.status}`,
          metadata: {
            action: isRemoving ? "unfavorite" : "favorite",
          },
        });
        setNotice(apiErr.message || resolveActionNotice(res.status, apiErr.code, "收藏操作失败，请稍后重试", "收藏"));
        return;
      }
      emitBehaviorEvent("emoji_favorite_toggle", {
        collection_id: collectionId || undefined,
        emoji_id: emoji.id,
        success: true,
        metadata: {
          action: isRemoving ? "unfavorite" : "favorite",
        },
      });
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
      emitBehaviorEvent("emoji_favorite_toggle", {
        collection_id: collectionId || undefined,
        emoji_id: emoji.id,
        success: false,
        error_code: "network_error",
        metadata: {
          action: isRemoving ? "unfavorite" : "favorite",
        },
      });
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
    const action = collection.liked ? "unlike" : "like";
    if (!(await ensureAuthenticated("请先登录再继续点赞"))) {
      emitBehaviorEvent("collection_like_toggle", {
        collection_id: collectionId,
        success: false,
        error_code: "unauthorized",
        metadata: { action },
      });
      return;
    }
    emitBehaviorEvent("collection_like_toggle", {
      collection_id: collectionId,
      metadata: { action },
    });
    setNotice(null);
    setTogglingLike(true);
    try {
      const method = collection.liked ? "DELETE" : "POST";
      const res = await fetchWithAuthRetry(`${API_BASE}/collections/${collectionId}/like`, {
        method,
      });
      if (res.status === 401) {
        emitBehaviorEvent("collection_like_toggle", {
          collection_id: collectionId,
          success: false,
          error_code: "unauthorized",
          metadata: { action },
        });
        openAuthPrompt("请先登录再继续点赞");
        return;
      }
      if (!res.ok) {
        const apiErr = await parseApiError(res);
        emitBehaviorEvent("collection_like_toggle", {
          collection_id: collectionId,
          success: false,
          error_code: apiErr.code || `http_${res.status}`,
          metadata: { action },
        });
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
      emitBehaviorEvent("collection_like_toggle", {
        collection_id: collectionId,
        success: true,
        metadata: { action },
      });
    } catch {
      emitBehaviorEvent("collection_like_toggle", {
        collection_id: collectionId,
        success: false,
        error_code: "network_error",
        metadata: { action },
      });
      setNotice("点赞失败，请稍后重试");
    } finally {
      setTogglingLike(false);
    }
  };

  const toggleCollectionFavorite = async () => {
    if (!collectionId || togglingFavorite || !collection) return;
    const action = collection.favorited ? "unfavorite" : "favorite";
    if (!(await ensureAuthenticated("请先登录再继续收藏"))) {
      emitBehaviorEvent("collection_favorite_toggle", {
        collection_id: collectionId,
        success: false,
        error_code: "unauthorized",
        metadata: { action },
      });
      return;
    }
    emitBehaviorEvent("collection_favorite_toggle", {
      collection_id: collectionId,
      metadata: { action },
    });
    setNotice(null);
    setTogglingFavorite(true);
    try {
      const method = collection.favorited ? "DELETE" : "POST";
      const res = await fetchWithAuthRetry(`${API_BASE}/collections/${collectionId}/favorite`, {
        method,
      });
      if (res.status === 401) {
        emitBehaviorEvent("collection_favorite_toggle", {
          collection_id: collectionId,
          success: false,
          error_code: "unauthorized",
          metadata: { action },
        });
        openAuthPrompt("请先登录再继续收藏");
        return;
      }
      if (!res.ok) {
        const apiErr = await parseApiError(res);
        emitBehaviorEvent("collection_favorite_toggle", {
          collection_id: collectionId,
          success: false,
          error_code: apiErr.code || `http_${res.status}`,
          metadata: { action },
        });
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
      emitBehaviorEvent("collection_favorite_toggle", {
        collection_id: collectionId,
        success: true,
        metadata: { action },
      });
    } catch {
      emitBehaviorEvent("collection_favorite_toggle", {
        collection_id: collectionId,
        success: false,
        error_code: "network_error",
        metadata: { action },
      });
      setNotice("收藏失败，请稍后重试");
    } finally {
      setTogglingFavorite(false);
    }
  };

  const isShowcaseCollection = Boolean(collection?.is_showcase);
  const copyrightAuthor = (collection?.copyright_author || "").trim();
  const copyrightWork = (collection?.copyright_work || "").trim();
  const copyrightLink = (collection?.copyright_link || "").trim();
  const hasCopyrightInfo = Boolean(
    copyrightAuthor || copyrightWork || copyrightLink
  );
  const backHref = isShowcaseCollection ? "/showcase" : "/categories";

  if (!loadingDetail && collectionId && !collection) {
    return (
      <div className="min-h-screen bg-slate-50/30">
        <div className="mx-auto flex min-h-[72vh] max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
          <div className="text-5xl">🫥</div>
          <h1 className="mt-4 text-2xl font-black text-slate-900">合集不存在或已下架</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            你访问的链接可能已失效，去其他页面看看吧～
          </p>
          <Link
            href="/showcase"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-emerald-600"
          >
            返回表情包赏析
          </Link>
        </div>
      </div>
    );
  }

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
              href={backHref}
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
          {!isShowcaseCollection ? (
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
          ) : (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700">
              赏析模式：仅展示，不提供下载
            </div>
          )}
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

            {isShowcaseCollection ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-indigo-50 text-indigo-400 border border-indigo-100">
                  <Eye size={24} />
                </div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">展示模式</span>
                <span className="text-sm font-black text-indigo-700">仅赏析</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-slate-50 text-slate-300 border border-slate-100">
                  <Download size={24} />
                </div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">总下载</span>
                <span className="text-sm font-black text-slate-900">{collection?.download_count || 0}</span>
              </div>
            )}
          </div>
        </div>

        {!isShowcaseCollection && hasCopyrightInfo ? (
          <div className="mb-10 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
            <div className="text-[11px] font-bold text-slate-500">版权信息</div>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <div>图片作者：{copyrightAuthor || "待补充"}</div>
              <div>原作：{copyrightWork || "待补充"}</div>
              <div>
                图片来源/作者主页：
                {copyrightLink ? (
                  <a
                    href={copyrightLink}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                  >
                    点击跳转链接
                  </a>
                ) : (
                  "待补充"
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* 表情列表 */}
        <div className="space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              {isShowcaseCollection ? "表情内容展示" : "单张表情下载"}
              <span className="text-xs font-bold text-slate-300">
                {isShowcaseCollection ? "/ Showcase Display" : "/ Single Download"}
              </span>
            </h3>
            <div className="rounded-lg bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-400">
              已展示 {emojis.length} / {total}
            </div>
          </div>

          {!loading && emojis.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 py-16 text-center">
              <div className="text-4xl">🧸</div>
              <div className="mt-3 text-base font-black text-slate-800">合集内暂时还没有可展示表情</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">运营维护后会自动出现在这里</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {emojis.map((emoji) => {
                const preview = emoji.preview_url || emoji.file_url || "";
                const formatLabel = getEmojiFormatLabel(emoji);
                const isDownloaded = downloadedEmoji === emoji.id;
                const isDownloading = downloadingEmoji === emoji.id;
                const showDesktopDownloadAction = isDownloading || isDownloaded;
                
                return (
                  <div
                    key={emoji.id}
                    className="group relative flex flex-col rounded-[2rem] border border-slate-100/80 bg-white p-2.5 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-15px_rgba(15,23,42,0.08)]"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-[1.5rem] bg-slate-50/50 ring-1 ring-inset ring-slate-100/50">
                      {preview ? <FallbackImage url={preview} alt={emoji.title} /> : null}
                      <div className="absolute left-2.5 top-2.5 rounded-full bg-black/30 px-2.5 py-1 text-[9px] font-black tracking-wider text-white backdrop-blur-md">
                        {formatLabel}
                      </div>
                      
                      {/* 悬浮遮罩 */}
                      <div className="absolute inset-0 bg-black/[0.03] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      {!isShowcaseCollection ? (
                        <button
                          onClick={() => handleDownloadEmoji(emoji)}
                          className={`absolute inset-x-2.5 bottom-2.5 hidden h-9 items-center justify-center gap-2 rounded-xl text-[11px] font-black tracking-wide transition-all duration-200 md:flex ${
                            showDesktopDownloadAction
                              ? "translate-y-0 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 shadow-sm"
                              : "translate-y-2 bg-white/85 text-slate-700 ring-1 ring-white/90 shadow-md backdrop-blur-md opacity-0 pointer-events-none group-hover:translate-y-0 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:text-slate-900 group-hover:ring-slate-200 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:pointer-events-auto"
                          } disabled:opacity-60`}
                          disabled={isDownloading}
                          aria-label={`下载表情 ${emoji.title || emoji.id}`}
                        >
                          {isDownloading ? (
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
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-col gap-2.5 px-1 pb-1">
                      <div className="flex items-center justify-between pl-1">
                        <span className="text-[11px] font-bold text-slate-400">
                          {getEmojiSizeLabel(emoji.size_bytes)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {!isShowcaseCollection ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadEmoji(emoji)}
                              className={`flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90 md:hidden ${
                                isDownloaded
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500"
                              }`}
                              disabled={isDownloading}
                              aria-label={`下载表情 ${emoji.title || emoji.id}`}
                            >
                              {isDownloading ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : isDownloaded ? (
                                <Check size={14} />
                              ) : (
                                <Download size={14} />
                              )}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => toggleEmojiFavorite(emoji)}
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90 ${
                              emoji.favorited
                                ? "bg-rose-50 text-rose-500"
                                : "bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-400"
                            }`}
                            disabled={togglingEmojiFavorite === emoji.id}
                            aria-label={`${emoji.favorited ? "取消收藏" : "收藏"}表情 ${emoji.title || emoji.id}`}
                          >
                            {togglingEmojiFavorite === emoji.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Heart size={14} className={emoji.favorited ? "fill-current" : ""} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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

        {isShowcaseCollection ? (
          <div className="mt-10 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
            <div className="text-[11px] font-bold text-slate-500">
              版权信息
            </div>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <div>图片作者：{copyrightAuthor || "未填写"}</div>
              <div>原作：{copyrightWork || "未填写"}</div>
              <div>
                图片来源/作者主页：
                {copyrightLink ? (
                  <a
                    href={copyrightLink}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                  >
                    点击跳转链接
                  </a>
                ) : (
                  "未填写"
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="h-20" />
    </div>
  );
}
