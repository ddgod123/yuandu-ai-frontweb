"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  status: string;
  stage: string;
  progress: number;
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

type AIModelOption = {
  value: string;
  label: string;
  description: string;
  disabled?: boolean;
};

type VideoJobEventItem = {
  id?: number;
  stage?: string;
  level?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

type VideoJobEventListResponse = {
  items?: VideoJobEventItem[];
  next_since_id?: number;
};

type TimelineMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  level?: "info" | "success" | "warn" | "error";
  name?: string;
  text: string;
  ts: number;
  meta?: string;
  rawMetadata?: Record<string, unknown>;
  ai1Card?: {
    format?: string;
    goal?: string;
    audience?: string;
    style?: string;
    clipRange?: string;
    resolution?: string;
    duration?: string;
    fps?: string;
    mustCapture?: string[];
    avoid?: string[];
  };
  ai2Card?: {
    strategy?: string;
    mode?: string;
    startSec?: string;
    endSec?: string;
    score?: string;
    candidateCount?: string;
  };
  ai3Card?: {
    reviewedOutputs?: string;
    deliverCount?: string;
    keepInternalCount?: string;
    rejectCount?: string;
    manualReviewCount?: string;
    hardGateRejectCount?: string;
    hardGateManualReviewCount?: string;
    summaryNote?: string;
  };
  stage?: string;
  jobId?: number;
};

type TimelineMessageInput = Omit<TimelineMessage, "id" | "ts"> & {
  id?: string;
  ts?: number;
};

type FormatOption = {
  value: string;
  label: string;
  disabled?: boolean;
  reason?: string;
};

type EventPresentation = {
  role: "assistant" | "system";
  name: string;
  text: string;
  meta: string;
  rawMetadata?: Record<string, unknown>;
  ai1Card?: TimelineMessage["ai1Card"];
  ai2Card?: TimelineMessage["ai2Card"];
  ai3Card?: TimelineMessage["ai3Card"];
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
  awaiting_ai1_confirm: "等待你确认",
  retrying: "重试",
  done: "完成",
  failed: "失败",
  cancelled: "已取消",
};

const AI_MODEL_OPTIONS: AIModelOption[] = [
  {
    value: "auto",
    label: "系统自动（推荐）",
    description: "当前版本由服务端自动选择模型链路。",
  },
  {
    value: "speed",
    label: "极速模型（预设）",
    description: "偏速度，适合快速试错。",
  },
  {
    value: "quality",
    label: "高质量模型（预设）",
    description: "偏质量，耗时更高。",
  },
];

const FALLBACK_FORMAT_OPTIONS: FormatOption[] = [
  { value: "png", label: "PNG" },
  { value: "gif", label: "GIF" },
];

function createMessageID() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(value?: string | number) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN");
}

