"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  API_BASE,
  clearAuthSession,
  ensureAuthSession,
  fetchWithAuthRetry,
} from "@/lib/auth-client";

type VideoJobItem = {
  id: number;
  title: string;
  source_video_key: string;
  source_video_url?: string;
  status: string;
  stage: string;
  progress: number;
  priority?: string;
  result_collection_id?: number;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
  output_formats?: string[];
  options?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
};

type VideoJobListResponse = {
  items?: VideoJobItem[];
};

type UploadTokenResponse = {
  token: string;
  key?: string;
  up_host?: string;
};

type VideoFormatCapability = {
  format: string;
  supported: boolean;
  reason?: string;
};

type VideoCapabilitiesResponse = {
  ffmpeg_available?: boolean;
  ffprobe_available?: boolean;
  supported_formats?: string[];
  unsupported_formats?: string[];
  formats?: VideoFormatCapability[];
};

type CreateJobErrorPayload = {
  error?: string;
  message?: string;
  reason_code?: string;
  hint?: string;
  max_duration_sec?: number;
  required_points?: number;
  available_points?: number;
  rejected_formats?: Array<{
    format?: string;
    reason?: string;
  }>;
  supported_formats?: string[];
};

type SourceVideoProbe = {
  duration_sec?: number;
  width?: number;
  height?: number;
  fps?: number;
};

type SourceVideoProbeResponse = {
  source_video_key?: string;
  format?: string;
  mime_type?: string;
  size_bytes?: number;
  duration_sec?: number;
  width?: number;
  height?: number;
  fps?: number;
  aspect_ratio?: string;
  orientation?: string;
};

type SourceURLProbeResponse = {
  source_url?: string;
  normalized_url?: string;
  provider?: string;
  provider_label?: string;
  source_type?: string;
  mock_only?: boolean;
  supported?: boolean;
  needs_ingestion?: boolean;
  message?: string;
};

type UploadVideoInsight = {
  source_video_key?: string;
  file_name?: string;
  format?: string;
  mime_type?: string;
  size_bytes?: number;
  duration_sec?: number;
  width?: number;
  height?: number;
  fps?: number;
  aspect_ratio?: string;
  orientation?: string;
  source?: "local" | "server";
};

type SourceInputMode = "local_upload" | "external_url_mock";

type QualityTemplateSuggestion = {
  applied: boolean;
  appliedSource: string;
  summary: string;
  sourceBucketSummary: string;
  reasons: string[];
};

const STATUS_LABEL: Record<string, string> = {
  queued: "排队中",
  running: "处理中",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const STAGE_LABEL: Record<string, string> = {
  queued: "排队",
  preprocessing: "预处理",
  analyzing: "分析",
  briefing: "AI1 简报",
  planning: "AI2 方案",
  scoring: "评分",
  rendering: "渲染",
  reviewing: "AI3 复审",
  uploading: "上传",
  indexing: "入库",
  retrying: "重试",
  done: "完成",
  failed: "失败",
  cancelled: "已取消",
};

const STAGE_PROGRESS_FLOOR: Record<string, number> = {
  queued: 5,
  preprocessing: 8,
  analyzing: 30,
  briefing: 36,
  planning: 44,
  scoring: 52,
  rendering: 70,
  reviewing: 82,
  uploading: 86,
  indexing: 92,
  retrying: 45,
};

const OUTPUT_FORMAT_OPTIONS = [
  { value: "gif", label: "GIF（当前主线）" },
] as const;

function formatTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN");
}

function parseTimestamp(value?: string) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  return ts;
}

function ageSecondsFromNow(value?: string, nowMs = Date.now()) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  return Math.max(0, Math.floor((nowMs - ts) / 1000));
}

function formatAgeLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "刚刚";
  if (seconds < 60) return `${seconds}s前`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remain}s前`;
  const hours = Math.floor(minutes / 60);
  const minutesRemain = minutes % 60;
  return `${hours}h ${minutesRemain}m前`;
}

function formatBytes(value?: number) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024) return `${size.toFixed(0)} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function aspectRatioFromSize(width?: number, height?: number) {
  if (!width || !height || width <= 0 || height <= 0) return "";
  let a = Math.round(width);
  let b = Math.round(height);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  if (!a) return "";
  return `${Math.round(width) / a}:${Math.round(height) / a}`;
}

function orientationBySize(width?: number, height?: number) {
  if (!width || !height || width <= 0 || height <= 0) return "";
  if (width > height) return "横屏";
  if (width < height) return "竖屏";
  return "方形";
}

function orientationLabel(raw?: string) {
  const value = (raw || "").trim().toLowerCase();
  if (!value) return "";
  if (value === "landscape") return "横屏";
  if (value === "portrait") return "竖屏";
  if (value === "square") return "方形";
  return raw || "";
}

