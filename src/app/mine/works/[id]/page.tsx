"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  API_BASE,
  clearAuthSession,
  fetchWithAuthRetry,
} from "@/lib/auth-client";
import { requestDownloadLink, triggerURLDownload } from "@/lib/download-client";
import { isStorageObjectKey } from "@/lib/storage-prefix";

type VideoJobResultEmoji = {
  id: number;
  title?: string;
  format?: string;
  file_key?: string;
  file_url?: string;
  thumb_url?: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  display_order?: number;
};

type VideoJobResultPackage = {
  id?: number;
  file_key?: string;
  file_url?: string;
  file_name?: string;
  size_bytes?: number;
  uploaded_at?: string;
};

type VideoJobResultCollection = {
  id?: number;
  title?: string;
  file_count?: number;
  created_at?: string;
  updated_at?: string;
};

type VideoJobResultResponse = {
  job_id?: number;
  status?: string;
  delivery_only?: boolean;
  review_status_filter?: string[];
  message?: string;
  collection?: VideoJobResultCollection;
  emojis?: VideoJobResultEmoji[];
  package?: VideoJobResultPackage;
};

type VideoJobSnapshot = {
  id: number;
  status?: string;
  stage?: string;
  progress?: number;
  title?: string;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

const imageFormatSet = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
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
  if (!isStorageObjectKey(key)) return "";
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
    if (!candidates.includes(value)) candidates.push(value);
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

function FallbackImage({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className: string;
}) {
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
      className={className}
      onError={() => {
        setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
      }}
    />
  );
}

function parseJobID(raw: string | string[] | undefined) {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(first || 0);
  if (!Number.isFinite(id) || id <= 0) return 0;
  return Math.floor(id);
}

function formatTime(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("zh-CN");
}

