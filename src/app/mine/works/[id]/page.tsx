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
import { parseQualityTemplateSuggestionFromOptions, type QualityTemplateSuggestion } from "@/lib/video-quality-template";

type VideoJobResultEmoji = {
  id: number;
  output_id?: number;
  review_recommendation?: string;
  title?: string;
  format?: string;
  file_key?: string;
  file_url?: string;
  thumb_url?: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  display_order?: number;
  feedback_action?: string;
  feedback_at?: string;
  output_score?: number;
  gif_loop_tune_applied?: boolean;
  gif_loop_tune_effective_applied?: boolean;
  gif_loop_tune_fallback_to_base?: boolean;
  gif_loop_tune_score?: number;
  gif_loop_tune_loop_closure?: number;
  gif_loop_tune_motion_mean?: number;
  gif_loop_tune_effective_sec?: number;
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
  options?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
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

type VideoFeedbackAction = "like" | "neutral" | "dislike" | "top_pick";

const imageFormatSet = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;
const feedbackActionOptions: Array<{ action: VideoFeedbackAction; label: string }> = [
  { action: "like", label: "喜欢" },
  { action: "neutral", label: "一般" },
  { action: "dislike", label: "不满意" },
  { action: "top_pick", label: "这张最想下载" },
];

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

function formatMetric(value?: number, digits = 3) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(digits);
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

function normalizeFeedbackAction(value?: string): VideoFeedbackAction | null {
  const action = (value || "").trim().toLowerCase();
  switch (action) {
    case "like":
    case "neutral":
    case "dislike":
    case "top_pick":
      return action;
    default:
      return null;
  }
}

function parseQualityTemplateSuggestion(result: VideoJobResultResponse | null): QualityTemplateSuggestion | null {
  const options = result?.options;
  if (!options || typeof options !== "object") return null;
  return parseQualityTemplateSuggestionFromOptions(options as Record<string, unknown>);
}

function resolvePackageStatus(result: VideoJobResultResponse | null): "ready" | "processing" | "failed" {
  const ready = Boolean((result?.package?.file_url || "").trim());
  if (ready) return "ready";
  const raw = String(result?.metrics?.package_zip_status || "")
    .trim()
    .toLowerCase();
  if (raw === "ready") return "ready";
  if (raw === "pending" || raw === "processing") return "processing";
  if (raw === "failed") return "failed";
  if ((result?.status || "").trim().toLowerCase() === "done") return "failed";
  return "processing";
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toNumberOrNull(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function computeGifQualityPriority(item: VideoJobResultEmoji): number | null {
  const format = normalizeFormat(item.format) || inferFormatFromURL(item.file_url || item.thumb_url);
  if (format !== "gif") return null;

  const outputScore = toNumberOrNull(item.output_score);
  const loopClosure = toNumberOrNull(item.gif_loop_tune_loop_closure);
  const motionMean = toNumberOrNull(item.gif_loop_tune_motion_mean);
  if (outputScore === null && loopClosure === null && motionMean === null) {
    return null;
  }

  const targetMotion = 0.18;
  const motionDistance = motionMean === null ? 1 : Math.abs(motionMean - targetMotion) / Math.max(targetMotion, 0.01);
  const motionFit = clamp01(1 - motionDistance);
  const baseScore = clamp01(outputScore ?? 0) * 0.58 + clamp01(loopClosure ?? 0) * 0.32 + motionFit * 0.1;
  const tuneBonus = item.gif_loop_tune_effective_applied ? 0.04 : item.gif_loop_tune_applied ? 0.02 : 0;
  const fallbackPenalty = item.gif_loop_tune_fallback_to_base ? -0.02 : 0;
  return baseScore + tuneBonus + fallbackPenalty;
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
  const [deletingOutputId, setDeletingOutputId] = useState<number | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingEmojiId, setDownloadingEmojiId] = useState<number | null>(null);
  const [feedbackSubmittingId, setFeedbackSubmittingId] = useState<number | null>(null);
  const [feedbackByEmojiId, setFeedbackByEmojiId] = useState<Record<number, VideoFeedbackAction>>({});
  const [feedbackHint, setFeedbackHint] = useState<string | null>(null);

  const emojis = useMemo(() => {
    const list = Array.isArray(result?.emojis) ? [...(result?.emojis || [])] : [];
    list.sort((a, b) => {
      const qa = computeGifQualityPriority(a);
      const qb = computeGifQualityPriority(b);
      const hasQA = qa !== null;
      const hasQB = qb !== null;
      if (hasQA !== hasQB) return hasQA ? -1 : 1;
      if (hasQA && hasQB && qa !== qb) return (qb || 0) - (qa || 0);

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

  const hasPackage = Boolean((result?.package?.file_url || "").trim());
  const canDownloadZip = emojis.length > 0;
  const needsZipRegen = canDownloadZip && !hasPackage;
  const packageStatus = resolvePackageStatus(result);
  const packageError = String(result?.metrics?.package_zip_error || "").trim();
  const packageRetryCount = Number(result?.metrics?.package_zip_retry_count || 0);
  const templateSuggestion = useMemo(() => parseQualityTemplateSuggestion(result), [result]);
  const emptyStateMessage = useMemo(() => {
    const message = (result?.message || "").trim();
    if (message) return message;
    if (result?.delivery_only) {
      return "暂无可交付结果（deliver）。";
    }
    return "暂无可展示的文件。";
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

        setError(payload.message || "任务尚未完成，暂时没有可查看的结果。");
        return;
      }

      const apiErr = await parseApiError(res);
      setError(apiErr.message || apiErr.error || "加载作品详情失败");
      setResult(null);
      setJobSnapshot(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "加载作品详情失败";
      setError(message);
      setResult(null);
      setJobSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [jobID, router]);

  useEffect(() => {
    void loadResult();
  }, [loadResult]);

  useEffect(() => {
    if (!feedbackHint) return;
    const timer = window.setTimeout(() => setFeedbackHint(null), 1800);
    return () => window.clearTimeout(timer);
  }, [feedbackHint]);

  useEffect(() => {
    const hydrated: Record<number, VideoFeedbackAction> = {};
    let latestTopPick: { id: number; at: number } | null = null;
    for (const item of emojis) {
      if (!item.id) continue;
      const action = normalizeFeedbackAction(item.feedback_action);
      if (!action) continue;
      if (action === "top_pick") {
        const at = new Date(item.feedback_at || "").getTime();
        if (!latestTopPick || at > latestTopPick.at) {
          latestTopPick = { id: item.id, at: Number.isFinite(at) ? at : 0 };
        }
        continue;
      }
      hydrated[item.id] = action;
    }
    if (latestTopPick?.id) {
      hydrated[latestTopPick.id] = "top_pick";
    }
    setFeedbackByEmojiId(hydrated);
  }, [emojis]);

  useEffect(() => {
    setFeedbackHint(null);
  }, [jobID]);

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
        throw new Error(payload.message || payload.error || "删除合集失败");
      }
      router.replace("/mine/works");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "删除合集失败";
      setError(message);
    } finally {
      setDeletingCollection(false);
      setDeleteConfirmOpen(false);
      setDeleteConfirmText("");
    }
  }, [jobID, deletingCollection, deleteConfirmName, deleteConfirmText, router]);

  const handleDeleteOutput = useCallback(
    async (emojiId: number) => {
      if (!jobID || deletingOutputId) return;
      const target = emojis.find((item) => item.id === emojiId);
      const name = target?.title || `文件 #${emojiId}`;
      if (!window.confirm(`确认删除「${name}」？此操作不可恢复，且会移除对应的 ZIP 打包文件。`)) {
        return;
      }

      setDeletingOutputId(emojiId);
      setError(null);
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/delete-output`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji_id: emojiId }),
        });
        if (res.status === 401) {
          clearAuthSession();
          router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
          return;
        }
        if (!res.ok) {
          const payload = await parseApiError(res);
          throw new Error(payload.message || payload.error || "删除作品失败");
        }
        const payload = (await res.json()) as { result?: { zip_removed?: boolean } };
        setResult((prev) => {
          if (!prev) return prev;
          const nextEmojis = (prev.emojis || []).filter((item) => item.id !== emojiId);
          const nextCollection = prev.collection
            ? {
                ...prev.collection,
                file_count: nextEmojis.length,
              }
            : prev.collection;
          return {
            ...prev,
            emojis: nextEmojis,
            collection: nextCollection,
            package: payload?.result?.zip_removed ? undefined : prev.package,
          };
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "删除作品失败";
        setError(message);
      } finally {
        setDeletingOutputId(null);
      }
    },
    [jobID, deletingOutputId, emojis, router]
  );
  const handleDownloadZip = useCallback(async () => {
    if (!jobID || downloadingZip) return;
    if (!emojis.length) {
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
        throw new Error(downloadResult.error.message || "获取 ZIP 失败");
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
      setError(message);
    } finally {
      setDownloadingZip(false);
    }
  }, [jobID, downloadingZip, emojis.length, router, result?.package?.file_name]);

  const handleDownloadEmoji = useCallback(
    async (item: VideoJobResultEmoji, index: number) => {
      if (!jobID) return;
      if (!item.id || downloadingEmojiId) return;

      setDownloadingEmojiId(item.id);
      setError(null);
      try {
        const downloadResult = await requestDownloadLink(`${API_BASE}/emojis/${item.id}/download`);
        if (!downloadResult.ok) {
          if (downloadResult.error.status === 401) {
            clearAuthSession();
            router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
            return;
          }
          throw new Error(downloadResult.error.message || "下载失败");
        }
        const fileName =
          (downloadResult.data.name || "").trim() || buildOutputDownloadName(jobID, item, index);
        triggerURLDownload(downloadResult.data.url, fileName);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "下载失败";
        setError(message);
      } finally {
        setDownloadingEmojiId(null);
      }
    },
    [jobID, downloadingEmojiId, router]
  );

  const handleSubmitFeedback = useCallback(
    async (item: VideoJobResultEmoji, action: VideoFeedbackAction) => {
      if (!jobID || !item.id || feedbackSubmittingId) return;
      const currentAction = feedbackByEmojiId[item.id];
      const submitAction: VideoFeedbackAction =
        action === "top_pick" && currentAction === "top_pick" ? "neutral" : action;

      setFeedbackSubmittingId(item.id);
      setError(null);
      setFeedbackHint(null);
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: submitAction,
            emoji_id: item.id,
            output_id: item.output_id || undefined,
            metadata: {
              source: "mine_work_detail",
              page: "mine_work_detail",
              collection_id: result?.collection?.id || undefined,
            },
          }),
        });
        if (res.status === 401) {
          clearAuthSession();
          router.replace(`/login?next=${encodeURIComponent(`/mine/works/${jobID}`)}`);
          return;
        }
        if (!res.ok) {
          const payload = await parseApiError(res);
          throw new Error(payload.message || payload.error || "反馈提交失败");
        }

        const payload = (await res.json()) as { action?: string };
        const acceptedAction = normalizeFeedbackAction(payload.action) || submitAction;
        setFeedbackByEmojiId((prev) => {
          const next = { ...prev };
          if (acceptedAction === "top_pick") {
            Object.keys(next).forEach((key) => {
              const emojiId = Number(key);
              if (next[emojiId] === "top_pick" && emojiId !== item.id) {
                delete next[emojiId];
              }
            });
          }
          next[item.id] = acceptedAction;
          return next;
        });
        const actionLabel = feedbackActionOptions.find((option) => option.action === acceptedAction)?.label || "已反馈";
        setFeedbackHint(`已记录：${actionLabel}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "反馈提交失败";
        setError(message);
      } finally {
        setFeedbackSubmittingId(null);
      }
    },
    [feedbackByEmojiId, feedbackSubmittingId, jobID, result?.collection?.id, router]
  );
  const currentPreviewIndex = previewIndex ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-400">任务 #{jobID || "-"}</div>
            <h1 className="text-2xl font-black text-slate-900">
              {(result?.collection?.title || jobSnapshot?.title || "作品详情").trim() || "作品详情"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                状态：{statusLabel(result?.status || jobSnapshot?.status)}
              </span>
              {result?.collection?.id ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                  合集 #{result.collection.id}
                </span>
              ) : null}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                文件 {emojis.length}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                排序：高价值优先
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                创建 {formatTime(result?.collection?.created_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadResult()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {loading ? "刷新中..." : "刷新"}
            </button>
            <Link href="/mine/works" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              返回列表
            </Link>
            <button
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteConfirmOpen(true);
              }}
              disabled={!deleteConfirmName}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
            >
              删除合集
            </button>
            {canDownloadZip ? (
              <button
                type="button"
                onClick={() => void handleDownloadZip()}
                disabled={downloadingZip}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {downloadingZip ? "下载中..." : "下载 ZIP"}
              </button>
            ) : (
              <span
                className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                  packageStatus === "failed"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                {packageStatus === "failed" ? "ZIP 生成失败" : "ZIP 处理中"}
              </span>
            )}
          </div>
        </div>
        {result?.package?.file_name ? (
          <div className="mt-3 text-xs text-slate-500">
            ZIP：{result.package.file_name} · {formatBytes(result.package.size_bytes)}
          </div>
        ) : null}
        {needsZipRegen ? (
          <div className="mt-2 text-xs text-slate-500">ZIP 将在下载时重新打包。</div>
        ) : null}
        {!canDownloadZip ? (
          <div
            className={`mt-3 rounded-xl border px-4 py-2 text-xs ${
              packageStatus === "failed"
                ? "border-rose-100 bg-rose-50 text-rose-700"
                : "border-slate-100 bg-slate-50 text-slate-500"
            }`}
          >
            {packageStatus === "failed"
              ? `ZIP 打包失败（已自动重试 ${Math.max(0, packageRetryCount)} 次）${packageError ? `：${packageError}` : ""}`
              : "ZIP 正在打包中，请稍后刷新页面。"}
          </div>
        ) : null}
        {templateSuggestion ? (
          <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-xs text-indigo-700">
            <div className="font-semibold">
              模板建议：{templateSuggestion.summary}
              {templateSuggestion.applied ? "（自动应用）" : "（仅建议）"}
            </div>
            {templateSuggestion.sourceBucketSummary ? (
              <div className="mt-1 text-indigo-600/80">{templateSuggestion.sourceBucketSummary}</div>
            ) : null}
            {templateSuggestion.reasons.length ? (
              <div className="mt-2 text-indigo-600/90">{templateSuggestion.reasons.join("；")}</div>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>
        ) : null}
        {feedbackHint ? (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            {feedbackHint}
          </div>
        ) : null}
        {jobSnapshot && !emojis.length ? (
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            当前进度：{Math.max(0, Math.min(100, Number(jobSnapshot.progress || 0)))}% · 阶段：
            {(jobSnapshot.stage || "-").trim() || "-"}
          </div>
        ) : null}
      </div>

      {loading && !emojis.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div key={`skeleton-${idx}`} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="aspect-square rounded-xl bg-slate-100" />
              <div className="mt-3 h-4 w-2/3 rounded bg-slate-100" />
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          {emojis.map((item, idx) => {
            const previewURL = resolvePreviewURL(item);
            const imageOutput = isImageOutput(item);
            const fileURL = (item.file_url || "").trim();
            const format = normalizeFormat(item.format) || inferFormatFromURL(fileURL) || "file";
            return (
              <div key={item.id || `${fileURL}-${idx}`} className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <button
                  type="button"
                  onClick={() => setPreviewIndex(idx)}
                  disabled={!previewURL}
                  className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 disabled:cursor-not-allowed"
                >
                  {previewURL ? (
                    imageOutput ? (
                      <FallbackImage
                        url={previewURL}
                        alt={item.title || `output-${idx + 1}`}
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {format}
                      </div>
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-300">无预览</div>
                  )}
                </button>

                <div className="mt-3 space-y-1">
                  <div className="line-clamp-1 text-sm font-semibold text-slate-800">{(item.title || `文件 ${idx + 1}`).trim() || `文件 ${idx + 1}`}</div>
                  <div className="text-[11px] text-slate-500">
                    {format.toUpperCase()} · {formatBytes(item.size_bytes)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {item.width && item.height ? `${item.width} × ${item.height}` : "-"}
                  </div>
                  {format === "gif" ? (
                    <div className="text-[11px] text-slate-400">
                      评分 {formatMetric(item.output_score, 3)} · 闭环 {formatMetric(item.gif_loop_tune_loop_closure, 3)} · 运动 {formatMetric(item.gif_loop_tune_motion_mean, 3)}
                    </div>
                  ) : null}
                  {format === "gif" && item.gif_loop_tune_applied ? (
                    <div className="text-[11px] text-indigo-600">
                      LoopTune：{item.gif_loop_tune_effective_applied ? "生效" : item.gif_loop_tune_fallback_to_base ? "回退" : "已应用"} · 时长 {formatMetric(item.gif_loop_tune_effective_sec, 2)}s
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(idx)}
                    disabled={!previewURL}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-50"
                  >
                    预览
                  </button>
                  {fileURL ? (
                    <button
                      type="button"
                      onClick={() => void handleDownloadEmoji(item, idx)}
                      disabled={downloadingEmojiId === item.id}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                    >
                      {downloadingEmojiId === item.id ? "下载中..." : "下载"}
                    </button>
                  ) : (
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-400">
                      无下载
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteOutput(item.id)}
                    disabled={deletingOutputId === item.id}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                  >
                    {deletingOutputId === item.id ? "删除中..." : "删除"}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {feedbackActionOptions.map((option) => {
                    const selected = feedbackByEmojiId[item.id] === option.action;
                    return (
                      <button
                        key={`${item.id}-${option.action}`}
                        type="button"
                        onClick={() => void handleSubmitFeedback(item, option.action)}
                        disabled={feedbackSubmittingId === item.id}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                          selected
                            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                        } disabled:opacity-60`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
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
                {(previewItem.file_url || "").trim() ? (
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