async function probeLocalVideoFile(file: File): Promise<Partial<UploadVideoInsight>> {
  const format = file.name.split(".").pop()?.toLowerCase() || "";
  const base: Partial<UploadVideoInsight> = {
    file_name: file.name || "",
    format,
    mime_type: file.type || mimeTypeByVideoFormat(format),
    size_bytes: Number(file.size || 0),
    source: "local",
  };

  return await new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const objectURL = URL.createObjectURL(file);
    const finalize = (extra?: Partial<UploadVideoInsight>) => {
      URL.revokeObjectURL(objectURL);
      resolve({
        ...base,
        ...extra,
      });
    };
    video.onloadedmetadata = () => {
      const width = Number(video.videoWidth || 0);
      const height = Number(video.videoHeight || 0);
      finalize({
        duration_sec: Number.isFinite(video.duration) && video.duration > 0 ? Number(video.duration.toFixed(2)) : 0,
        width: width > 0 ? width : undefined,
        height: height > 0 ? height : undefined,
        aspect_ratio: aspectRatioFromSize(width, height),
        orientation: orientationBySize(width, height),
      });
    };
    video.onerror = () => finalize({});
    video.src = objectURL;
  });
}

function mimeTypeByVideoFormat(format?: string) {
  switch ((format || "").trim().toLowerCase()) {
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "mkv":
      return "video/x-matroska";
    case "webm":
      return "video/webm";
    case "avi":
      return "video/x-msvideo";
    case "mpeg":
    case "mpg":
      return "video/mpeg";
    case "wmv":
      return "video/x-ms-wmv";
    case "flv":
      return "video/x-flv";
    case "3gp":
      return "video/3gpp";
    case "ts":
    case "mts":
    case "m2ts":
      return "video/mp2t";
    default:
      return "video/*";
  }
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function makeVideoKey(fileName: string) {
  const safe = sanitizeFileName(fileName || "video.mp4") || "video.mp4";
  const date = new Date();
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `emoji/user-video/${y}${m}${d}/${Date.now()}-${safe}`;
}

function parseFormatList(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const format = item.trim().toLowerCase();
    if (!format || seen.has(format)) continue;
    seen.add(format);
    out.push(format);
  }
  return out;
}

function resolveRequestedFormats(item: VideoJobItem) {
  const fromMetrics = parseFormatList(item.metrics?.output_formats_requested);
  if (fromMetrics.length) return fromMetrics;
  return parseFormatList(item.output_formats);
}

function resolveGeneratedFormats(item: VideoJobItem) {
  const fromMetrics = parseFormatList(item.metrics?.output_formats);
  if (fromMetrics.length) return fromMetrics;
  return parseFormatList(item.output_formats);
}

function resolveSourceVideoProbe(item: VideoJobItem): SourceVideoProbe | null {
  const raw = item.options?.source_video_probe;
  if (!raw || typeof raw !== "object") return null;
  const probe = raw as Record<string, unknown>;
  const out: SourceVideoProbe = {};
  if (typeof probe.duration_sec === "number" && Number.isFinite(probe.duration_sec) && probe.duration_sec > 0) {
    out.duration_sec = probe.duration_sec;
  }
  if (typeof probe.width === "number" && Number.isFinite(probe.width) && probe.width > 0) {
    out.width = Math.round(probe.width);
  }
  if (typeof probe.height === "number" && Number.isFinite(probe.height) && probe.height > 0) {
    out.height = Math.round(probe.height);
  }
  if (typeof probe.fps === "number" && Number.isFinite(probe.fps) && probe.fps > 0) {
    out.fps = probe.fps;
  }
  if (!out.duration_sec && !out.width && !out.height && !out.fps) return null;
  return out;
}

function formatProbeMeta(probe: SourceVideoProbe | null) {
  if (!probe) return "";
  const parts: string[] = [];
  if (probe.width && probe.height) {
    parts.push(`${probe.width}x${probe.height}`);
  }
  if (probe.fps) {
    parts.push(`${probe.fps.toFixed(1)}fps`);
  }
  if (probe.duration_sec) {
    parts.push(`${probe.duration_sec.toFixed(1)}s`);
  }
  return parts.join(" · ");
}

function mapQualityProfileLabel(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value === "size") return "体积优先";
  if (value === "clarity") return "清晰优先";
  return raw;
}