function formatBytes(value?: number) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024) return `${size.toFixed(0)} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function normalizeFormat(value?: string) {
  const format = (value || "").trim().toLowerCase();
  if (!format) return "";
  if (format === "jpeg") return "jpg";
  return format;
}

function inferFormatFromURL(url?: string) {
  const clean = (url || "").trim().split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  if (dot < 0) return "";
  return normalizeFormat(clean.slice(dot + 1));
}

function isImageOutput(item: VideoJobResultEmoji) {
  const format = normalizeFormat(item.format) || inferFormatFromURL(item.file_url || item.thumb_url);
  return imageFormatSet.has(format);
}

function resolvePreviewURL(item: VideoJobResultEmoji) {
  return (item.thumb_url || item.file_url || "").trim();
}

function sanitizeFileStem(raw: string) {
  const safe = raw
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe.slice(0, 60) || "output";
}

function buildOutputDownloadName(jobID: number, item: VideoJobResultEmoji, index: number) {
  const format = normalizeFormat(item.format) || inferFormatFromURL(item.file_url);
  const ext = format || "bin";
  const stem = sanitizeFileStem(item.title || "output");
  return `${jobID}_${String(index + 1).padStart(3, "0")}_${stem}.${ext}`;
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

function triggerBlobDownload(blob: Blob, fileName: string) {
  if (!blob || blob.size <= 0) return;
  const objectURL = URL.createObjectURL(blob);
  triggerURLDownload(objectURL, fileName);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectURL);
  }, 1800);
}

async function parseApiError(res: Response): Promise<ApiErrorPayload> {
  try {
    return (await res.clone().json()) as ApiErrorPayload;
  } catch {
    return {};
  }
}

function statusLabel(status?: string) {
  switch ((status || "").trim().toLowerCase()) {
    case "queued":
      return "排队中";
    case "running":
      return "处理中";
    case "done":
      return "已完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return status || "-";
  }
}

function toChineseMessage(raw: string | undefined, fallback: string) {
  const text = (raw || "").trim();
  if (!text) return fallback;
  if (/[\u4e00-\u9fff]/.test(text)) return text;
  return fallback;
}

export default function MineWorkDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const jobID = useMemo(() => parseJobID(params?.id), [params?.id]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoJobResultResponse | null>(null);
  const [jobSnapshot, setJobSnapshot] = useState<VideoJobSnapshot | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingCollection, setDeletingCollection] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingEmojiId, setDownloadingEmojiId] = useState<number | null>(null);

  const emojis = useMemo(() => {
    const list = Array.isArray(result?.emojis) ? [...(result?.emojis || [])] : [];
    list.sort((a, b) => {
      const hasOA = a.display_order !== undefined && a.display_order !== null;
      const hasOB = b.display_order !== undefined && b.display_order !== null;
      const oa = Number(a.display_order ?? 0);
      const ob = Number(b.display_order ?? 0);
      if (hasOA && hasOB && oa !== ob) return oa - ob;
      if (hasOA !== hasOB) return hasOA ? -1 : 1;
      return Number(a.id || 0) - Number(b.id || 0);
    });
    return list;
  }, [result?.emojis]);

  const hasPackageArtifact = useMemo(() => {
    const packageInfo = result?.package;
    if (!packageInfo) return false;
    return Boolean(
      (packageInfo.file_key || "").trim() ||
        (packageInfo.file_name || "").trim() ||
        (packageInfo.file_url || "").trim()
    );
  }, [result?.package]);
  const canDownloadZip = emojis.length > 0 || hasPackageArtifact;
  const emptyStateMessage = useMemo(() => {
    const message = (result?.message || "").trim();
    if (message && /[\u4e00-\u9fff]/.test(message)) return message;
    if (result?.delivery_only) {
      return "当前任务暂无可交付作品。";
    }
    return "当前暂无可展示的文件。";
  }, [result?.delivery_only, result?.message]);
  const deleteConfirmName = useMemo(() => {
    const zipName = (result?.package?.file_name || "").trim();
    if (zipName) return zipName;
    return (result?.collection?.title || "").trim();
  }, [result?.collection?.title, result?.package?.file_name]);

  const loadResult = useCallback(async () => {
    if (!jobID) {
      setError("任务 ID 无效");
      setResult(null);
      setJobSnapshot(null);
      return;
    }

    setLoading(true);
    setError(null);
    setPreviewIndex(null);

    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/result?delivery_only=1`);
      if (res.status === 401) {
        clearAuthSession();
        router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
        return;
      }

      if (res.ok) {
        const payload = (await res.json()) as VideoJobResultResponse;
        setResult(payload);
        setJobSnapshot(null);
        return;
      }

      if (res.status === 409) {
        const payload = (await res.json()) as VideoJobResultResponse;
        setResult(payload);

        const jobRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}`);
        if (jobRes.status === 401) {
          clearAuthSession();
          router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
          return;
        }
        if (jobRes.ok) {
          const snapshot = (await jobRes.json()) as VideoJobSnapshot;
          setJobSnapshot(snapshot);
        } else {
          setJobSnapshot(null);
        }

        setError(toChineseMessage(payload.message, "任务尚未完成，暂时没有可查看的结果。"));
        return;
      }

      const apiErr = await parseApiError(res);
      setError(toChineseMessage(apiErr.message || apiErr.error, "加载作品详情失败"));
      setResult(null);
      setJobSnapshot(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "加载作品详情失败";
      setError(toChineseMessage(message, "加载作品详情失败"));
      setResult(null);
      setJobSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [jobID, router]);

  useEffect(() => {
    void loadResult();
  }, [loadResult]);

  const previewItem =
    previewIndex !== null && previewIndex >= 0 && previewIndex < emojis.length
      ? emojis[previewIndex]
      : null;

  const handleDeleteCollection = useCallback(async () => {
    if (!jobID || deletingCollection) return;
    if (!deleteConfirmName) {
      setError("缺少合集名称，无法执行删除。");
      return;
    }
    if (deleteConfirmText.trim() !== deleteConfirmName) return;

    setDeletingCollection(true);
    setError(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/delete-collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_name: deleteConfirmText.trim() }),
      });
      if (res.status === 401) {
        clearAuthSession();
        router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
        return;
      }
      if (!res.ok) {
        const payload = await parseApiError(res);
        throw new Error(toChineseMessage(payload.message || payload.error, "删除合集失败"));
      }
      router.replace("/mine/works");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "删除合集失败";
      setError(toChineseMessage(message, "删除合集失败"));
    } finally {
      setDeletingCollection(false);
      setDeleteConfirmOpen(false);
      setDeleteConfirmText("");
    }
  }, [jobID, deletingCollection, deleteConfirmName, deleteConfirmText, router]);

  const handleDownloadZip = useCallback(async () => {
    if (!jobID || downloadingZip) return;
    if (!canDownloadZip) {
      setError("暂无可下载的作品。");
      return;
    }

    setDownloadingZip(true);
    setError(null);
    try {
      const downloadResult = await requestDownloadLink(`${API_BASE}/video-jobs/${jobID}/download-zip`);
      if (!downloadResult.ok) {
        if (downloadResult.error.status === 401) {
          clearAuthSession();
          router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
          return;
        }
        throw new Error(toChineseMessage(downloadResult.error.message, "获取 ZIP 失败"));
      }
      const fileName =
        (downloadResult.data.name || "").trim() ||
        (result?.package?.file_name || "").trim() ||
        `job_${jobID}_outputs.zip`;
      triggerURLDownload(downloadResult.data.url, fileName);

      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          package: {
            ...(prev.package || {}),
            file_key: downloadResult.data.key || prev.package?.file_key,
            file_name: fileName,
            file_url: downloadResult.data.url,
          },
        };
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "获取 ZIP 失败";
      setError(toChineseMessage(message, "获取 ZIP 失败"));
    } finally {
      setDownloadingZip(false);
    }
  }, [jobID, downloadingZip, canDownloadZip, router, result?.package?.file_name]);

  const handleDownloadEmoji = useCallback(
    async (item: VideoJobResultEmoji, index: number) => {
      if (!jobID) return;
      if (!item.id || downloadingEmojiId) return;

      setDownloadingEmojiId(item.id);
      setError(null);
      try {
        const fileName = buildOutputDownloadName(jobID, item, index);

        const jobDownloadURL = `${API_BASE}/video-jobs/${jobID}/emojis/${item.id}/download-file`;
        try {
          const jobRes = await fetchWithAuthRetry(jobDownloadURL);
          if (jobRes.status === 401) {
            clearAuthSession();
            router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
            return;
          }
          if (jobRes.ok) {
            const blob = await jobRes.blob();
            if (blob.size > 0) {
              const headerName = parseDownloadFilenameFromHeader(jobRes.headers.get("content-disposition"));
              triggerBlobDownload(blob, headerName || fileName);
              return;
            }
          }
        } catch {
          // ignore direct job download errors and continue fallback flow
        }

        const proxySource = (item.file_key || item.file_url || item.thumb_url || "").trim();
        const objectKey = extractObjectKey(proxySource);
        const proxyURL = isStorageObjectKey(objectKey)
          ? `${API_BASE}/storage/proxy?key=${encodeURIComponent(objectKey)}`
          : buildStorageProxyCandidate(proxySource);

        if (proxyURL) {
          const proxyRes = await fetchWithAuthRetry(proxyURL);
          if (proxyRes.status === 401) {
            clearAuthSession();
            router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
            return;
          }
          if (proxyRes.ok) {
            const blob = await proxyRes.blob();
            if (blob.size > 0) {
              triggerBlobDownload(blob, fileName);
              return;
            }
          }
        }

        const directURL = (item.file_url || "").trim();
        if (directURL) {
          try {
            const directRes = await fetch(directURL, { credentials: "omit" });
            if (directRes.ok) {
              const blob = await directRes.blob();
              if (blob.size > 0) {
                triggerBlobDownload(blob, fileName);
                return;
              }
            }
          } catch {
            // ignore direct download errors and continue fallback flow
          }
        }

        const downloadResult = await requestDownloadLink(`${API_BASE}/emojis/${item.id}/download`);
        if (!downloadResult.ok) {
          if (downloadResult.error.status === 401) {
            clearAuthSession();
            router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
            return;
          }
          throw new Error(toChineseMessage(downloadResult.error.message, "下载失败"));
        }
        triggerURLDownload(downloadResult.data.url, (downloadResult.data.name || "").trim() || fileName);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "下载失败";
        setError(toChineseMessage(message, "下载失败"));
      } finally {
        setDownloadingEmojiId(null);
      }
    },
    [jobID, downloadingEmojiId, router]
  );
  const currentPreviewIndex = previewIndex ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between rounded-3xl bg-white p-6 md:p-8 shadow-sm ring-1 ring-inset ring-slate-200/60">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 tracking-wider uppercase">任务 #{jobID || "-"}</span>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 ring-1 ring-inset ring-emerald-200/50">
              {statusLabel(result?.status || jobSnapshot?.status)}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            {(result?.collection?.title || jobSnapshot?.title || "作品详情").trim() || "作品详情"}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-slate-500">
            {result?.collection?.id ? (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">合集</span>
                <span className="text-slate-700">#{result.collection.id}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">文件</span>
              <span className="text-slate-700">{emojis.length} 个</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">创建于</span>
              <span className="text-slate-700">{formatTime(result?.collection?.created_at)}</span>
            </div>
          </div>
          {result?.package?.file_name ? (
            <div className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-500">
              <span className="text-slate-400">ZIP包</span>
              <span className="text-slate-700">{result.package.file_name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-700">{formatBytes(result.package.size_bytes)}</span>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">{error}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => void loadResult()}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition-all active:scale-95"
          >
            {loading ? "刷新中..." : "刷新"}
          </button>
          <Link href="/mine/works" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition-all active:scale-95">
            返回列表
          </Link>
          <button
            onClick={() => {
              setDeleteConfirmText("");
              setDeleteConfirmOpen(true);
            }}
            disabled={!deleteConfirmName}
            className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-100 transition-all disabled:opacity-50 active:scale-95"
          >
            删除合集
          </button>
          {canDownloadZip ? (
            <button
              type="button"
              onClick={() => void handleDownloadZip()}
              disabled={downloadingZip}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition-all disabled:opacity-60 active:scale-95"
            >
              {downloadingZip ? "下载中..." : "下载 ZIP"}
            </button>
          ) : null}
        </div>
      </div>

      {loading && !emojis.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={`skeleton-${idx}`} className="animate-pulse flex flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div className="aspect-[4/5] w-full bg-slate-100" />
              <div className="flex flex-1 flex-col p-4">
                <div className="h-4 w-2/3 rounded bg-slate-100" />
                <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
                <div className="mt-4 flex gap-2">
                  <div className="h-8 flex-1 rounded-xl bg-slate-100" />
                  <div className="h-8 flex-1 rounded-xl bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && !emojis.length ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center text-sm text-slate-400">
          {emptyStateMessage}
        </div>
      ) : null}

      {emojis.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {emojis.map((item, idx) => {
            const previewURL = resolvePreviewURL(item);
            const imageOutput = isImageOutput(item);
            const fileURL = (item.file_url || "").trim();
            const downloadable = Boolean(fileURL && item.id);
            const format = normalizeFormat(item.format) || inferFormatFromURL(fileURL) || "file";
            const title = (item.title || `文件 ${idx + 1}`).trim() || `文件 ${idx + 1}`;
            const dimension = item.width && item.height ? `${item.width} × ${item.height}` : "尺寸未知";
            return (
              <div
                key={item.id || `${fileURL}-${idx}`}
                className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-inset ring-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-900/5 hover:ring-emerald-200"
              >
                <button
                  type="button"
                  onClick={() => setPreviewIndex(idx)}
                  disabled={!previewURL}
                  className="relative block aspect-[4/5] w-full overflow-hidden bg-slate-100 disabled:cursor-not-allowed"
                >
                  {previewURL ? (
                    imageOutput ? (
                      <FallbackImage
                        key={previewURL}
                        url={previewURL}
                        alt={title}
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-400">
                        {format}
                      </div>
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-400">无预览</div>
                  )}
                  <div className="absolute top-3 left-3 rounded-lg bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                    #{idx + 1}
                  </div>
                  <div className="absolute top-3 right-3 rounded-lg bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md uppercase tracking-wider">
                    {format}
                  </div>
                </button>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-1 text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors" title={title}>
                    {title}
                  </h3>
                  
                  <div className="mt-2 flex items-center gap-3 text-xs font-medium text-slate-500">
                    <span className="truncate">{formatBytes(item.size_bytes)}</span>
                    <span className="text-slate-300">|</span>
                    <span className="truncate">{dimension}</span>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(idx)}
                      disabled={!previewURL}
                      className="flex-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                    >
                      预览
                    </button>
                    {downloadable ? (
                      <button
                        type="button"
                        onClick={() => void handleDownloadEmoji(item, idx)}
                        disabled={downloadingEmojiId === item.id}
                        className="flex-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
                      >
                        {downloadingEmojiId === item.id ? "下载中..." : "下载原图"}
                      </button>
                    ) : (
                      <span className="flex-1 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-400">
                        不可下载
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {previewItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setPreviewIndex(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setPreviewIndex(null);
            }
          }}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs text-slate-300">
              <div>
                {(previewItem.title || `文件 ${currentPreviewIndex + 1}`).trim() || `文件 ${currentPreviewIndex + 1}`} ·
                {" "}
                {normalizeFormat(previewItem.format).toUpperCase() || inferFormatFromURL(previewItem.file_url).toUpperCase() || "FILE"}
              </div>
              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200"
              >
                关闭
              </button>
            </div>
            <div className="relative aspect-[16/10] w-full bg-black">
              {resolvePreviewURL(previewItem) ? (
                isImageOutput(previewItem) ? (
                  <FallbackImage
                    key={resolvePreviewURL(previewItem)}
                    url={resolvePreviewURL(previewItem)}
                    alt={previewItem.title || "preview"}
                    className="object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm uppercase tracking-widest text-slate-500">
                    {normalizeFormat(previewItem.format) || inferFormatFromURL(previewItem.file_url) || "file"}
                  </div>
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">无预览</div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3">
              <div className="text-xs text-slate-400">
                {previewItem.width && previewItem.height ? `${previewItem.width} × ${previewItem.height}` : "-"} · {formatBytes(previewItem.size_bytes)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewIndex((prev) => (prev === null ? null : Math.max(prev - 1, 0)))}
                  disabled={currentPreviewIndex <= 0}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 disabled:opacity-40"
                >
                  上一张
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewIndex((prev) => (prev === null ? null : Math.min(prev + 1, emojis.length - 1)))
                  }
                  disabled={currentPreviewIndex >= emojis.length - 1}
                  className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 disabled:opacity-40"
                >
                  下一张
                </button>
                {(previewItem.file_url || "").trim() && previewItem.id ? (
                  <button
                    type="button"
                    onClick={() => void handleDownloadEmoji(previewItem, currentPreviewIndex)}
                    disabled={downloadingEmojiId === previewItem.id}
                    className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 disabled:opacity-60"
                  >
                    {downloadingEmojiId === previewItem.id ? "下载中..." : "下载原图"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setDeleteConfirmOpen(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDeleteConfirmOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-rose-200 bg-white p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-lg font-black text-slate-900">删除合集</div>
            <div className="mt-2 text-sm text-slate-600">
              该操作会删除整个作品合集、所有产物文件与 ZIP 包，且不可恢复。
            </div>
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              请输入 <span className="font-semibold">{deleteConfirmName || "合集名称"}</span> 以确认删除。
            </div>
            <input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder={deleteConfirmName || "合集名称"}
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
              >
                取消
              </button>
              <button
                onClick={() => void handleDeleteCollection()}
                disabled={deletingCollection || !deleteConfirmName || deleteConfirmText.trim() !== deleteConfirmName}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {deletingCollection ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