function formatBytes(value?: number) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024) return `${size.toFixed(0)} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

function executionLaneLabel(raw: unknown) {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  switch (value) {
    case "video_gif":
      return "GIF 专线";
    case "video_png":
      return "PNG/JPG 专线";
    case "media":
      return "通用专线";
    default:
      return "";
  }
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
  return hint ? `${message}。${hint}` : message;
}

async function resolveCreateJobErrorMessage(res: Response) {
  let payload: CreateJobErrorPayload | null = null;
  try {
    payload = (await res.json()) as CreateJobErrorPayload;
  } catch {
    payload = null;
  }

  if (res.status === 402 && payload?.error === "insufficient_compute_points") {
    const required = typeof payload.required_points === "number" ? payload.required_points : 0;
    const available = typeof payload.available_points === "number" ? payload.available_points : 0;
    return `算力点不足（需要 ${required}，可用 ${available}）`;
  }

  if (res.status === 400 && payload?.error === "unsupported_output_format") {
    const rejected = Array.isArray(payload.rejected_formats) ? payload.rejected_formats : [];
    const reasonSummary = rejected
      .map((item) => `${(item?.format || "未知格式").toUpperCase()}（${item?.reason || "当前不可用"}）`)
      .join("；");
    return reasonSummary ? `格式不可用：${reasonSummary}` : payload?.message || "请求格式不可用";
  }

  if (res.status === 400 && payload?.error === "invalid_source_video") {
    return buildInvalidSourceVideoMessage(payload);
  }

  return payload?.message || payload?.error || `创建任务失败（HTTP ${res.status}）`;
}

function summarizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata || typeof metadata !== "object") return "";
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined);
  if (!entries.length) return "";

  const simple = (value: unknown): string => {
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") return value.length > 40 ? `${value.slice(0, 40)}...` : value;
    if (Array.isArray(value)) return `[${value.length}]`;
    if (typeof value === "object") return "{...}";
    return String(value);
  };

  const preview = entries.slice(0, 4).map(([k, v]) => `${k}: ${simple(v)}`);
  if (entries.length > preview.length) {
    preview.push(`+${entries.length - preview.length} 项`);
  }
  return preview.join(" · ");
}

function normalizeEventLevel(level?: string): "info" | "warn" | "error" {
  const val = (level || "").trim().toLowerCase();
  if (val === "error" || val === "fatal") return "error";
  if (val === "warn" || val === "warning") return "warn";
  return "info";
}

function stringFromAny(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringListFromAny(value: unknown) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.push(trimmed);
  }
  return out;
}

function businessGoalLabel(value: string) {
  switch (value.trim().toLowerCase()) {
    case "social_spread":
      return "社交传播";
    case "entertainment":
      return "娱乐氛围";
    case "news":
      return "资讯表达";
    case "design_asset":
      return "设计素材";
    default:
      return value || "";
  }
}

function buildAI1NaturalReply(metadata?: Record<string, unknown>) {
  if (!metadata) return "";

  const aiReply = stringFromAny(metadata.ai_reply);
  if (aiReply) return aiReply;

  const directiveText = stringFromAny(metadata.directive_text);
  if (directiveText) return directiveText;

  const goal = businessGoalLabel(stringFromAny(metadata.business_goal));
  const audience = stringFromAny(metadata.audience);
  const mustCapture = stringListFromAny(metadata.must_capture);
  const avoid = stringListFromAny(metadata.avoid);

  const clipMinRaw = Number(metadata.clip_count_min ?? 0);
  const clipMaxRaw = Number(metadata.clip_count_max ?? 0);
  const clipMin = Number.isFinite(clipMinRaw) && clipMinRaw > 0 ? clipMinRaw : 0;
  const clipMax = Number.isFinite(clipMaxRaw) && clipMaxRaw > 0 ? clipMaxRaw : 0;

  const parts: string[] = [];
  if (goal) parts.push(`目标：${goal}`);
  if (audience) parts.push(`受众：${audience}`);
  if (mustCapture.length) parts.push(`重点：${mustCapture.slice(0, 3).join("、")}`);
  if (avoid.length) parts.push(`规避：${avoid.slice(0, 3).join("、")}`);
  if (clipMin || clipMax) {
    parts.push(`候选数量：${clipMin || "-"}~${clipMax || "-"}`);
  }
  return parts.join("；");
}

function numberDisplay(value: unknown, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "";
  return num.toFixed(digits);
}

function buildAI1Card(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const goalRaw = stringFromAny(metadata.business_goal);
  const goal = businessGoalLabel(goalRaw);
  const audience = stringFromAny(metadata.audience);
  const style = stringFromAny(metadata.style_direction);
  const mustCapture = stringListFromAny(metadata.must_capture).slice(0, 6);
  const avoid = stringListFromAny(metadata.avoid).slice(0, 6);
  const format = stringFromAny(metadata.target_format || metadata.requested_format).toUpperCase();

  const clipMinRaw = Number(metadata.clip_count_min ?? 0);
  const clipMaxRaw = Number(metadata.clip_count_max ?? 0);
  const clipMin = Number.isFinite(clipMinRaw) && clipMinRaw > 0 ? clipMinRaw : 0;
  const clipMax = Number.isFinite(clipMaxRaw) && clipMaxRaw > 0 ? clipMaxRaw : 0;
  const clipRange = clipMin || clipMax ? `${clipMin || "-"}~${clipMax || "-"}` : "";

  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const resolution = width > 0 && height > 0 ? `${width}x${height}` : "";
  const duration = numberDisplay(metadata.duration_sec);
  const fps = numberDisplay(metadata.fps);

  const hasContent =
    Boolean(goal || audience || style || clipRange || resolution || duration || fps || format) ||
    mustCapture.length > 0 ||
    avoid.length > 0;
  if (!hasContent) return undefined;

  return {
    format: format || undefined,
    goal: goal || undefined,
    audience: audience || undefined,
    style: style || undefined,
    clipRange: clipRange || undefined,
    resolution: resolution || undefined,
    duration: duration ? `${duration}s` : undefined,
    fps: fps ? `${fps}fps` : undefined,
    mustCapture: mustCapture.length ? mustCapture : undefined,
    avoid: avoid.length ? avoid : undefined,
  };
}

function buildAI2Card(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const mode = stringFromAny(metadata.mode).toLowerCase();
  const strategy = mode ? mode.toUpperCase() : "";
  const startSec = numberDisplay(metadata.selected_start_sec, 2);
  const endSec = numberDisplay(metadata.selected_end_sec, 2);
  const score = numberDisplay(metadata.selected_score, 4);
  const candidateCountRaw = Number(metadata.selected_count ?? 0);
  const candidateCount = Number.isFinite(candidateCountRaw) && candidateCountRaw > 0 ? String(candidateCountRaw) : "";

  const hasContent = Boolean(mode || startSec || endSec || score || candidateCount);
  if (!hasContent) return undefined;
  return {
    strategy: strategy || undefined,
    mode: mode || undefined,
    startSec: startSec ? `${startSec}s` : undefined,
    endSec: endSec ? `${endSec}s` : undefined,
    score: score || undefined,
    candidateCount: candidateCount || undefined,
  };
}

function extractSummaryNote(raw: unknown) {
  if (!raw || typeof raw !== "object") return "";
  const summary = raw as Record<string, unknown>;
  const note = stringFromAny(summary.note);
  if (note) return note;
  const reason = stringFromAny(summary.reason);
  if (reason) return reason;
  return "";
}

function buildAI3Card(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const reviewedOutputs = Number(metadata.reviewed_outputs ?? 0);
  const deliverCount = Number(metadata.deliver_count ?? 0);
  const keepInternalCount = Number(metadata.keep_internal_count ?? 0);
  const rejectCount = Number(metadata.reject_count ?? 0);
  const manualReviewCount = Number(metadata.manual_review_count ?? 0);
  const hardGateRejectCount = Number(metadata.hard_gate_reject_count ?? 0);
  const hardGateManualReviewCount = Number(metadata.hard_gate_manual_review_count ?? 0);
  const summaryNote = extractSummaryNote(metadata.summary);

  const hasContent = Boolean(
    reviewedOutputs ||
      deliverCount ||
      keepInternalCount ||
      rejectCount ||
      manualReviewCount ||
      hardGateRejectCount ||
      hardGateManualReviewCount ||
      summaryNote
  );
  if (!hasContent) return undefined;
  return {
    reviewedOutputs: reviewedOutputs > 0 ? String(reviewedOutputs) : undefined,
    deliverCount: deliverCount > 0 ? String(deliverCount) : undefined,
    keepInternalCount: keepInternalCount > 0 ? String(keepInternalCount) : undefined,
    rejectCount: rejectCount > 0 ? String(rejectCount) : undefined,
    manualReviewCount: manualReviewCount > 0 ? String(manualReviewCount) : undefined,
    hardGateRejectCount: hardGateRejectCount > 0 ? String(hardGateRejectCount) : undefined,
    hardGateManualReviewCount: hardGateManualReviewCount > 0 ? String(hardGateManualReviewCount) : undefined,
    summaryNote: summaryNote || undefined,
  };
}

function presentEventMessage(event: VideoJobEventItem): EventPresentation {
  const raw = (event.message || "").trim();
  const normalized = raw.toLowerCase();
  const metadata = event.metadata;

  if (normalized.includes("sub-stage briefing started")) {
    return { role: "assistant" as const, name: "AI1", text: "AI1 开始理解你的视频与需求。", meta: "" };
  }
  if (normalized.includes("ai director prompt pack generated")) {
    const reply = buildAI1NaturalReply(metadata);
    return {
      role: "assistant" as const,
      name: "AI1",
      text: reply ? `AI1 识别结果：${reply}` : "AI1 已输出识别结果。",
      meta: summarizeMetadata(metadata),
      rawMetadata: metadata,
      ai1Card: buildAI1Card(metadata),
    };
  }
  if (normalized.includes("ai1 preview generated")) {
    const reply = buildAI1NaturalReply(metadata) || stringFromAny(metadata?.ai_reply);
    return {
      role: "assistant" as const,
      name: "AI1",
      text: reply ? `AI1 识别结果：${reply}` : "AI1 已输出首轮识别结果。",
      meta: summarizeMetadata(metadata),
      rawMetadata: metadata,
      ai1Card: buildAI1Card(metadata),
    };
  }
  if (normalized === "ai1 waiting user confirmation") {
    return {
      role: "assistant" as const,
      name: "系统",
      text: "AI1 已完成，请点击“确认继续”进入 AI2/Worker/AI3。",
      meta: summarizeMetadata(metadata),
    };
  }
  if (normalized === "user confirmed continue after ai1") {
    return {
      role: "assistant" as const,
      name: "系统",
      text: "已收到确认，继续执行 AI2/Worker/AI3。",
      meta: summarizeMetadata(metadata),
    };
  }
  if (normalized === "waiting for user confirmation before continuing") {
    return {
      role: "assistant" as const,
      name: "系统",
      text: "当前任务正在等待你确认继续。",
      meta: summarizeMetadata(metadata),
    };
  }
  if (normalized.includes("sub-stage planning started")) {
    return { role: "assistant" as const, name: "AI2", text: "AI2 开始生成执行方案。", meta: "" };
  }
  if (normalized.includes("ai planner suggestion applied")) {
    return {
      role: "assistant" as const,
      name: "AI2",
      text: "AI2 已生成方案并应用到任务。",
      meta: summarizeMetadata(metadata),
      rawMetadata: metadata,
      ai2Card: buildAI2Card(metadata),
    };
  }
  if (normalized.includes("sub-stage reviewing started")) {
    return { role: "assistant" as const, name: "AI3", text: "AI3 开始复审输出结果。", meta: "" };
  }
  if (normalized.endsWith("ai judge completed") || normalized === "ai judge completed") {
    return {
      role: "assistant" as const,
      name: "AI3",
      text: "AI3 复审完成。",
      meta: summarizeMetadata(metadata),
      rawMetadata: metadata,
      ai3Card: buildAI3Card(metadata),
    };
  }
  if (normalized === "video job completed") {
    return {
      role: "assistant" as const,
      name: "系统",
      text: "任务处理完成，可前往“我的作品”查看结果。",
      meta: summarizeMetadata(metadata),
    };
  }
  if (normalized === "video job started") {
    return { role: "assistant" as const, name: "系统", text: "任务已进入处理队列，准备执行。", meta: "" };
  }

  return {
    role: "system" as const,
    name: "Worker",
    text: raw || "进度更新",
    meta: summarizeMetadata(metadata),
    rawMetadata: metadata,
  };
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
      resolve({ ...base, ...extra });
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

export default function CreatePage() {
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const [jobs, setJobs] = useState<VideoJobItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [capabilities, setCapabilities] = useState<VideoCapabilitiesResponse | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);

  const [selectedFormat, setSelectedFormat] = useState<string>("png");
  const [selectedAIModel, setSelectedAIModel] = useState<string>("auto");
  const [promptText, setPromptText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [timeline, setTimeline] = useState<TimelineMessage[]>([
    {
      id: createMessageID(),
      role: "assistant",
      level: "info",
      text: "欢迎使用视频转图片工作台。流程是：参数准备 → 上传 → 创建任务 → AI1/AI2/Worker/AI3 逐步反馈。",
      ts: Date.now(),
    },
  ]);

  const [activeJobID, setActiveJobID] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingContinue, setConfirmingContinue] = useState(false);
  // const [taskListCompact, setTaskListCompact] = useState(true);

  const [globalError, setGlobalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timelineEndRef = useRef<HTMLDivElement | null>(null);
  const eventCursorRef = useRef<Record<number, number>>({});
  const seenEventRef = useRef<Set<string>>(new Set());
  const announcedActiveJobRef = useRef<number | null>(null);

  const activeJob = useMemo(() => jobs.find((item) => item.id === activeJobID) || null, [jobs, activeJobID]);
  const activeJobAwaitingAI1Confirm = useMemo(
    () => (activeJob?.stage || "").trim().toLowerCase() === "awaiting_ai1_confirm",
    [activeJob]
  );

  const hasRunningJob = useMemo(
    () => jobs.some((item) => item.status === "queued" || item.status === "running"),
    [jobs]
  );
  const compactJobs = useMemo(() => jobs.slice(0, 12), [jobs]);
  const activeJobRequestedFormats = useMemo(() => {
    if (!activeJob) return [];
    return resolveRequestedFormats(activeJob);
  }, [activeJob]);
  const activeJobGeneratedFormats = useMemo(() => {
    if (!activeJob) return [];
    return resolveGeneratedFormats(activeJob);
  }, [activeJob]);

  const appendTimeline = useCallback((input: TimelineMessageInput) => {
    const id = input.id || createMessageID();
    const ts = input.ts || Date.now();
    setTimeline((prev) => [...prev, { ...input, id, ts }]);
    return id;
  }, []);

  const patchTimeline = useCallback((id: string, patch: Partial<TimelineMessage>) => {
    setTimeline((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const checkAuth = useCallback(async () => {
    const ok = await ensureAuthSession();
    setIsAuthed(ok);
    setAuthReady(true);
    return ok;
  }, []);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setGlobalError(null);
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
      setGlobalError(msg);
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

  const capabilityMap = useMemo(() => {
    const map = new Map<string, VideoFormatCapability>();
    for (const item of capabilities?.formats || []) {
      const format = item?.format?.trim().toLowerCase();
      if (!format) continue;
      map.set(format, item);
    }
    return map;
  }, [capabilities]);

  const formatOptions = useMemo<FormatOption[]>(() => {
    const fromCapabilities = (capabilities?.formats || [])
      .map((item) => {
        const value = (item?.format || "").trim().toLowerCase();
        if (!value) return null;
        return {
          value,
          label: value.toUpperCase(),
          disabled: item.supported === false,
          reason: item.reason,
        } as FormatOption;
      })
      .filter((item): item is FormatOption => Boolean(item));

    if (fromCapabilities.length) {
      return fromCapabilities;
    }
    return FALLBACK_FORMAT_OPTIONS;
  }, [capabilities]);

  const selectedFormatOption = useMemo(
    () => formatOptions.find((item) => item.value === selectedFormat) || null,
    [formatOptions, selectedFormat]
  );

  const selectedModelOption = useMemo(
    () => AI_MODEL_OPTIONS.find((item) => item.value === selectedAIModel) || AI_MODEL_OPTIONS[0],
    [selectedAIModel]
  );

  const syncOneJob = useCallback((job: VideoJobItem) => {
    setJobs((prev) => {
      const idx = prev.findIndex((item) => item.id === job.id);
      if (idx < 0) return [job, ...prev];
      const next = prev.slice();
      next[idx] = { ...next[idx], ...job };
      return next;
    });
  }, []);

  const loadJobDetail = useCallback(
    async (jobID: number) => {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}`);
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        return null;
      }
      if (!res.ok) return null;
      const job = (await res.json()) as VideoJobItem;
      syncOneJob(job);
      return job;
    },
    [syncOneJob]
  );

  const loadJobEvents = useCallback(
    async (jobID: number, reset = false) => {
      const currentCursor = reset ? 0 : eventCursorRef.current[jobID] || 0;
      if (reset) {
        eventCursorRef.current[jobID] = 0;
      }

      const params = new URLSearchParams();
      params.set("limit", "120");
      if (currentCursor > 0) {
        params.set("since_id", String(currentCursor));
      }

      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/events?${params.toString()}`);
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as VideoJobEventListResponse;
      const items = Array.isArray(data.items) ? data.items : [];

      for (const event of items) {
        const eventID = Number(event.id || 0);
        const eventKey = `${jobID}:${eventID}`;
        if (eventID > 0 && seenEventRef.current.has(eventKey)) continue;
        if (eventID > 0) seenEventRef.current.add(eventKey);

        const stageRaw = (event.stage || "").trim().toLowerCase();
        const stageLabel = STAGE_LABEL[stageRaw] || event.stage || "进度";
        const level = normalizeEventLevel(event.level);
        const presentation = presentEventMessage(event);

        appendTimeline({
          role: presentation.role,
          name: presentation.name,
          level,
          text: presentation.text || event.message?.trim() || `${stageLabel}更新`,
          ai1Card: presentation.ai1Card,
          ai2Card: presentation.ai2Card,
          ai3Card: presentation.ai3Card,
          stage: stageLabel,
          meta: presentation.meta,
          rawMetadata: presentation.rawMetadata,
          jobId: jobID,
          ts: event.created_at ? new Date(event.created_at).getTime() : Date.now(),
        });
      }

      const nextSinceID = Number(data.next_since_id || currentCursor || 0);
      if (Number.isFinite(nextSinceID) && nextSinceID >= 0) {
        const prev = eventCursorRef.current[jobID] || 0;
        if (nextSinceID > prev) {
          eventCursorRef.current[jobID] = nextSinceID;
        }
      }
    },
    [appendTimeline]
  );

  const handleCancelJob = useCallback(
    async (jobID: number) => {
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/cancel`, { method: "POST" });
        if (res.status === 401) {
          clearAuthSession();
          setIsAuthed(false);
          setGlobalError("登录已失效，请重新登录");
          return;
        }
        if (!res.ok) {
          throw new Error((await res.text()) || "取消任务失败");
        }
        appendTimeline({ role: "assistant", level: "warn", text: `任务 #${jobID} 已提交取消请求。` });
        await loadJobs();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "取消任务失败";
        appendTimeline({ role: "assistant", level: "error", text: msg });
      }
    },
    [appendTimeline, loadJobs]
  );

  const confirmContinueAfterAI1 = useCallback(
    async (jobID: number) => {
      if (!jobID || confirmingContinue) return;
      setConfirmingContinue(true);
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/confirm-ai1`, {
          method: "POST",
        });
        if (res.status === 401) {
          clearAuthSession();
          setIsAuthed(false);
          setGlobalError("登录已失效，请重新登录");
          return;
        }
        if (!res.ok) {
          throw new Error((await res.text()) || "确认继续失败");
        }
        appendTimeline({
          role: "user",
          level: "info",
          text: "确认继续执行后续流程（AI2/Worker/AI3）。",
          jobId: jobID,
        });
        appendTimeline({
          role: "assistant",
          name: "系统",
          level: "success",
          text: "已发送继续指令，任务将恢复执行。",
          jobId: jobID,
        });
        await Promise.all([loadJobEvents(jobID, false), loadJobs()]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "确认继续失败";
        appendTimeline({ role: "assistant", level: "error", text: msg, jobId: jobID });
      } finally {
        setConfirmingContinue(false);
      }
    },
    [appendTimeline, confirmingContinue, loadJobEvents, loadJobs]
  );

  const handleSend = useCallback(async () => {
    if (submitting) return;

    const file = selectedFile;
    if (!file) {
      appendTimeline({ role: "assistant", level: "warn", text: "请先选择一个视频文件再发送。" });
      return;
    }

    const normalizedFormat = selectedFormat.trim().toLowerCase();
    if (!normalizedFormat) {
      appendTimeline({ role: "assistant", level: "warn", text: "请选择输出格式。" });
      return;
    }

    if (capabilityMap.get(normalizedFormat)?.supported === false) {
      appendTimeline({
        role: "assistant",
        level: "warn",
        text: `当前服务器暂不支持 ${normalizedFormat.toUpperCase()}，请切换格式后重试。`,
      });
      return;
    }

    const userPrompt = promptText.trim();
    const modelLabel = selectedModelOption?.label || selectedAIModel;

    setSubmitting(true);
    setGlobalError(null);

    appendTimeline({
      role: "user",
      level: "info",
      text: userPrompt || `请帮我把这个视频转换为 ${normalizedFormat.toUpperCase()} 图片。`,
      meta: `格式：${normalizedFormat.toUpperCase()} · 模型：${modelLabel} · 文件：${file.name}`,
    });

    try {
      const step1 = appendTimeline({ role: "assistant", level: "info", text: "步骤 1/4：正在分析本地视频信息..." });
      const localInsight = await probeLocalVideoFile(file);
      patchTimeline(step1, {
        level: "success",
        text: "步骤 1/4：本地视频分析完成",
        meta: `${localInsight.width || "-"}x${localInsight.height || "-"} · ${
          localInsight.duration_sec ? `${localInsight.duration_sec}s` : "-"
        } · ${formatBytes(localInsight.size_bytes)}`,
      });

      const key = makeVideoKey(file.name);
      const step2 = appendTimeline({ role: "assistant", level: "info", text: "步骤 2/4：申请上传凭证..." });

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

      patchTimeline(step2, { text: "步骤 2/4：上传视频中（0%）" });
      await new Promise<void>((resolve, reject) => {
        const form = new FormData();
        form.append("file", file);
        form.append("token", tokenData.token);
        form.append("key", uploadKey);

        const xhr = new XMLHttpRequest();
        let prevPercent = -1;

        xhr.open("POST", upHost, true);
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
          if (percent === prevPercent) return;
          prevPercent = percent;
          patchTimeline(step2, { text: `步骤 2/4：上传视频中（${percent}%）` });
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

      patchTimeline(step2, {
        level: "success",
        text: "步骤 2/4：视频上传完成",
        meta: `源视频 Key：${uploadKey}`,
      });

      const step3 = appendTimeline({ role: "assistant", level: "info", text: "步骤 3/4：服务端探测视频信息..." });
      let probeMeta = "探测结果未返回详细字段";
      try {
        const probeRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs/source-probe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_video_key: uploadKey }),
        });

        if (probeRes.status === 401) {
          clearAuthSession();
          setIsAuthed(false);
          throw new Error("登录已失效，请重新登录");
        }

        if (probeRes.ok) {
          const probeData = (await probeRes.json()) as SourceVideoProbeResponse;
          const w = probeData.width || localInsight.width || 0;
          const h = probeData.height || localInsight.height || 0;
          const ratio = probeData.aspect_ratio || aspectRatioFromSize(w, h) || "-";
          const orient = orientationLabel(probeData.orientation) || orientationBySize(w, h) || "-";
          probeMeta = `${w && h ? `${w}x${h}` : "-"} · ${
            probeData.duration_sec ? `${probeData.duration_sec}s` : "-"
          } · ${ratio} · ${orient}`;
          patchTimeline(step3, { level: "success", text: "步骤 3/4：服务端探测完成", meta: probeMeta });
        } else {
          patchTimeline(step3, {
            level: "warn",
            text: "步骤 3/4：服务端探测失败，将继续创建任务",
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "探测失败";
        patchTimeline(step3, {
          level: "warn",
          text: `步骤 3/4：服务端探测异常（${msg}），将继续创建任务`,
        });
      }

      const step4 = appendTimeline({ role: "assistant", level: "info", text: "步骤 4/4：创建任务中..." });

      const payload: Record<string, unknown> = {
        title: userPrompt || `视频转${normalizedFormat.toUpperCase()}-${Date.now()}`,
        prompt: userPrompt,
        ai_model: selectedAIModel,
        flow_mode: "ai1_confirm",
        source_video_key: uploadKey,
        auto_highlight: true,
        output_formats: [normalizedFormat],
      };

      const createRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (createRes.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        throw new Error("请先登录后创建任务");
      }

      if (!createRes.ok) {
        const reason = await resolveCreateJobErrorMessage(createRes);
        throw new Error(reason);
      }

      const created = (await createRes.json()) as VideoJobItem;
      const executionQueue = typeof created.options?.execution_queue === "string" ? created.options.execution_queue : "";
      const laneLabel = executionLaneLabel(executionQueue);
      patchTimeline(step4, {
        level: "success",
        text: `步骤 4/4：任务 #${created.id} 创建成功`,
        meta: `格式：${normalizedFormat.toUpperCase()} · 模型：${modelLabel}${laneLabel ? ` · ${laneLabel}` : ""}`,
        jobId: created.id,
      });

      if (selectedAIModel !== "auto") {
        appendTimeline({
          role: "assistant",
          level: "warn",
          text: `已记录模型偏好：${modelLabel}。当前后端仍由系统自动调度模型链路。`,
          jobId: created.id,
        });
      }

      appendTimeline({
        role: "assistant",
        name: "系统",
        level: "info",
        text: `任务已进入分步模式：先执行 AI1 并等待你的确认，确认后再继续 AI2/Worker/AI3。${laneLabel ? `当前走 ${laneLabel}。` : ""}`,
        jobId: created.id,
      });

      setJobs((prev) => {
        const next = prev.filter((item) => item.id !== created.id);
        return [created, ...next];
      });
      setActiveJobID(created.id);
      eventCursorRef.current[created.id] = 0;

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setPromptText("");

      await loadJobEvents(created.id, true);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "处理失败";
      appendTimeline({ role: "assistant", level: "error", text: `${msg}，请检查后重试。` });
    } finally {
      setSubmitting(false);
    }
  }, [
    appendTimeline,
    capabilityMap,
    loadJobEvents,
    loadJobs,
    patchTimeline,
    promptText,
    selectedAIModel,
    selectedFile,
    selectedFormat,
    selectedModelOption,
    submitting,
  ]);

  useEffect(() => {
    void checkAuth().then((ok) => {
      if (ok) {
        void loadJobs();
        void loadCapabilities();
      }
    });
  }, [checkAuth, loadCapabilities, loadJobs]);

  useEffect(() => {
    if (!formatOptions.length) return;
    const exists = formatOptions.some((item) => item.value === selectedFormat && !item.disabled);
    if (exists) return;
    const firstAvailable = formatOptions.find((item) => !item.disabled) || formatOptions[0];
    if (firstAvailable && firstAvailable.value !== selectedFormat) {
      setSelectedFormat(firstAvailable.value);
    }
  }, [formatOptions, selectedFormat]);

  useEffect(() => {
    if (jobs.length === 0) return;
    if (activeJobID) return;
    setActiveJobID(jobs[0].id);
  }, [jobs, activeJobID]);

  useEffect(() => {
    if (!isAuthed || !hasRunningJob) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadJobs();
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasRunningJob, isAuthed, loadJobs]);

  useEffect(() => {
    if (!isAuthed || !activeJobID) return;

    if (announcedActiveJobRef.current !== activeJobID) {
      announcedActiveJobRef.current = activeJobID;
      appendTimeline({
        role: "assistant",
        name: "系统",
        level: "info",
        text: `已切换到任务 #${activeJobID}，正在同步处理日志...`,
      });
      void loadJobEvents(activeJobID, true);
    }

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      await Promise.all([loadJobEvents(activeJobID, false), loadJobDetail(activeJobID)]);
    };

    void poll();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    }, 2800);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobID, appendTimeline, isAuthed, loadJobDetail, loadJobEvents]);

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [timeline.length]);

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
          <h1 className="text-2xl font-black text-slate-900">视频转图片</h1>
          <p className="mt-3 text-sm text-slate-600">请先登录，再使用 AI 交互式工作台。</p>
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
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        footer { display: none !important; }
        body { overflow: hidden; }
        .main-content-height { height: calc(100vh - 64px); }
      `}} />
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6 main-content-height flex flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-900">视频转图片 · AI 交互工作台</h1>
          <p className="mt-1 text-sm text-slate-500">基于大语言模型，理解自然语言需求，精准提取高质量视觉资产。</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">任务总数 {jobs.length}</span>
            {loadingJobs ? <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-emerald-600">任务同步中...</span> : null}
            {loadingCapabilities ? (
              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-indigo-600">能力探测中...</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTimeline([
                {
                  id: createMessageID(),
                  role: "assistant",
                  name: "系统",
                  level: "info",
                  text: "新会话已开始。请先设置格式/模型/提示词并选择视频，然后发送。",
                  ts: Date.now(),
                },
              ]);
              seenEventRef.current = new Set();
              eventCursorRef.current = {};
              announcedActiveJobRef.current = null;
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            + 新会话
          </button>
          <Link href="/mine/works" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow-sm">
            查看历史任务
          </Link>
        </div>
      </div>

      {globalError ? (
        <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700 shrink-0">{globalError}</div>
      ) : null}

      <section className="flex flex-1 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden relative">
        {compactJobs.length > 0 ? (
          <details className="group border-b border-slate-100 bg-white/90 px-4 py-2 shrink-0">
            <summary className="cursor-pointer list-none text-xs text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                任务列表（紧凑）
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-slate-500">{compactJobs.length}</span>
              </span>
            </summary>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {compactJobs.map((job) => {
                const active = job.id === activeJobID;
                return (
                  <button
                    key={job.id}
                    onClick={() => setActiveJobID(job.id)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                    title={job.title || `任务 #${job.id}`}
                  >
                    #{job.id} · {(job.output_formats?.[0] || "auto").toUpperCase()} · {STATUS_LABEL[job.status] || job.status}
                  </button>
                );
              })}
            </div>
          </details>
        ) : null}
        {activeJob ? (
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3 shrink-0">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800">
                  当前任务 #{activeJob.id} · {activeJob.title || "未命名任务"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm">
                    {STATUS_LABEL[activeJob.status] || activeJob.status}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm">
                    {STAGE_LABEL[activeJob.stage] || activeJob.stage || "-"}
                  </span>
                  {activeJobAwaitingAI1Confirm && (
                    <button
                      onClick={() => void confirmContinueAfterAI1(activeJob.id)}
                      disabled={confirmingContinue}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition"
                    >
                      {confirmingContinue ? "确认中..." : "确认继续"}
                    </button>
                  )}
                  {(activeJob.status === "queued" || activeJob.status === "running") && (
                    <button
                      onClick={() => void handleCancelJob(activeJob.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
                    >
                      取消任务
                    </button>
                  )}
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.max(2, Math.min(100, Number(activeJob.progress || 0)))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>进度 {Math.max(0, Math.min(100, Number(activeJob.progress || 0)))}%</span>
                <span>更新时间 {formatTime(activeJob.updated_at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                  请求格式：{activeJobRequestedFormats.length ? activeJobRequestedFormats.map((it) => it.toUpperCase()).join(", ") : "-"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                  产出格式：{activeJobGeneratedFormats.length ? activeJobGeneratedFormats.map((it) => it.toUpperCase()).join(", ") : "-"}
                </span>
              </div>
              {activeJob.error_message ? (
                <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  错误：{activeJob.error_message}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 scroll-smooth">
          {timeline.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400">
              <div className="mb-6 flex items-center justify-center rounded-full bg-emerald-50 p-4 text-emerald-500">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-slate-700 mb-2">今天有什么可以帮到你？</h2>
              <p className="text-sm">上传视频并输入需求，AI 将为您生成高质量图片资产</p>
            </div>
          ) : (
            timeline.map((item) => {
              const isUser = item.role === "user";
              const levelStyle =
                item.level === "error"
                  ? "border-rose-100 bg-rose-50 text-rose-700"
                  : item.level === "warn"
                    ? "border-amber-100 bg-amber-50 text-amber-700"
                    : item.level === "success"
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                      : "border-slate-100 bg-slate-50 text-slate-800";

              return (
                <div key={item.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser && (
                    <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm md:max-w-[80%] ${
                      isUser ? "bg-emerald-600 text-white shadow-md" : `border ${levelStyle}`
                    }`}
                  >
                    <div className={`flex flex-wrap items-center gap-2 text-[11px] mb-1.5 ${isUser ? "text-emerald-100" : "text-slate-500"}`}>
                      <span className="font-medium">{isUser ? "你" : item.name || (item.role === "assistant" ? "系统" : "Worker")}</span>
                      {item.stage ? (
                        <span className="rounded-full border border-current px-1.5 py-0.5 text-[10px] opacity-80">{item.stage}</span>
                      ) : null}
                      {item.jobId ? <span>任务 #{item.jobId}</span> : null}
                      <span>{formatTime(item.ts)}</span>
                    </div>
                    <div className="whitespace-pre-wrap break-words leading-relaxed">{item.text}</div>
                    {item.ai1Card ? (
                      <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 text-xs text-slate-700">
                        <div className="mb-2 text-[12px] font-bold text-emerald-800 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          AI1 意图识别结果
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 bg-white/60 p-2 rounded-lg border border-emerald-100">
                          {item.ai1Card.format ? <div><span className="text-slate-500">格式：</span>{item.ai1Card.format}</div> : null}
                          {item.ai1Card.goal ? <div><span className="text-slate-500">目标：</span>{item.ai1Card.goal}</div> : null}
                          {item.ai1Card.audience ? <div><span className="text-slate-500">受众：</span>{item.ai1Card.audience}</div> : null}
                          {item.ai1Card.style ? <div><span className="text-slate-500">风格：</span>{item.ai1Card.style}</div> : null}
                          {item.ai1Card.clipRange ? <div><span className="text-slate-500">候选数：</span>{item.ai1Card.clipRange}</div> : null}
                          {item.ai1Card.resolution ? <div><span className="text-slate-500">分辨率：</span>{item.ai1Card.resolution}</div> : null}
                          {item.ai1Card.duration ? <div><span className="text-slate-500">时长：</span>{item.ai1Card.duration}</div> : null}
                          {item.ai1Card.fps ? <div><span className="text-slate-500">帧率：</span>{item.ai1Card.fps}</div> : null}
                        </div>
                        {item.ai1Card.mustCapture?.length ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <span className="font-semibold text-emerald-800">重点：</span>
                            {item.ai1Card.mustCapture.map((entry, idx) => (
                              <span key={`${entry}-${idx}`} className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] shadow-sm">
                                {entry}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {item.ai1Card.avoid?.length ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <span className="font-semibold text-rose-700">规避：</span>
                            {item.ai1Card.avoid.map((entry, idx) => (
                              <span key={`${entry}-${idx}`} className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] shadow-sm text-rose-700">
                                {entry}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {item.rawMetadata ? (
                          <details className="mt-3 group">
                            <summary className="cursor-pointer text-[11px] font-medium text-emerald-600 hover:text-emerald-700 select-none">
                              查看 AI1 原始 JSON
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-800 p-3 text-[11px] leading-relaxed text-emerald-100 shadow-inner">
                              {JSON.stringify(item.rawMetadata, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                    {item.ai2Card ? (
                      <div className="mt-3 rounded-xl border border-violet-200/70 bg-violet-50/50 p-3 text-xs text-slate-700">
                        <div className="mb-2 flex items-center gap-1 text-[12px] font-bold text-violet-800">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          AI2 执行方案
                        </div>
                        <div className="grid gap-2 rounded-lg border border-violet-100 bg-white/70 p-2 sm:grid-cols-2">
                          {item.ai2Card.strategy ? <div><span className="text-slate-500">策略：</span>{item.ai2Card.strategy}</div> : null}
                          {item.ai2Card.mode ? <div><span className="text-slate-500">模式：</span>{item.ai2Card.mode}</div> : null}
                          {item.ai2Card.startSec ? <div><span className="text-slate-500">起始：</span>{item.ai2Card.startSec}</div> : null}
                          {item.ai2Card.endSec ? <div><span className="text-slate-500">结束：</span>{item.ai2Card.endSec}</div> : null}
                          {item.ai2Card.score ? <div><span className="text-slate-500">评分：</span>{item.ai2Card.score}</div> : null}
                          {item.ai2Card.candidateCount ? <div><span className="text-slate-500">候选数：</span>{item.ai2Card.candidateCount}</div> : null}
                        </div>
                        {item.rawMetadata ? (
                          <details className="mt-3 group">
                            <summary className="cursor-pointer select-none text-[11px] font-medium text-violet-700 hover:text-violet-800">
                              查看 AI2 原始 JSON
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-800 p-3 text-[11px] leading-relaxed text-violet-100 shadow-inner">
                              {JSON.stringify(item.rawMetadata, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                    {item.ai3Card ? (
                      <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 text-xs text-slate-700">
                        <div className="mb-2 flex items-center gap-1 text-[12px] font-bold text-emerald-800">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          AI3 复审结论
                        </div>
                        <div className="grid gap-2 rounded-lg border border-emerald-100 bg-white/70 p-2 sm:grid-cols-2">
                          {item.ai3Card.reviewedOutputs ? <div><span className="text-slate-500">复审样本：</span>{item.ai3Card.reviewedOutputs}</div> : null}
                          {item.ai3Card.deliverCount ? <div><span className="text-slate-500">可交付：</span>{item.ai3Card.deliverCount}</div> : null}
                          {item.ai3Card.keepInternalCount ? <div><span className="text-slate-500">内部保留：</span>{item.ai3Card.keepInternalCount}</div> : null}
                          {item.ai3Card.rejectCount ? <div><span className="text-slate-500">拒绝：</span>{item.ai3Card.rejectCount}</div> : null}
                          {item.ai3Card.manualReviewCount ? <div><span className="text-slate-500">人工复核：</span>{item.ai3Card.manualReviewCount}</div> : null}
                          {item.ai3Card.hardGateRejectCount ? <div><span className="text-slate-500">硬门限拒绝：</span>{item.ai3Card.hardGateRejectCount}</div> : null}
                          {item.ai3Card.hardGateManualReviewCount ? <div><span className="text-slate-500">硬门限复核：</span>{item.ai3Card.hardGateManualReviewCount}</div> : null}
                        </div>
                        {item.ai3Card.summaryNote ? (
                          <div className="mt-2 rounded-lg border border-emerald-100 bg-white px-2 py-1.5 text-[11px] text-emerald-800">
                            总结：{item.ai3Card.summaryNote}
                          </div>
                        ) : null}
                        {item.rawMetadata ? (
                          <details className="mt-3 group">
                            <summary className="cursor-pointer select-none text-[11px] font-medium text-emerald-700 hover:text-emerald-800">
                              查看 AI3 原始 JSON
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-800 p-3 text-[11px] leading-relaxed text-emerald-100 shadow-inner">
                              {JSON.stringify(item.rawMetadata, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                    {item.meta ? <div className="mt-2 text-[11px] opacity-70 border-t border-current pt-1">{item.meta}</div> : null}
                  </div>
                </div>
              );
            })
          )}
          <div ref={timelineEndRef} className="h-2" />
        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 p-4 shrink-0">
          <div className="mx-auto max-w-4xl">
            <div className="relative rounded-3xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="给 AI 发送消息，例如：提取人物主体，背景虚化，优先保证清晰度..."
                rows={1}
                className="w-full resize-none rounded-2xl bg-transparent px-4 pt-4 pb-14 text-sm text-slate-800 outline-none min-h-[140px]"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative flex cursor-pointer items-center group">
                    <div className="absolute left-3.5 flex items-center justify-center text-emerald-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <select
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value)}
                      className="appearance-none rounded-full border border-slate-200 bg-white py-1.5 pl-9 pr-8 text-[13px] font-medium text-slate-700 outline-none hover:bg-slate-50 transition-colors focus:border-emerald-300 cursor-pointer"
                    >
                      {formatOptions.map((item) => (
                        <option key={item.value} value={item.value} disabled={item.disabled}>
                          {item.label} {item.disabled ? "(不可用)" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 pointer-events-none text-slate-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </label>

                  <label className="relative flex cursor-pointer items-center group">
                    <div className="absolute left-3.5 flex items-center justify-center text-emerald-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <select
                      value={selectedAIModel}
                      onChange={(e) => setSelectedAIModel(e.target.value)}
                      className="appearance-none rounded-full border border-slate-200 bg-white py-1.5 pl-9 pr-8 text-[13px] font-medium text-slate-700 outline-none hover:bg-slate-50 transition-colors focus:border-emerald-300 cursor-pointer"
                    >
                      {AI_MODEL_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value} disabled={item.disabled}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 pointer-events-none text-slate-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo,video/mpeg,video/x-ms-wmv,video/x-flv,video/3gpp,video/mp2t,.m4v,.mts,.m2ts,.mpg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                      }}
                      disabled={submitting}
                    />
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {selectedFile ? (
                      <span className="max-w-[120px] truncate">{selectedFile.name}</span>
                    ) : (
                      <span>附件 (视频)</span>
                    )}
                  </label>
                </div>

                <button
                  onClick={() => void handleSend()}
                  disabled={submitting || !selectedFile || selectedFormatOption?.disabled}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-300 transition-colors shadow-sm"
                  title="发送并开始任务"
                >
                  {submitting ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
              {capabilitiesError ? (
                <span className="text-rose-500">检测失败: {capabilitiesError}</span>
              ) : null}
              {capabilities && capabilities.ffmpeg_available === false ? (
                <span className="text-rose-500">缺少 ffmpeg 环境</span>
              ) : null}
              {capabilities && capabilities.ffprobe_available === false ? (
                <span className="text-rose-500">缺少 ffprobe 环境</span>
              ) : null}
              <span>快捷键: Ctrl/Cmd + Enter 发送</span>
              <span>支持格式: MP4, MOV, WEBM 等主流视频</span>
              <span>{selectedFormatOption?.reason ? `提示: ${selectedFormatOption.reason}` : ""}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