function parseQualityTemplateSuggestion(item: VideoJobItem): QualityTemplateSuggestion | null {
  const options = item.options;
  if (!options || typeof options !== "object") return null;
  const recommendationRaw = options.quality_template_recommendation;
  if (!recommendationRaw || typeof recommendationRaw !== "object") return null;
  const recommendation = recommendationRaw as Record<string, unknown>;

  const profilesRaw = recommendation.recommended_profiles;
  if (!profilesRaw || typeof profilesRaw !== "object") return null;
  const profiles = profilesRaw as Record<string, unknown>;

  const profilePairs: string[] = [];
  for (const [formatRaw, profileRaw] of Object.entries(profiles)) {
    const format = formatRaw.trim().toLowerCase();
    if (!format || typeof profileRaw !== "string") continue;
    const profile = profileRaw.trim();
    if (!profile) continue;
    profilePairs.push(`${format.toUpperCase()}=${mapQualityProfileLabel(profile)}`);
  }
  if (!profilePairs.length) return null;

  const sourceBucketSummaryParts: string[] = [];
  const sourceBucketsRaw = recommendation.source_buckets;
  if (sourceBucketsRaw && typeof sourceBucketsRaw === "object") {
    const sourceBuckets = sourceBucketsRaw as Record<string, unknown>;
    const duration = typeof sourceBuckets.duration === "string" ? sourceBuckets.duration.trim() : "";
    const resolution = typeof sourceBuckets.resolution === "string" ? sourceBuckets.resolution.trim() : "";
    const fps = typeof sourceBuckets.fps === "string" ? sourceBuckets.fps.trim() : "";
    if (duration) sourceBucketSummaryParts.push(`时长桶 ${duration}`);
    if (resolution) sourceBucketSummaryParts.push(`分辨率桶 ${resolution}`);
    if (fps) sourceBucketSummaryParts.push(`帧率桶 ${fps}`);
  }

  const reasons: string[] = [];
  const reasonsRaw = recommendation.reasons;
  if (Array.isArray(reasonsRaw)) {
    for (const item of reasonsRaw) {
      if (typeof item !== "string") continue;
      const reason = item.trim();
      if (!reason) continue;
      reasons.push(reason);
    }
  }

  const appliedSource = typeof options.quality_template_applied === "string" ? options.quality_template_applied.trim().toLowerCase() : "";
  return {
    applied: appliedSource === "auto_recommendation",
    appliedSource,
    summary: profilePairs.join("；"),
    sourceBucketSummary: sourceBucketSummaryParts.join(" · "),
    reasons,
  };
}

function buildInvalidSourceVideoMessage(payload: CreateJobErrorPayload | null) {
  const reasonCode = (payload?.reason_code || "").trim().toLowerCase();
  const hint = (payload?.hint || "").trim();
  let message = (payload?.message || "").trim();
  switch (reasonCode) {
    case "video_stream_missing":
      message = "未检测到有效视频画面流";
      break;
    case "video_duration_invalid":
      message = "视频时长信息读取失败";
      break;
    case "video_duration_too_long": {
      const maxHours =
        typeof payload?.max_duration_sec === "number" && Number.isFinite(payload.max_duration_sec)
          ? payload.max_duration_sec / 3600
          : 0;
      message = maxHours > 0 ? `视频时长超过当前处理上限（${maxHours.toFixed(0)} 小时）` : "视频时长超过当前处理上限";
      break;
    }
    case "video_probe_timeout":
      message = "视频探测超时，请稍后重试";
      break;
    case "video_storage_unavailable":
      message = "视频存储服务暂时不可用";
      break;
    case "video_corrupted":
      message = "视频文件可能损坏或编码异常";
      break;
    default:
      if (!message) message = "源视频无法识别，请更换文件后重试";
      break;
  }
  if (hint) {
    return `${message}。${hint}`;
  }
  return message;
}

export default function CreatePage() {
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  // 首帧保持稳定，避免 SSR/CSR 时间戳差异导致 hydration mismatch。
  const [nowTickMs, setNowTickMs] = useState(0);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobs, setJobs] = useState<VideoJobItem[]>([]);
  const [sourceInputMode, setSourceInputMode] = useState<SourceInputMode>("local_upload");
  const [sourceVideoKey, setSourceVideoKey] = useState("");
  const [sourceVideoInfo, setSourceVideoInfo] = useState<UploadVideoInsight | null>(null);
  const [sourceURLInput, setSourceURLInput] = useState("");
  const [sourceURLProbe, setSourceURLProbe] = useState<SourceURLProbeResponse | null>(null);
  const [probingSourceURL, setProbingSourceURL] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>("gif");
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<"idle" | "analyzing" | "uploading" | "probing" | "done">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [probingSourceVideo, setProbingSourceVideo] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<VideoCapabilitiesResponse | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);

  const hasRunningJob = useMemo(
    () => jobs.some((item) => item.status === "queued" || item.status === "running"),
    [jobs]
  );
  const reusableJobs = useMemo(
    () =>
      [...jobs]
        .filter((item) => item.status === "done" && Number(item.result_collection_id || 0) > 0)
        .sort((a, b) => parseTimestamp(b.updated_at || b.created_at) - parseTimestamp(a.updated_at || a.created_at))
        .slice(0, 3),
    [jobs]
  );
  const longQueuedJobs = useMemo(
    () => jobs.filter((item) => item.status === "queued" && ageSecondsFromNow(item.created_at, nowTickMs) >= 120),
    [jobs, nowTickMs]
  );
  const capabilityMap = useMemo(() => {
    const map = new Map<string, VideoFormatCapability>();
    for (const item of capabilities?.formats || []) {
      const format = item?.format?.trim().toLowerCase();
      if (!format) continue;
      map.set(format, item);
    }
    return map;
  }, [capabilities]);
  const unsupportedFormats = useMemo(() => {
    const allowed = new Set<string>(OUTPUT_FORMAT_OPTIONS.map((item) => item.value));
    const fromPayload = parseFormatList(capabilities?.unsupported_formats);
    if (fromPayload.length) {
      return fromPayload.filter((item) => allowed.has(item));
    }
    const out: string[] = [];
    for (const option of OUTPUT_FORMAT_OPTIONS) {
      const capability = capabilityMap.get(option.value);
      if (capability && capability.supported === false) {
        out.push(option.value);
      }
    }
    return out;
  }, [capabilities?.unsupported_formats, capabilityMap]);

  const checkAuth = useCallback(async () => {
    const ok = await ensureAuthSession();
    setIsAuthed(ok);
    setAuthReady(true);
    return ok;
  }, []);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setError(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs?limit=30`);
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        setJobs([]);
        return;
      }
      if (!res.ok) {
        throw new Error((await res.text()) || "加载任务失败");
      }
      const data = (await res.json()) as VideoJobListResponse;
      setJobs(Array.isArray(data.items) ? data.items : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "加载任务失败";
      setError(msg);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const loadCapabilities = useCallback(async () => {
    setLoadingCapabilities(true);
    setCapabilitiesError(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/capabilities`);
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        setCapabilities(null);
        return;
      }
      if (!res.ok) {
        throw new Error((await res.text()) || "加载服务器能力失败");
      }
      const data = (await res.json()) as VideoCapabilitiesResponse;
      setCapabilities(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "加载服务器能力失败";
      setCapabilitiesError(msg);
    } finally {
      setLoadingCapabilities(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth().then((ok) => {
      if (ok) {
        void loadJobs();
        void loadCapabilities();
      }
    });
  }, [checkAuth, loadCapabilities, loadJobs]);

  useEffect(() => {
    if (!capabilityMap.size) return;
    if (capabilityMap.get(selectedFormat)?.supported !== false) return;
    const firstSupported = OUTPUT_FORMAT_OPTIONS.find((option) => capabilityMap.get(option.value)?.supported !== false);
    if (firstSupported) {
      setSelectedFormat(firstSupported.value);
    }
  }, [capabilityMap, selectedFormat]);

  useEffect(() => {
    setNowTickMs(Date.now());
  }, []);

  useEffect(() => {
    if (!isAuthed || !hasRunningJob) return;
    setNowTickMs(Date.now());
    const timer = window.setInterval(() => {
      setNowTickMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasRunningJob, isAuthed]);

  useEffect(() => {
    if (!isAuthed || !hasRunningJob) return;
    const refresh = () => {
      void loadJobs();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refresh();
    }, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hasRunningJob, isAuthed, loadJobs]);

  const createJobBySourceKey = useCallback(
    async (videoKey: string) => {
      const key = videoKey.trim();
      if (!key) {
        setError("请先上传视频");
        return;
      }

      setCreating(true);
      setMessage("已确认视频，正在创建任务...");
      setError(null);

      try {
        const normalizedFormat = selectedFormat.trim().toLowerCase();
        if (normalizedFormat !== "gif") {
          setError("当前阶段仅支持 GIF 输出，请切换为 GIF 后重试。");
          return;
        }
        if (capabilityMap.get("gif")?.supported === false) {
          setError("当前服务器暂不支持 GIF 处理，请先恢复 GIF 能力。");
          return;
        }
        const payload: Record<string, unknown> = {
          source_video_key: key,
          auto_highlight: true,
          output_formats: ["gif"],
        };

        const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 401) {
          clearAuthSession();
          setIsAuthed(false);
          setError("请先登录后创建任务");
          return;
        }

        if (!res.ok) {
          let payload: CreateJobErrorPayload | null = null;
          try {
            payload = (await res.json()) as CreateJobErrorPayload;
          } catch {
            payload = null;
          }
          if (res.status === 402 && payload?.error === "insufficient_compute_points") {
            const required = typeof payload.required_points === "number" ? payload.required_points : 0;
            const available = typeof payload.available_points === "number" ? payload.available_points : 0;
            throw new Error(`算力点不足（需要 ${required}，可用 ${available}）`);
          }
          if (res.status === 400 && payload?.error === "unsupported_output_format") {
            const rejected = Array.isArray(payload.rejected_formats) ? payload.rejected_formats : [];
            if (!rejected.length) {
              throw new Error(payload?.message || "请求包含当前服务器不支持的格式");
            }
            const reasonSummary = rejected
              .map((item) => {
                const format = (item?.format || "").toUpperCase();
                const reason = item?.reason || "该格式当前不可用";
                return `${format || "未知格式"}（${reason}）`;
              })
              .join("；");
            throw new Error(`部分格式当前不可用：${reasonSummary}`);
          }
          if (res.status === 400 && payload?.error === "invalid_source_video") {
            throw new Error(buildInvalidSourceVideoMessage(payload));
          }
          const fallback = payload?.message || payload?.error || "创建任务失败";
          throw new Error(fallback);
        }

        const created = (await res.json()) as VideoJobItem;
        setJobs((prev) => [created, ...prev]);
        const probeSummary = formatProbeMeta(resolveSourceVideoProbe(created));
        const templateSuggestion = parseQualityTemplateSuggestion(created);
        const messageParts = ["任务已创建"];
        if (probeSummary) {
          messageParts.push(`已识别视频：${probeSummary}`);
        }
        if (templateSuggestion) {
          messageParts.push(
            `模板建议：${templateSuggestion.summary}${templateSuggestion.applied ? "（已自动应用）" : "（仅建议）"}`
          );
        }
        setMessage(`${messageParts.join("，")}，系统正在分析高光并生成表情包。上传区域已重置，你可以继续上传新视频。`);
        setSourceVideoKey("");
        setSourceVideoInfo(null);
        setUploadStage("idle");
        setUploadProgress(0);
        void loadJobs();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "创建任务失败";
        setError(`${msg}，请确认后重试。`);
      } finally {
        setCreating(false);
      }
    },
    [capabilityMap, loadJobs, selectedFormat]
  );

  const probeUploadedSourceVideo = useCallback(async (videoKey: string) => {
    const key = videoKey.trim();
    if (!key) return;
    setProbingSourceVideo(true);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/source-probe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_video_key: key }),
      });
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        return;
      }
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as SourceVideoProbeResponse;
      setSourceVideoInfo((prev) => ({
        ...(prev || {}),
        source: "server",
        source_video_key: key,
        format: data.format || prev?.format || "",
        mime_type: data.mime_type || prev?.mime_type || "",
        size_bytes: data.size_bytes || prev?.size_bytes || 0,
        duration_sec: data.duration_sec || prev?.duration_sec || 0,
        width: data.width || prev?.width || 0,
        height: data.height || prev?.height || 0,
        fps: data.fps || prev?.fps || 0,
        aspect_ratio: data.aspect_ratio || prev?.aspect_ratio || aspectRatioFromSize(data.width, data.height),
        orientation: orientationLabel(data.orientation) || prev?.orientation || orientationBySize(data.width, data.height),
      }));
    } catch {
      // ignore probe fallback, keep local metadata
    } finally {
      setProbingSourceVideo(false);
    }
  }, []);

  const probeExternalSourceURLMock = useCallback(async () => {
    const rawURL = sourceURLInput.trim();
    if (!rawURL) {
      setError("请先输入视频链接");
      return;
    }
    setProbingSourceURL(true);
    setMessage(null);
    setError(null);
    setSourceURLProbe(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/source-url-probe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: rawURL }),
      });
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        return;
      }
      if (!res.ok) {
        throw new Error((await res.text()) || "链接解析失败");
      }
      const data = (await res.json()) as SourceURLProbeResponse;
      setSourceURLProbe(data);
      setMessage(data.message || "链接已解析（Mock占位）");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "链接解析失败";
      setError(msg);
    } finally {
      setProbingSourceURL(false);
    }
  }, [sourceURLInput]);

  const uploadVideoFile = async (file: File) => {
    setUploading(true);
    setUploadStage("analyzing");
    setUploadProgress(0);
    setMessage(null);
    setError(null);
    setSourceURLProbe(null);
    setSourceVideoKey("");
    setSourceVideoInfo(null);

    try {
      const localInsight = await probeLocalVideoFile(file);
      setSourceVideoInfo({
        ...localInsight,
        file_name: file.name || localInsight.file_name || "",
        format: (localInsight.format || file.name.split(".").pop() || "").toLowerCase(),
        mime_type: localInsight.mime_type || file.type || mimeTypeByVideoFormat(file.name.split(".").pop()),
        size_bytes: Number(file.size || localInsight.size_bytes || 0),
        source: "local",
      });

      setUploadStage("uploading");
      const key = makeVideoKey(file.name);
      const tokenRes = await fetchWithAuthRetry(`${API_BASE}/storage/upload-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, insert_only: true }),
      });
      if (tokenRes.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        throw new Error("请先登录后上传视频");
      }
      if (!tokenRes.ok) {
        throw new Error((await tokenRes.text()) || "获取上传凭证失败");
      }

      const tokenData = (await tokenRes.json()) as UploadTokenResponse;
      const uploadKey = tokenData.key || key;
      const upHost = tokenData.up_host || "https://up.qiniup.com";

      await new Promise<void>((resolve, reject) => {
        const form = new FormData();
        form.append("file", file);
        form.append("token", tokenData.token);
        form.append("key", uploadKey);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", upHost, true);
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
            return;
          }
          reject(new Error(xhr.responseText || "上传失败"));
        };
        xhr.onerror = () => reject(new Error("上传失败"));
        xhr.send(form);
      });

      setSourceVideoKey(uploadKey);
      setSourceVideoInfo((prev) => ({ ...(prev || {}), source_video_key: uploadKey }));
      setUploadStage("probing");
      await probeUploadedSourceVideo(uploadKey);
      setUploadStage("done");
      setMessage("视频上传成功，请点击“确认创建任务”开始生成 GIF。");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败";
      setError(msg);
      setUploadStage("idle");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateJob = async () => {
    if (sourceInputMode !== "local_upload") {
      setError("链接模式当前为 Mock 占位，暂不支持直接创建任务。请先切换到“本地上传”后创建任务。");
      return;
    }
    await createJobBySourceKey(sourceVideoKey);
  };

  const handleCancelJob = async (jobID: number) => {
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/cancel`, {
        method: "POST",
      });
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        setError("登录已失效，请重新登录");
        return;
      }
      if (!res.ok) {
        throw new Error((await res.text()) || "取消任务失败");
      }
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "取消任务失败";
      setError(msg);
    }
  };

  if (!authReady) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">正在验证登录状态...</div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-8 text-center">
          <h1 className="text-2xl font-black text-slate-900">创作表情包</h1>
          <p className="mt-3 text-sm text-slate-600">请先登录，再上传视频并创建异步任务。</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href={`/login?next=${encodeURIComponent("/create")}`}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white"
            >
              去登录
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-700"
            >
              去注册
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">创作表情包</h1>
        <p className="mt-2 text-sm text-slate-500">
          先上传并识别视频信息，再手动确认创建任务。任务提交后可异步处理，关闭页面也不会中断。
        </p>

        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-700">
          建议流程：上传视频 → 查看识别信息卡片 → 确认创建任务（GIF）→ 等待任务完成。
        </div>

        <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-sky-800">
          <div className="font-semibold">隐私与存储说明</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-sky-700">
            <li>源视频仅用于本次处理，任务完成后自动清理，不做长期保留。</li>
            <li>生成结果会持久化保存（除非你主动删除或策略过期清理）。</li>
          </ul>
        </div>

        {reusableJobs.length ? (
          <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-amber-800">可直接复用历史结果（无需重复上传）</div>
              <Link href="/mine/works" className="text-xs font-semibold text-amber-700 hover:text-amber-800">
                查看全部结果
              </Link>
            </div>
            <div className="mt-2 space-y-2">
              {reusableJobs.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white/80 px-3 py-2">
                  <div className="text-xs text-slate-700">
                    任务 #{item.id} · {item.title || "未命名任务"} · {formatTime(item.created_at)}
                  </div>
                  <Link
                    href={`/mine/works/${item.id}`}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                  >
                    直接使用结果
                  </Link>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-amber-700">如果是同一视频再次导出，优先使用历史结果更省时省成本。</div>
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-slate-700">
            输出格式（当前阶段仅 GIF）
            {loadingCapabilities ? <span className="ml-2 text-xs font-normal text-slate-400">（检测服务器能力中...）</span> : null}
          </div>
          {capabilitiesError ? (
            <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              服务器能力检测失败：{capabilitiesError}
            </div>
          ) : null}
          {capabilities && capabilities.ffmpeg_available === false ? (
            <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              当前服务器未检测到 ffmpeg，暂时无法处理视频任务。
            </div>
          ) : null}
          {unsupportedFormats.length ? (
            <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              当前服务器暂不支持：{unsupportedFormats.join(" / ")}，这些格式会自动禁用。
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {OUTPUT_FORMAT_OPTIONS.map((option) => {
              const active = selectedFormat === option.value;
              const capability = capabilityMap.get(option.value);
              const disabled = capability?.supported === false;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => (disabled ? null : setSelectedFormat(option.value))}
                  disabled={disabled}
                  title={disabled ? capability?.reason || "服务器暂不支持该格式" : ""}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    disabled
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      :
                    active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            为保证质量闭环，主创作入口当前仅开放 GIF。
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSourceInputMode("local_upload");
                setMessage(null);
                setError(null);
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                sourceInputMode === "local_upload"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              本地上传（已上线）
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceInputMode("external_url_mock");
                setMessage(null);
                setError(null);
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                sourceInputMode === "external_url_mock"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              在线链接（Mock占位）
            </button>
          </div>

          {sourceInputMode === "local_upload" ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo,video/mpeg,video/x-ms-wmv,video/x-flv,video/3gpp,video/mp2t,.m4v,.mts,.m2ts,.mpg"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void uploadVideoFile(file);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  {uploading ? "上传中..." : "选择视频并上传"}
                </label>

                {(uploading || probingSourceVideo || uploadStage === "done") && (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600">
                    {(uploading || probingSourceVideo) ? (
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
                    ) : (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    )}
                    {uploadStage === "analyzing" ? "正在识别视频信息..." : null}
                    {uploadStage === "uploading" ? `上传进度 ${uploadProgress}%` : null}
                    {uploadStage === "probing" ? "上传完成，正在进行服务端探测..." : null}
                    {uploadStage === "done" ? "上传与识别完成，可确认创建任务" : null}
                  </span>
                )}
              </div>

              {(uploading || probingSourceVideo || uploadStage === "done") && (
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
                    {uploadStage === "uploading" ? (
                      <div
                        className="upload-progress-fill h-full rounded bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.max(2, Math.min(100, uploadProgress || 0))}%` }}
                      />
                    ) : uploadStage === "done" ? (
                      <div className="h-full w-full rounded bg-emerald-500" />
                    ) : (
                      <div className="upload-progress-indeterminate h-full w-1/3 rounded bg-emerald-500/80" />
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <div className="text-xs font-semibold text-slate-500">已上传视频</div>
                <div className="mt-1 break-all">{sourceVideoKey || "请先选择并上传视频文件"}</div>
              </div>

              {sourceVideoInfo ? (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-emerald-700">视频信息卡片</div>
                    <div className="text-xs text-emerald-600">
                      识别来源：{sourceVideoInfo.source === "server" ? "服务端 ffprobe" : "浏览器本地"}
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs text-slate-700 md:grid-cols-3">
                    <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-400">文件名</div>
                      <div className="mt-1 break-all">{sourceVideoInfo.file_name || "-"}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-400">格式 / MIME</div>
                      <div className="mt-1">
                        {(sourceVideoInfo.format || "-").toUpperCase()} · {sourceVideoInfo.mime_type || "-"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-400">大小</div>
                      <div className="mt-1">{formatBytes(sourceVideoInfo.size_bytes)}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-400">时长</div>
                      <div className="mt-1">
                        {sourceVideoInfo.duration_sec && sourceVideoInfo.duration_sec > 0
                          ? `${sourceVideoInfo.duration_sec.toFixed(1)}s`
                          : "-"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-400">分辨率 / 尺寸</div>
                      <div className="mt-1">
                        {sourceVideoInfo.width && sourceVideoInfo.height
                          ? `${sourceVideoInfo.width} x ${sourceVideoInfo.height}`
                          : "-"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                      <div className="text-[11px] text-slate-400">比例 / 方向 / 帧率</div>
                      <div className="mt-1">
                        {sourceVideoInfo.aspect_ratio || "-"} · {sourceVideoInfo.orientation || "-"} ·{" "}
                        {sourceVideoInfo.fps && sourceVideoInfo.fps > 0 ? `${sourceVideoInfo.fps.toFixed(1)}fps` : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                在线链接当前为 Mock 占位：支持解析平台类型与链接规范化，不会直接创建任务。
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  value={sourceURLInput}
                  onChange={(e) => setSourceURLInput(e.target.value)}
                  placeholder="粘贴视频分享链接（抖音/快手/小红书/B站等）"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => void probeExternalSourceURLMock()}
                  disabled={probingSourceURL || !sourceURLInput.trim()}
                  className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                >
                  {probingSourceURL ? "解析中..." : "解析链接（Mock）"}
                </button>
              </div>
              {sourceURLProbe ? (
                <div className="rounded-xl border border-amber-100 bg-white px-4 py-3 text-xs text-slate-700">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="text-slate-400">平台</div>
                      <div className="mt-1 font-semibold">
                        {sourceURLProbe.provider_label || sourceURLProbe.provider || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">链接类型</div>
                      <div className="mt-1 font-semibold">{sourceURLProbe.source_type || "-"}</div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-slate-400">规范化链接</div>
                      <div className="mt-1 break-all">{sourceURLProbe.normalized_url || "-"}</div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-slate-400">说明</div>
                      <div className="mt-1">{sourceURLProbe.message || "Mock占位"}</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void handleCreateJob()}
            disabled={
              creating ||
              uploading ||
              probingSourceVideo ||
              sourceInputMode !== "local_upload" ||
              !sourceVideoKey.trim()
            }
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {creating
              ? "创建中..."
              : sourceInputMode === "local_upload"
                ? "确认创建任务"
                : "链接模式（Mock占位）"}
          </button>
          <button
            onClick={() => void loadJobs()}
            disabled={loadingJobs}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-bold text-slate-700"
          >
            刷新任务
          </button>
          <Link href="/mine/works" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
            去我的作品
          </Link>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {sourceInputMode === "local_upload"
            ? "上传完成后不会自动提交任务，请先确认视频信息，再点击“确认创建任务”。"
            : "在线链接当前仅做解析占位，不直接创建任务。"}
        </div>

        {message && <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
        {error && <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {longQueuedJobs.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            有 {longQueuedJobs.length} 个任务排队超过 2 分钟。通常是队列繁忙或工作进程尚未接单，请稍后刷新任务列表。
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">我的任务</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">进度</th>
                <th className="px-4 py-3">结果合集</th>
                <th className="px-4 py-3">创建时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((item) => {
                const requestedFormats = resolveRequestedFormats(item);
                const generatedFormats = resolveGeneratedFormats(item);
                const missingFormats = requestedFormats.filter((format) => !generatedFormats.includes(format));
                const probeSummary = formatProbeMeta(resolveSourceVideoProbe(item));
                const templateSuggestion = parseQualityTemplateSuggestion(item);
                const rawProgress = Math.max(0, Math.min(100, item.progress || 0));
                const isActive = item.status === "queued" || item.status === "running";
                const isDone = item.status === "done";
                const stageKey = (item.stage || "").trim().toLowerCase();
                const stageLabel = STAGE_LABEL[stageKey] || item.stage || "-";
                const stageFloor = STAGE_PROGRESS_FLOOR[stageKey] || 0;
                let displayProgress = rawProgress;
                if (isDone) {
                  displayProgress = 100;
                } else if (isActive) {
                  displayProgress = Math.max(rawProgress, stageFloor, 1);
                  displayProgress = Math.min(displayProgress, 96);
                }
                const progress = Math.round(Math.max(0, Math.min(100, displayProgress)));
                const isIndeterminate = isActive && rawProgress <= 0 && stageFloor <= 0;
                const updatedAgeSeconds = ageSecondsFromNow(item.updated_at || item.created_at, nowTickMs);
                const updatedAgeLabel = formatAgeLabel(updatedAgeSeconds);
                const staleActive = isActive && updatedAgeSeconds >= 120;
                const stageHint =
                  item.status === "queued"
                    ? "排队中"
                    : item.status === "running"
                      ? stageLabel === "-" ? "处理中" : stageLabel
                      : item.status === "done"
                        ? "已完成"
                        : "";
                return (
                  <tr key={item.id} className="text-slate-700">
                    <td className="px-4 py-3 font-semibold">#{item.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{item.title || "-"}</div>
                      {probeSummary ? (
                        <div className="mt-1 text-xs text-slate-500">输入视频：{probeSummary}</div>
                      ) : (
                        <div className="mt-1 text-xs text-slate-400">输入视频：探测信息暂不可用</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {STATUS_LABEL[item.status] || item.status}
                      </span>
                      <div className="mt-1 text-xs text-slate-400">{stageLabel}</div>
                      {requestedFormats.length ? (
                        <div className="mt-1 text-xs text-slate-400">请求格式：{requestedFormats.join(" / ")}</div>
                      ) : null}
                      {item.status === "done" && generatedFormats.length ? (
                        <div className="mt-1 text-xs text-emerald-600">生成格式：{generatedFormats.join(" / ")}</div>
                      ) : null}
                      {item.status === "done" && missingFormats.length ? (
                        <div className="mt-1 text-xs text-amber-600">未生成：{missingFormats.join(" / ")}</div>
                      ) : null}
                      {templateSuggestion ? (
                        <div
                          className={`mt-1 text-xs ${
                            templateSuggestion.applied ? "text-indigo-600" : "text-slate-500"
                          }`}
                          title={templateSuggestion.reasons.join("\n")}
                        >
                          模板建议：{templateSuggestion.summary}
                          {templateSuggestion.applied ? "（自动应用）" : "（仅建议）"}
                        </div>
                      ) : null}
                      {templateSuggestion?.sourceBucketSummary ? (
                        <div className="mt-1 text-[11px] text-slate-400">{templateSuggestion.sourceBucketSummary}</div>
                      ) : null}
                      {item.error_message ? (
                        <div className="mt-1 max-w-[280px] truncate text-xs text-rose-500" title={item.error_message}>
                          {item.error_message}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <span>{progress}%</span>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            {stageHint}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 h-1.5 w-36 overflow-hidden rounded bg-slate-100">
                        {isIndeterminate ? (
                          <div className="job-progress-indeterminate h-full w-1/3 rounded bg-emerald-500/80" />
                        ) : (
                          <div
                            className={`h-full rounded transition-all duration-700 ease-out ${
                              isActive ? "job-progress-fill" : "bg-emerald-500"
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        )}
                      </div>
                      {item.status === "queued" && rawProgress <= 0 ? (
                        <div className="mt-1 text-[11px] text-amber-600">任务已入队，等待工作进程接单</div>
                      ) : null}
                      {staleActive ? (
                        <div className="mt-1 text-[11px] text-amber-600">当前阶段已停留 {updatedAgeLabel}，可检查 Worker 状态</div>
                      ) : (
                        <div className="mt-1 text-[11px] text-slate-400">最近更新：{updatedAgeLabel}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.result_collection_id ? (
                        <span className="text-xs font-semibold text-emerald-600">#{item.result_collection_id}</span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatTime(item.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.status !== "done" && item.status !== "failed" && item.status !== "cancelled" ? (
                          <button
                            onClick={() => void handleCancelJob(item.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600"
                          >
                            取消
                          </button>
                        ) : null}
                        {item.status === "done" ? (
                          <Link href={`/mine/works/${item.id}`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            查看结果
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!jobs.length && !loadingJobs ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                    暂无任务，先上传一个视频开始创作。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
