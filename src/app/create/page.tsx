"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  API_BASE,
  clearAuthSession,
  ensureAuthSession,
  fetchWithAuthRetry,
} from "@/lib/auth-client";
import { requestDownloadLink, triggerURLDownload } from "@/lib/download-client";
import { useJobStream, type JobStreamEnvelope } from "@/hooks/useJobStream";
import { AIConsole } from "@/components/create/workbench/AIConsole";
import { TaskExplorer } from "@/components/create/workbench/TaskExplorer";
import { VisualCanvas } from "@/components/create/workbench/VisualCanvas";
import { TaskInitDrawer } from "@/components/create/workbench/TaskInitDrawer";

type VideoJobItem = {
  id: number;
  title: string;
  source_video_key: string;
  source_video_url?: string;
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
  result_summary?: {
    collection_id?: number;
    collection_title?: string;
    file_count?: number;
    preview_images?: string[];
    format_summary?: string[];
  };
  billing?: {
    actual_cost_cny?: number;
    currency?: string;
    pricing_version?: string;
    charged_points?: number;
    reserved_points?: number;
    hold_status?: string;
    point_per_cny?: number;
    cost_markup_multiplier?: number;
  };
};

type VideoJobListResponse = {
  items?: VideoJobItem[];
};

type UploadTokenResponse = {
  token: string;
  key?: string;
  prefix?: string;
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

type VideoJobResultEmojiItem = {
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
  output_score?: number;
};

type VideoJobResultResponse = {
  job_id: number;
  status?: string;
  message?: string;
  emojis?: VideoJobResultEmojiItem[];
  collection?: Record<string, unknown>;
  options?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
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

function removeMapKey<T>(source: Record<number, T>, key: number) {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return source;
  const next = { ...source };
  delete next[key];
  return next;
}

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

type AdvancedSceneOption = {
  value: string;
  label: string;
  description?: string;
  operator_identity?: string;
  candidate_count_min?: number;
  candidate_count_max?: number;
};

type AdvancedFocusOption = {
  value: "portrait" | "action" | "vibe" | "text";
  label: string;
};

type AdvancedSceneOptionsResponse = {
  format?: string;
  resolved_from?: string;
  version?: string;
  items?: Array<{
    scene?: string;
    label?: string;
    description?: string;
    operator_identity?: string;
    candidate_count_min?: number;
    candidate_count_max?: number;
  }>;
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
    description: "由系统根据任务自动选择最合适模型。",
  },
  {
    value: "qwen-plus",
    label: "通义千问 Qwen-Plus",
    description: "平衡质量与速度。",
  },
  {
    value: "qwen-max",
    label: "通义千问 Qwen-Max",
    description: "高质量优先。",
  },
  {
    value: "qwen-turbo",
    label: "通义千问 Qwen-Turbo",
    description: "极速低延迟。",
  },
  {
    value: "doubao-vision-pro",
    label: "豆包视觉（开发中）",
    description: "开发中",
    disabled: true,
  },
  {
    value: "self-vision-v1",
    label: "自研视觉（开发中）",
    description: "开发中",
    disabled: true,
  },
];

const FALLBACK_FORMAT_OPTIONS: FormatOption[] = [
  { value: "png", label: "PNG" },
  { value: "gif", label: "GIF" },
  { value: "jpg", label: "JPG", disabled: true, reason: "开发中" },
  { value: "webp", label: "WEBP", disabled: true, reason: "开发中" },
  { value: "live", label: "LIVE", disabled: true, reason: "开发中" },
  { value: "mp4", label: "MP4", disabled: true, reason: "开发中" },
];
const MAINLINE_AVAILABLE_FORMATS = new Set<string>(["png", "gif"]);
const TASK_PROMPT_MAX_CHARS = 200;

const FALLBACK_ADVANCED_SCENE_OPTIONS: AdvancedSceneOption[] = [
  { value: "default", label: "通用截图", description: "默认平衡策略，适合大多数场景。" },
  { value: "xiaohongshu", label: "小红书网感", description: "偏重高吸引力封面与清晰特写。" },
  { value: "wallpaper", label: "手机壁纸", description: "偏重构图干净、主体居中、竖屏友好。" },
  { value: "news", label: "新闻配图", description: "偏重纪实客观、信息表达完整。" },
];
const PNG_MAINLINE_SCENE_ALLOWLIST = ["default", "xiaohongshu"] as const;

const ADVANCED_FOCUS_OPTIONS: AdvancedFocusOption[] = [
  { value: "portrait", label: "人物与面部" },
  { value: "action", label: "动作瞬间" },
  { value: "vibe", label: "场景氛围" },
  { value: "text", label: "文字字幕" },
];


function createMessageID() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stripFileExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

function normalizeTitleChunk(raw: string, maxLen = 24) {
  const compact = raw.replace(/\s+/g, " ").replace(/[\r\n\t]+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, Math.max(1, maxLen - 1)).trim()}…`;
}

function buildVideoJobTitle(input: { format: string; prompt?: string; fileName?: string }) {
  const formatTag = (input.format || "png").trim().toUpperCase() || "PNG";
  const promptPart = normalizeTitleChunk((input.prompt || "").trim(), 24);
  if (promptPart) {
    return `${formatTag}｜${promptPart}`;
  }
  const filePart = normalizeTitleChunk(stripFileExtension((input.fileName || "").trim()), 24);
  if (filePart) {
    return `${formatTag}｜${filePart}`;
  }
  const now = new Date();
  const ts = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(
    now.getHours()
  ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `${formatTag}｜任务 ${ts}`;
}

function formatTime(value?: string | number) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN");
}

function isSameLocalDay(value?: string | number, base = new Date()) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === base.getFullYear() &&
    d.getMonth() === base.getMonth() &&
    d.getDate() === base.getDate()
  );
}

function formatBytes(value?: number) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024) return `${size.toFixed(0)} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function resolveResultImageURL(item?: VideoJobResultEmojiItem | null) {
  if (!item) return "";
  const fileURL = (item.file_url || "").trim();
  if (fileURL) return fileURL;
  return (item.thumb_url || "").trim();
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

function filterAdvancedSceneOptionsForMainline(format: string, options: AdvancedSceneOption[]) {
  const normalizedFormat = format.trim().toLowerCase();
  if (normalizedFormat !== "png") {
    return options;
  }
  const allow = new Set<string>(PNG_MAINLINE_SCENE_ALLOWLIST);
  const filtered = options.filter((item) => allow.has((item.value || "").trim().toLowerCase()));
  if (filtered.length > 0) {
    filtered.sort((a, b) => {
      if (a.value === "default") return -1;
      if (b.value === "default") return 1;
      return a.label.localeCompare(b.label, "zh-CN");
    });
    return filtered;
  }
  return FALLBACK_ADVANCED_SCENE_OPTIONS.filter((item) => allow.has(item.value));
}

function resolveRequestedFormats(item: VideoJobItem) {
  const fromMetrics = parseFormatList(item.metrics?.output_formats_requested);
  if (fromMetrics.length) return fromMetrics;
  return parseFormatList(item.output_formats);
}

function executionLaneLabel(raw: unknown) {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  switch (value) {
    case "video_gif":
      return "GIF 专线";
    case "video_png":
      return "PNG 专线";
    case "video_jpg":
      return "JPG 专线";
    case "video_webp":
      return "WebP 专线";
    case "video_live":
      return "Live 专线";
    case "video_mp4":
      return "MP4 专线";
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

function inferResultDownloadExt(item?: VideoJobResultEmojiItem | null) {
  const format = String(item?.format || "")
    .trim()
    .toLowerCase()
    .replace(/^image\//, "");
  if (format === "jpeg") return "jpg";
  if (format) return format;

  const source = String(item?.file_url || item?.thumb_url || "")
    .split("?")[0]
    .split("#")[0];
  const ext = source.includes(".") ? source.split(".").pop() || "" : "";
  return ext ? ext.toLowerCase() : "png";
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
    // ignore parse error
  }
  return trimmed.replace(/^\/+/, "").split("?")[0].split("#")[0];
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

function buildResultDownloadName(item?: VideoJobResultEmojiItem | null, preferredName = "") {
  const ext = inferResultDownloadExt(item);
  const base = (preferredName || item?.title || `output-${item?.id || "image"}`).trim();
  if (!base) return `output.${ext}`;
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  return `${base}.${ext}`;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  if (!blob || blob.size <= 0) return;
  const objectURL = URL.createObjectURL(blob);
  triggerURLDownload(objectURL, fileName);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectURL);
  }, 1800);
}

function toFriendlyDownloadMessage(raw: string, fallback = "下载失败，请稍后重试") {
  const text = String(raw || "").trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  if (
    lower === "failed to fetch" ||
    lower.includes("networkerror") ||
    lower.includes("load failed")
  ) {
    return "网络连接异常，请稍后重试";
  }
  return text;
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
  const raw = value.trim();
  const normalized = raw.toLowerCase();
  switch (normalized) {
    case "social_spread":
      return "社交传播";
    case "entertainment":
      return "娱乐氛围";
    case "news":
      return "资讯表达";
    case "design_asset":
      return "设计素材";
    default:
      return /[\u4e00-\u9fff]/.test(raw) ? raw : "";
  }
}

function selectorModeLabel(value: string) {
  const raw = value.trim();
  const normalized = raw.toLowerCase();
  switch (normalized) {
    case "focus_window":
      return "重点片段筛选";
    case "motion_sweep":
      return "动态扫帧";
    case "scene_cut":
      return "镜头切换筛选";
    case "full_scan":
      return "全片扫描";
    default:
      return /[\u4e00-\u9fff]/.test(raw) ? raw : "";
  }
}

function visualFocusLabel(value: string) {
  const raw = value.trim();
  const normalized = raw.toLowerCase();
  switch (normalized) {
    case "subject":
      return "主体";
    case "face":
      return "人物";
    case "motion":
      return "动作";
    case "text":
      return "文字";
    default:
      return /[\u4e00-\u9fff]/.test(raw) ? raw : "";
  }
}

function recommendationLabel(value: string) {
  const raw = value.trim();
  const normalized = raw.toLowerCase();
  switch (normalized) {
    case "manual_review":
      return "建议人工抽检";
    case "auto_deliver":
      return "建议直接交付";
    case "rerun":
      return "建议重新处理";
    default:
      return /[\u4e00-\u9fff]/.test(raw) ? raw : "";
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
  if (goal || audience) {
    parts.push(`我理解这次要做的是${goal || "高质量出图"}${audience ? `，面向${audience}` : ""}`);
  }
  if (mustCapture.length) parts.push(`我会优先抓取：${mustCapture.slice(0, 3).join("、")}`);
  if (avoid.length) parts.push(`我会尽量避开：${avoid.slice(0, 3).join("、")}`);
  if (clipMin || clipMax) {
    parts.push(`预计先给出 ${clipMin || "-"}~${clipMax || "-"} 张候选`);
  }
  return parts.join("。\n");
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

function buildAI2NaturalReply(metadata?: Record<string, unknown>) {
  if (!metadata) return "";
  const objective = businessGoalLabel(stringFromAny(metadata.objective || metadata.business_goal));
  const sceneLabel = selectorModeLabel(stringFromAny(metadata.scene_label || metadata.mode));
  const focus = stringListFromAny(metadata.visual_focus).map((item) => visualFocusLabel(item)).filter(Boolean);
  const selectedCountRaw = Number(metadata.selected_count ?? 0);
  const selectedCount = Number.isFinite(selectedCountRaw) && selectedCountRaw > 0 ? selectedCountRaw : 0;
  const scoreRaw = Number(metadata.selected_score ?? 0);
  const score = Number.isFinite(scoreRaw) && scoreRaw > 0 ? scoreRaw : 0;
  const startSec = numberDisplay(metadata.selected_start_sec, 2);
  const endSec = numberDisplay(metadata.selected_end_sec, 2);

  const parts: string[] = [];
  if (sceneLabel) parts.push(`按「${sceneLabel}」策略执行筛选`);
  if (objective) parts.push(`当前目标：${objective}`);
  if (focus.length) parts.push(`重点关注：${focus.slice(0, 2).join("、")}`);
  if (startSec || endSec) parts.push(`高价值片段大致在 ${startSec || "-"}s ~ ${endSec || "-"}s`);
  if (selectedCount > 0) parts.push(`先筛出 ${selectedCount} 张候选图`);
  if (score > 0) parts.push(`当前综合匹配度 ${score.toFixed(3)}`);
  return parts.join("。\n");
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

function buildAI3NaturalReply(metadata?: Record<string, unknown>) {
  if (!metadata) return "";
  const deliverCount = Number(metadata.deliver_count ?? 0);
  const rejectCount = Number(metadata.reject_count ?? 0);
  const recommendation = recommendationLabel(stringFromAny(metadata.recommendation));
  const note = extractSummaryNote(metadata.summary);
  const parts: string[] = [];
  if (deliverCount > 0) parts.push(`最终可交付 ${deliverCount} 张`);
  if (rejectCount > 0) parts.push(`已过滤 ${rejectCount} 张不合格结果`);
  if (note) parts.push(note);
  else if (recommendation) parts.push(`建议策略：${recommendation}`);
  return parts.join("。\n");
}

function presentEventMessage(event: VideoJobEventItem): EventPresentation {
  const raw = (event.message || "").trim();
  const normalized = raw.toLowerCase();
  const metadata = event.metadata;

  if (normalized.includes("sub-stage briefing started")) {
    return {
      role: "assistant" as const,
      name: "AI1",
      text: "我先快速看一遍视频内容，并结合你的指令理解这次“出图目标”。",
      meta: "",
    };
  }
  if (normalized.includes("ai director prompt pack generated")) {
    const reply = buildAI1NaturalReply(metadata);
    return {
      role: "assistant" as const,
      name: "AI1",
      text: reply ? `先给你我的理解：\n${reply}` : "我已完成第一轮理解。",
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
      text: reply ? `先给你我的理解：\n${reply}` : "我已完成第一轮理解。",
      meta: summarizeMetadata(metadata),
      rawMetadata: metadata,
      ai1Card: buildAI1Card(metadata),
    };
  }
  if (normalized === "ai1 waiting user confirmation") {
    return {
      role: "assistant" as const,
      name: "AI1",
      text: "我先给出第一版理解与策略建议，确认后我再继续执行筛选与出图。",
      meta: summarizeMetadata(metadata),
    };
  }
  if (normalized === "user confirmed continue after ai1") {
    return {
      role: "assistant" as const,
      name: "AI2",
      text: "收到确认，我开始逐帧筛选并生成候选方案。",
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
    return {
      role: "assistant" as const,
      name: "AI2",
      text: "我正在逐帧比较清晰度、主体完整度和场景命中度，准备给出候选结果。",
      meta: "",
    };
  }
  if (normalized.includes("ai planner suggestion applied")) {
    const reply = buildAI2NaturalReply(metadata);
    return {
      role: "assistant" as const,
      name: "AI2",
      text: reply ? `我的筛选过程与结果：\n${reply}` : "我已完成候选方案筛选。",
      meta: summarizeMetadata(metadata),
      rawMetadata: metadata,
      ai2Card: buildAI2Card(metadata),
    };
  }
  if (normalized.includes("sub-stage reviewing started")) {
    return {
      role: "assistant" as const,
      name: "AI3",
      text: "我在做最后一轮质量复审，过滤模糊、曝光异常和不稳定画面。",
      meta: "",
    };
  }
  if (normalized.endsWith("ai judge completed") || normalized === "ai judge completed") {
    const reply = buildAI3NaturalReply(metadata);
    return {
      role: "assistant" as const,
      name: "AI3",
      text: reply ? `最后一轮复审结论：\n${reply}` : "我已完成最终质量复审。",
      meta: summarizeMetadata(metadata),
      rawMetadata: metadata,
      ai3Card: buildAI3Card(metadata),
    };
  }
  if (normalized === "video job completed") {
    return {
      role: "assistant" as const,
      name: "系统",
      text: "🎉 任务处理完成！可前往“我的作品”查看或下载最终资产。",
      meta: summarizeMetadata(metadata),
    };
  }
  if (normalized === "video job started") {
    return { role: "assistant" as const, name: "系统", text: "任务已进入处理队列，正在分配算力节点...", meta: "" };
  }

  // Hide noisy worker/system logs from the main timeline unless they are errors
  if (normalizeEventLevel(event.level) === "error") {
    const hasChinese = /[\u4e00-\u9fff]/.test(raw);
    return {
      role: "system" as const,
      name: "系统异常",
      text: hasChinese ? raw : "处理过程中发生异常，请稍后重试。",
      meta: summarizeMetadata(metadata),
      rawMetadata: metadata,
    };
  }

  // For other info/warn logs, we still return them but we might want to filter them out in the UI
  return {
    role: "system" as const,
    name: "系统",
    text: "流程已更新，正在继续处理。",
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
  const [previewEmptyState, setPreviewEmptyState] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const [jobs, setJobs] = useState<VideoJobItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [capabilities, setCapabilities] = useState<VideoCapabilitiesResponse | null>(null);

  const [selectedFormat, setSelectedFormat] = useState<string>("png");
  const [selectedAIModel, setSelectedAIModel] = useState<string>("auto");
  const [promptText, setPromptText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [advancedSceneOptions, setAdvancedSceneOptions] = useState<AdvancedSceneOption[]>(
    filterAdvancedSceneOptionsForMainline("png", FALLBACK_ADVANCED_SCENE_OPTIONS)
  );
  const [advancedScene, setAdvancedScene] = useState<AdvancedSceneOption["value"]>("default");
  const [advancedVisualFocus, setAdvancedVisualFocus] = useState<AdvancedFocusOption["value"][]>([]);

  const [timeline, setTimeline] = useState<TimelineMessage[]>([
    {
      id: createMessageID(),
      role: "system",
      name: "系统",
      level: "info",
      text: "欢迎使用 AI 视觉资产生产工作台。流程是：参数准备 → 上传 → 创建任务 → AI1/AI2/Worker/AI3 逐步反馈。",
      ts: Date.now(),
    },
  ]);

  const [activeJobID, setActiveJobID] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingContinue, setConfirmingContinue] = useState(false);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [jobResultMap, setJobResultMap] = useState<Record<number, VideoJobResultResponse | null>>({});
  const [jobResultErrorMap, setJobResultErrorMap] = useState<Record<number, string>>({});
  const [loadingResultJobID, setLoadingResultJobID] = useState<number | null>(null);
  const [downloadingOriginal, setDownloadingOriginal] = useState(false);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [mobilePane, setMobilePane] = useState<"tasks" | "canvas" | "console">("canvas");
  const [taskInitDrawerOpen, setTaskInitDrawerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const eventCursorRef = useRef<Record<number, number>>({});
  const seenEventRef = useRef<Set<string>>(new Set());
  const announcedActiveJobRef = useRef<number | null>(null);

  const activeJob = useMemo(() => jobs.find((item) => item.id === activeJobID) || null, [jobs, activeJobID]);
  const todayJobs = useMemo(() => {
    const now = new Date();
    return jobs.filter((item) => isSameLocalDay(item.created_at || item.updated_at, now));
  }, [jobs]);
  const viewTodayJobs = useMemo(() => (previewEmptyState ? [] : todayJobs), [previewEmptyState, todayJobs]);
  const viewActiveJob = useMemo(() => (previewEmptyState ? null : activeJob), [previewEmptyState, activeJob]);
  const viewActiveJobID = useMemo(() => (previewEmptyState ? null : activeJobID), [previewEmptyState, activeJobID]);
  const activeJobResult = useMemo(() => {
    if (!activeJobID) return null;
    return jobResultMap[activeJobID] || null;
  }, [activeJobID, jobResultMap]);
  const activeResultEmojis = useMemo(() => {
    const list = Array.isArray(activeJobResult?.emojis) ? [...activeJobResult.emojis] : [];
    list.sort((a, b) => {
      const orderDiff = Number(a.display_order || 0) - Number(b.display_order || 0);
      if (orderDiff !== 0) return orderDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    });
    return list;
  }, [activeJobResult]);

  const resolveJobPreviewURL = useCallback(
    (job: VideoJobItem) => {
      const previews = Array.isArray(job.result_summary?.preview_images) ? job.result_summary?.preview_images : [];
      for (const entry of previews) {
        const raw = typeof entry === "string" ? entry.trim() : "";
        if (raw) return raw;
      }
      const result = jobResultMap[job.id];
      if (!result || !Array.isArray(result.emojis) || result.emojis.length === 0) return "";
      const ordered = [...result.emojis].sort((a, b) => {
        const orderDiff = Number(a.display_order || 0) - Number(b.display_order || 0);
        if (orderDiff !== 0) return orderDiff;
        return Number(a.id || 0) - Number(b.id || 0);
      });
      return resolveResultImageURL(ordered[0] || null);
    },
    [jobResultMap]
  );

  const activeJobAwaitingAI1Confirm = useMemo(
    () => (activeJob?.stage || "").trim().toLowerCase() === "awaiting_ai1_confirm",
    [activeJob]
  );

  const hasRunningJob = useMemo(
    () => jobs.some((item) => item.status === "queued" || item.status === "running"),
    [jobs]
  );
  useEffect(() => {
    setActivePreviewIndex(0);
  }, [activeJobID]);
  useEffect(() => {
    if (!activeJobID) return;
    setMobilePane("canvas");
  }, [activeJobID]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const preview =
      String(params.get("preview") || "").trim().toLowerCase() === "empty" ||
      String(params.get("preview_empty") || "").trim() === "1";
    setPreviewEmptyState(preview);
  }, []);

  const resetTaskInitDraft = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setPromptText("");
  }, []);

  const openTaskInitDrawer = useCallback(
    (autoPickFile = false) => {
      setTaskInitDrawerOpen(true);
      if (!autoPickFile) return;
      window.setTimeout(() => {
        fileInputRef.current?.click();
      }, 0);
    },
    []
  );

  const handlePromptChange = useCallback((next: string) => {
    const text = String(next || "");
    if (text.length <= TASK_PROMPT_MAX_CHARS) {
      setPromptText(text);
      return;
    }
    setPromptText(text.slice(0, TASK_PROMPT_MAX_CHARS));
  }, []);

  const appendTimeline = useCallback((input: TimelineMessageInput) => {
    const id = input.id || createMessageID();
    const ts = input.ts || Date.now();
    setTimeline((prev) => [...prev, { ...input, id, ts }]);
    return id;
  }, []);

  const patchTimeline = useCallback((id: string, patch: Partial<TimelineMessage>) => {
    setTimeline((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const pruneRemovedJob = useCallback((jobID: number) => {
    if (!jobID) return;
    setJobs((prev) => prev.filter((item) => item.id !== jobID));
    setActiveJobID((prev) => (prev === jobID ? null : prev));
    setJobResultMap((prev) => removeMapKey(prev, jobID));
    setJobResultErrorMap((prev) => removeMapKey(prev, jobID));
    delete eventCursorRef.current[jobID];
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
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs?limit=30&include_result_summary=1`);
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
      const rawItems = Array.isArray(data.items) ? data.items : [];
      const visibleItems = rawItems.filter((item) => {
        const status = String(item?.status || "").trim().toLowerCase();
        if (status !== "done") return true;
        return Number(item?.result_collection_id || 0) > 0;
      });
      setJobs(visibleItems);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "加载任务失败";
      setGlobalError(msg);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const loadCapabilities = useCallback(async () => {
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
      setGlobalError(msg);
    }
  }, []);

  const loadAdvancedSceneOptions = useCallback(async (format: string) => {
    const targetFormat = (format || "png").trim().toLowerCase() || "png";
    try {
      const res = await fetchWithAuthRetry(
        `${API_BASE}/video-jobs/advanced-scene-options?format=${encodeURIComponent(targetFormat)}`
      );
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        setAdvancedSceneOptions(filterAdvancedSceneOptionsForMainline(targetFormat, FALLBACK_ADVANCED_SCENE_OPTIONS));
        return;
      }
      if (!res.ok) {
        throw new Error((await res.text()) || "加载高级场景失败");
      }
      const data = (await res.json()) as AdvancedSceneOptionsResponse;
      const rows = Array.isArray(data.items) ? data.items : [];
      const seen = new Set<string>();
      const options: AdvancedSceneOption[] = [];
      for (const item of rows) {
        const value = String(item?.scene || "").trim().toLowerCase();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        options.push({
          value,
          label: String(item?.label || value).trim() || value,
          description: String(item?.description || "").trim() || undefined,
          operator_identity: String(item?.operator_identity || "").trim() || undefined,
          candidate_count_min:
            typeof item?.candidate_count_min === "number" && Number.isFinite(item.candidate_count_min)
              ? Math.max(0, Math.round(item.candidate_count_min))
              : undefined,
          candidate_count_max:
            typeof item?.candidate_count_max === "number" && Number.isFinite(item.candidate_count_max)
              ? Math.max(0, Math.round(item.candidate_count_max))
              : undefined,
        });
      }
      if (!seen.has("default")) {
        options.unshift(FALLBACK_ADVANCED_SCENE_OPTIONS[0]);
      }
      const finalOptions = options.length ? options : FALLBACK_ADVANCED_SCENE_OPTIONS;
      finalOptions.sort((a, b) => {
        if (a.value === "default") return -1;
        if (b.value === "default") return 1;
        return a.label.localeCompare(b.label, "zh-CN");
      });
      setAdvancedSceneOptions(filterAdvancedSceneOptionsForMainline(targetFormat, finalOptions));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "加载高级场景失败";
      setGlobalError(msg);
      setAdvancedSceneOptions(filterAdvancedSceneOptionsForMainline(targetFormat, FALLBACK_ADVANCED_SCENE_OPTIONS));
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
    const capabilityByFormat = new Map<string, VideoFormatCapability>();
    for (const item of capabilities?.formats || []) {
      const format = String(item?.format || "").trim().toLowerCase();
      if (!format) continue;
      capabilityByFormat.set(format, item);
    }

    return FALLBACK_FORMAT_OPTIONS.map((base) => {
      const value = base.value.trim().toLowerCase();
      const cap = capabilityByFormat.get(value);
      const mainline = MAINLINE_AVAILABLE_FORMATS.has(value);
      if (!mainline) {
        return {
          value,
          label: `${value.toUpperCase()}（开发中）`,
          disabled: true,
          reason: "开发中",
        } as FormatOption;
      }

      const unsupportedByRuntime = cap?.supported === false;
      const disabled = Boolean(unsupportedByRuntime || base.disabled);
      return {
        value,
        label: value.toUpperCase(),
        disabled,
        reason: unsupportedByRuntime ? cap?.reason || "当前不可用" : base.reason,
      } as FormatOption;
    });
  }, [capabilities]);

  const selectedFormatOption = useMemo(
    () => formatOptions.find((item) => item.value === selectedFormat) || null,
    [formatOptions, selectedFormat]
  );

  const selectedModelOption = useMemo(
    () => AI_MODEL_OPTIONS.find((item) => item.value === selectedAIModel) || AI_MODEL_OPTIONS[0],
    [selectedAIModel]
  );
  const selectedAdvancedSceneOption = useMemo(
    () => advancedSceneOptions.find((item) => item.value === advancedScene) || advancedSceneOptions[0] || FALLBACK_ADVANCED_SCENE_OPTIONS[0],
    [advancedScene, advancedSceneOptions]
  );
  const advancedSceneLabel = useMemo(
    () => selectedAdvancedSceneOption?.label || "通用截图",
    [selectedAdvancedSceneOption]
  );
  const toggleAdvancedFocus = useCallback((value: AdvancedFocusOption["value"]) => {
    setAdvancedVisualFocus((prev) => {
      const exists = prev.includes(value);
      if (exists) {
        return prev.filter((item) => item !== value);
      }
      if (prev.length >= 2) {
        return [prev[1], value];
      }
      return [...prev, value];
    });
  }, []);

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
      if (res.status === 404) {
        pruneRemovedJob(jobID);
        return null;
      }
      if (!res.ok) return null;
      const job = (await res.json()) as VideoJobItem;
      if ((String(job.status || "").trim().toLowerCase() === "done") && Number(job.result_collection_id || 0) <= 0) {
        pruneRemovedJob(jobID);
        return null;
      }
      syncOneJob(job);
      return job;
    },
    [pruneRemovedJob, syncOneJob]
  );

  const loadJobResult = useCallback(
    async (jobID: number, force = false) => {
      if (!jobID) return;
      if (!force && Object.prototype.hasOwnProperty.call(jobResultMap, jobID)) {
        return;
      }
      setLoadingResultJobID(jobID);
      setJobResultErrorMap((prev) => {
        if (!prev[jobID]) return prev;
        const next = { ...prev };
        delete next[jobID];
        return next;
      });
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/result?delivery_only=false`);
        if (res.status === 401) {
          clearAuthSession();
          setIsAuthed(false);
          return;
        }
        if (res.status === 404) {
          pruneRemovedJob(jobID);
          appendTimeline({
            role: "system",
            name: "系统",
            level: "info",
            text: `任务 #${jobID} 已删除，已从任务列表移除。`,
          });
          return;
        }
        if (res.status === 409) {
          const payload = (await res.json()) as VideoJobResultResponse;
          const resultStatus = String(payload?.status || "").trim().toLowerCase();
          if (resultStatus === "done") {
            pruneRemovedJob(jobID);
            appendTimeline({
              role: "system",
              name: "系统",
              level: "info",
              text: `任务 #${jobID} 的作品已删除，已从任务列表移除。`,
            });
            return;
          }
          setJobResultMap((prev) => ({ ...prev, [jobID]: null }));
          return;
        }
        if (!res.ok) {
          throw new Error((await res.text()) || "加载任务结果失败");
        }
        const data = (await res.json()) as VideoJobResultResponse;
        setJobResultMap((prev) => ({ ...prev, [jobID]: data }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "加载任务结果失败";
        setJobResultErrorMap((prev) => ({ ...prev, [jobID]: message }));
      } finally {
        setLoadingResultJobID((prev) => (prev === jobID ? null : prev));
      }
    },
    [appendTimeline, jobResultMap, pruneRemovedJob]
  );

  const handleDownloadOriginal = useCallback(async (item?: VideoJobResultEmojiItem | null) => {
    if (!item || downloadingOriginal) return;
    setDownloadingOriginal(true);
    try {
      const fallbackName = buildResultDownloadName(item, item.title || `output-${item.id || "image"}`);
      const activeJobIDNum = Number(activeJobID || 0);
      const emojiID = Number(item.id || 0);

      if (activeJobIDNum > 0 && emojiID > 0) {
        try {
          const jobRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${activeJobIDNum}/emojis/${emojiID}/download-file`);
          if (jobRes.status === 401) {
            clearAuthSession();
            setIsAuthed(false);
            return;
          }
          if (jobRes.ok) {
            const blob = await jobRes.blob();
            if (blob.size > 0) {
              const headerName = parseDownloadFilenameFromHeader(jobRes.headers.get("content-disposition"));
              const fileName = buildResultDownloadName(item, headerName || item.title || `output-${emojiID}`);
              triggerBlobDownload(blob, fileName);
              return;
            }
          }
        } catch {
          // ignore direct job file download errors and continue fallback flow
        }
      }

      const source = (item.file_key || item.file_url || item.thumb_url || "").trim();
      const objectKey = extractObjectKey(source);
      const likelyVideoAsset = objectKey.includes("/video-image/");
      const proxyURL = objectKey ? `${API_BASE}/storage/proxy?key=${encodeURIComponent(objectKey)}` : "";

      if (proxyURL) {
        try {
          const proxyRes = await fetchWithAuthRetry(proxyURL);
          if (proxyRes.status === 401) {
            clearAuthSession();
            setIsAuthed(false);
            return;
          }
          if (proxyRes.ok) {
            const blob = await proxyRes.blob();
            if (blob.size > 0) {
              triggerBlobDownload(blob, fallbackName);
              return;
            }
          }
        } catch {
          // ignore proxy fetch errors and continue fallback flow
        }
      }

      const directURL = (item.file_url || "").trim();
      if (directURL) {
        try {
          const directRes = await fetch(directURL, { credentials: "omit" });
          if (directRes.ok) {
            const blob = await directRes.blob();
            if (blob.size > 0) {
              triggerBlobDownload(blob, fallbackName);
              return;
            }
          }
        } catch {
          // ignore direct fetch error and continue fallback flow
        }
      }

      if (likelyVideoAsset) {
        throw new Error("原图下载失败，请稍后重试");
      }

      if (emojiID > 0) {
        try {
          const directRes = await fetchWithAuthRetry(`${API_BASE}/emojis/${emojiID}/download-file`);
          if (directRes.status === 401) {
            clearAuthSession();
            setIsAuthed(false);
            return;
          }
          if (directRes.ok) {
            const blob = await directRes.blob();
            const headerName = parseDownloadFilenameFromHeader(directRes.headers.get("content-disposition"));
            const fileName = buildResultDownloadName(item, headerName || item.title || `output-${emojiID}`);
            triggerBlobDownload(blob, fileName);
            return;
          }
        } catch {
          // ignore direct file fetch errors and continue fallback flow
        }

        const result = await requestDownloadLink(`${API_BASE}/emojis/${emojiID}/download`);
        if (result.ok) {
          const fileName = buildResultDownloadName(item, result.data.name || item.title || `output-${emojiID}`);
          triggerURLDownload(result.data.url, fileName);
          return;
        }
      }
      const fallback = (item.file_url || item.thumb_url || "").trim();
      if (!fallback) {
        throw new Error("下载地址为空");
      }
      triggerURLDownload(fallback, fallbackName);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "下载失败";
      setGlobalError(toFriendlyDownloadMessage(message));
    } finally {
      setDownloadingOriginal(false);
    }
  }, [activeJobID, downloadingOriginal]);

  const consumeJobEvents = useCallback(
    (jobID: number, events: VideoJobEventItem[]) => {
      if (!jobID || !Array.isArray(events) || events.length === 0) return;

      const rows: Array<Omit<TimelineMessage, "id">> = [];
      let nextCursor = eventCursorRef.current[jobID] || 0;

      for (const event of events) {
        const eventID = Math.trunc(Number(event.id || 0));
        const dedupeKey =
          eventID > 0
            ? `${jobID}:${eventID}`
            : `${jobID}:fallback:${event.created_at || ""}:${event.stage || ""}:${event.message || ""}`;
        if (seenEventRef.current.has(dedupeKey)) {
          continue;
        }
        seenEventRef.current.add(dedupeKey);

        if (eventID > nextCursor) {
          nextCursor = eventID;
        }

        const presentation = presentEventMessage(event);
        const parsedTS = Date.parse(String(event.created_at || ""));
        rows.push({
          role: presentation.role,
          name: presentation.name,
          level: normalizeEventLevel(event.level),
          text: presentation.text,
          ts: Number.isFinite(parsedTS) ? parsedTS : Date.now(),
          meta: presentation.meta || undefined,
          rawMetadata: presentation.rawMetadata,
          ai1Card: presentation.ai1Card,
          ai2Card: presentation.ai2Card,
          ai3Card: presentation.ai3Card,
          stage: event.stage,
          jobId: jobID,
        });
      }

      if (nextCursor > (eventCursorRef.current[jobID] || 0)) {
        eventCursorRef.current[jobID] = nextCursor;
      }

      if (!rows.length) return;
      setTimeline((prev) => [
        ...prev,
        ...rows.map((row) => ({
          ...row,
          id: createMessageID(),
        })),
      ]);
    },
    []
  );

  const loadJobEvents = useCallback(
    async (jobID: number, reset = false) => {
      if (!jobID) return;
      const sinceID = reset ? 0 : eventCursorRef.current[jobID] || 0;
      const params = new URLSearchParams();
      if (sinceID > 0) {
        params.set("since_id", String(sinceID));
      }
      params.set("limit", reset ? "200" : "120");

      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/events?${params.toString()}`);
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        return;
      }
      if (res.status === 404) {
        return;
      }
      if (!res.ok) {
        const reason = ((await res.text()) || "").trim();
        throw new Error(reason || `加载任务事件失败（HTTP ${res.status}）`);
      }

      const payload = (await res.json()) as VideoJobEventListResponse;
      consumeJobEvents(jobID, Array.isArray(payload.items) ? payload.items : []);

      const nextSinceID = Number(payload.next_since_id || 0);
      if (Number.isFinite(nextSinceID) && nextSinceID > (eventCursorRef.current[jobID] || 0)) {
        eventCursorRef.current[jobID] = Math.trunc(nextSinceID);
      }
    },
    [consumeJobEvents]
  );

  const confirmContinueAfterAI1 = useCallback(
    async (jobID: number) => {
      if (!jobID || confirmingContinue) return;
      setConfirmingContinue(true);
      const stepID = appendTimeline({
        role: "system",
        name: "系统",
        level: "info",
        text: `正在确认任务 #${jobID} 并继续执行...`,
        jobId: jobID,
      });
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/confirm-ai1`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.status === 401) {
          clearAuthSession();
          setIsAuthed(false);
          throw new Error("登录已失效，请重新登录后重试");
        }
        if (!res.ok) {
          const raw = ((await res.text()) || "").trim();
          let message = raw || `确认继续失败（HTTP ${res.status}）`;
          try {
            const obj = JSON.parse(raw) as { error?: string; message?: string; current_plan_revision?: number };
            if (obj.error === "ai1_plan_revision_conflict") {
              const revision = Number(obj.current_plan_revision || 0);
              message = Number.isFinite(revision) && revision > 0
                ? `AI1 计划版本已变化（当前版本 ${revision}），请刷新任务后重试`
                : "AI1 计划版本已变化，请刷新任务后重试";
            } else {
              message = String(obj.message || obj.error || message);
            }
          } catch {
            // keep parsed message fallback
          }
          throw new Error(message);
        }

        const updated = (await res.json()) as VideoJobItem;
        syncOneJob(updated);
        patchTimeline(stepID, {
          level: "success",
          text: `任务 #${jobID} 已确认，正在继续执行 AI2/Worker/AI3。`,
          jobId: jobID,
        });
        await loadJobEvents(jobID, false);
        await loadJobs();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "确认继续失败";
        patchTimeline(stepID, { level: "error", text: msg, jobId: jobID });
      } finally {
        setConfirmingContinue(false);
      }
    },
    [appendTimeline, confirmingContinue, loadJobEvents, loadJobs, patchTimeline, syncOneJob]
  );

  const handleCancelJob = useCallback(
    async (jobID: number) => {
      if (!jobID) return;
      if (!window.confirm(`确认中止任务 #${jobID} 吗？\n中止后将停止处理，且不交付本次图片结果。`)) return;

      const stepID = appendTimeline({
        role: "system",
        name: "系统",
        level: "warn",
        text: `正在中止任务 #${jobID}...`,
        jobId: jobID,
      });
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.status === 401) {
          clearAuthSession();
          setIsAuthed(false);
          throw new Error("登录已失效，请重新登录后重试");
        }
        if (!res.ok) {
          const raw = ((await res.text()) || "").trim();
          let message = raw || `取消任务失败（HTTP ${res.status}）`;
          try {
            const obj = JSON.parse(raw) as { error?: string; message?: string; status?: string };
            message = String(obj.message || obj.error || message);
          } catch {
            // keep parsed message fallback
          }
          throw new Error(message);
        }
        const updated = (await res.json()) as VideoJobItem;
        syncOneJob(updated);
        patchTimeline(stepID, {
          level: "success",
          text: `任务 #${jobID} 已中止`,
          jobId: jobID,
        });
        await loadJobEvents(jobID, false);
        await loadJobs();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "取消任务失败";
        patchTimeline(stepID, { level: "error", text: msg, jobId: jobID });
      }
    },
    [appendTimeline, loadJobEvents, loadJobs, patchTimeline, syncOneJob]
  );

  const handleJobStreamEnvelope = useCallback(
    (envelope: JobStreamEnvelope) => {
      if (!activeJobID) return;
      const jobIDFromEnvelope = Number(envelope.job_id || 0);
      if (jobIDFromEnvelope > 0 && jobIDFromEnvelope !== activeJobID) return;
      if (String(envelope.type || "").toLowerCase() !== "video_job_event") return;
      if (!envelope.event) return;
      consumeJobEvents(activeJobID, [envelope.event as VideoJobEventItem]);
      const nextSinceID = Number(envelope.next_since_id || envelope.event.id || 0);
      if (Number.isFinite(nextSinceID) && nextSinceID > (eventCursorRef.current[activeJobID] || 0)) {
        eventCursorRef.current[activeJobID] = Math.trunc(nextSinceID);
      }
    },
    [activeJobID, consumeJobEvents]
  );

  const handleJobStreamFallbackPoll = useCallback(async () => {
    if (!activeJobID) return;
    await loadJobEvents(activeJobID, false);
  }, [activeJobID, loadJobEvents]);

  const activeJobCursor = activeJobID ? eventCursorRef.current[activeJobID] || 0 : 0;
  const jobStreamState = useJobStream({
    apiBase: API_BASE,
    jobID: activeJobID,
    enabled: Boolean(isAuthed && activeJobID),
    initialSinceID: activeJobCursor,
    onEnvelope: handleJobStreamEnvelope,
    onFallbackPoll: handleJobStreamFallbackPoll,
    fallbackIntervalMs: 2800,
  });

  const handleSend = useCallback(async () => {
    if (submitting) return;

    const file = selectedFile;
    if (!file) {
      appendTimeline({ role: "system", name: "系统", level: "warn", text: "请先选择一个视频文件再发送。" });
      return;
    }

    const normalizedFormat = selectedFormat.trim().toLowerCase();
    if (!normalizedFormat) {
      appendTimeline({ role: "system", name: "系统", level: "warn", text: "请选择输出格式。" });
      return;
    }
    if (!MAINLINE_AVAILABLE_FORMATS.has(normalizedFormat)) {
      appendTimeline({
        role: "system",
        name: "系统",
        level: "warn",
        text: `${normalizedFormat.toUpperCase()} 格式仍在研发中，请先使用 PNG 或 GIF。`,
      });
      return;
    }

    if (capabilityMap.get(normalizedFormat)?.supported === false) {
      appendTimeline({
        role: "system",
        name: "系统",
        level: "warn",
        text: `当前服务器暂不支持 ${normalizedFormat.toUpperCase()}，请切换格式后重试。`,
      });
      return;
    }

    const userPrompt = promptText.trim();
    if (userPrompt.length > TASK_PROMPT_MAX_CHARS) {
      appendTimeline({
        role: "system",
        name: "系统",
        level: "warn",
        text: `任务描述最多 ${TASK_PROMPT_MAX_CHARS} 个字符，请精简后重试。`,
      });
      return;
    }
    const modelLabel = selectedModelOption?.label || selectedAIModel;
    const advancedSceneForPayload = normalizedFormat === "png" ? advancedScene : "default";
    const advancedFocusForPayload = normalizedFormat === "png" ? advancedVisualFocus : [];

    setSubmitting(true);
    setGlobalError(null);

    appendTimeline({
      role: "user",
      level: "info",
      text: userPrompt || `请帮我把这个视频转换为 ${normalizedFormat.toUpperCase()} 图片。`,
      meta: `格式：${normalizedFormat.toUpperCase()} · 模型：${modelLabel} · 场景：${
        normalizedFormat === "png" ? advancedSceneLabel : "研发中"
      } · 文件：${file.name}`,
    });

    try {
      const step1 = appendTimeline({ role: "system", level: "info", text: "步骤 1/4：正在分析本地视频信息..." });
      const localInsight = await probeLocalVideoFile(file);
      patchTimeline(step1, {
        level: "success",
        text: "步骤 1/4：本地视频分析完成",
        meta: `${localInsight.width || "-"}x${localInsight.height || "-"} · ${
          localInsight.duration_sec ? `${localInsight.duration_sec}s` : "-"
        } · ${formatBytes(localInsight.size_bytes)}`,
      });

      const key = makeVideoKey(file.name);
      const step2 = appendTimeline({ role: "system", level: "info", text: "步骤 2/4：申请上传凭证..." });

      const parseUploadTokenError = async (res: Response) => {
        const raw = ((await res.text()) || "").trim();
        if (!raw) return "";
        try {
          const obj = JSON.parse(raw) as { error?: string; message?: string };
          return String(obj?.message || obj?.error || raw);
        } catch {
          return raw;
        }
      };

      let tokenSource = "video-jobs:key";
      let tokenRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs/upload-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, insert_only: true }),
      });

      if (tokenRes.status === 403) {
        const errText = (await parseUploadTokenError(tokenRes)).toLowerCase();
        if (errText.includes("forbidden")) {
          tokenRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs/upload-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ insert_only: true }),
          });
          tokenSource = "video-jobs:auto-prefix";
        }
      }

      if (tokenRes.status === 404) {
        tokenRes = await fetchWithAuthRetry(`${API_BASE}/storage/upload-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, insert_only: true }),
        });
        tokenSource = "storage-compat";
      }
      if (tokenRes.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        throw new Error("请先登录后上传视频");
      }
      if (!tokenRes.ok) {
        const reason = await parseUploadTokenError(tokenRes);
        if (tokenSource === "storage-compat" && tokenRes.status === 403 && reason.toLowerCase() === "forbidden") {
          throw new Error("上传凭证接口被拒绝：当前后端 /api/storage/upload-token 仅管理员可用，且 /api/video-jobs/upload-token 不可用。请同步后端并重启服务。");
        }
        if (tokenRes.status === 404) {
          throw new Error("后端缺少 /api/video-jobs/upload-token 接口，请先更新并重启后端服务。");
        }
        throw new Error(reason || `获取上传凭证失败（HTTP ${tokenRes.status}）`);
      }

      const tokenData = (await tokenRes.json()) as UploadTokenResponse;
      const uploadKeyFromPrefix = tokenData.prefix
        ? `${tokenData.prefix}${Date.now()}-${sanitizeFileName(file.name || "video.mp4") || "video.mp4"}`
        : "";
      const uploadKey = tokenData.key || uploadKeyFromPrefix || key;
      const upHost = tokenData.up_host || "https://up.qiniup.com";

      if (!uploadKey) {
        throw new Error("上传凭证未返回可用文件 Key");
      }

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
        meta: `源视频 Key：${uploadKey} · 凭证来源：${tokenSource}`,
      });

      const step3 = appendTimeline({ role: "system", level: "info", text: "步骤 3/4：服务端探测视频信息..." });
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

      const step4 = appendTimeline({ role: "system", level: "info", text: "步骤 4/4：创建任务中..." });

      const payload: Record<string, unknown> = {
        title: buildVideoJobTitle({
          format: normalizedFormat,
          prompt: userPrompt,
          fileName: file.name || "",
        }),
        prompt: userPrompt,
        ai_model: selectedAIModel,
        flow_mode: "ai1_confirm",
        source_video_key: uploadKey,
        auto_highlight: true,
        output_formats: [normalizedFormat],
        advanced_options: {
          scene: advancedSceneForPayload,
          visual_focus: advancedFocusForPayload,
          enhance_super_resolution: true, // 临时硬编码开启超分测试
          enhance_face: true, // 临时硬编码开启人脸修复测试
        },
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

      appendTimeline({
        role: "system",
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
      setTaskInitDrawerOpen(false);
      setShowAdvancedOptions(false);
      setMobilePane("canvas");

      await loadJobEvents(created.id, true);
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "处理失败";
      appendTimeline({ role: "system", name: "系统异常", level: "error", text: `${msg}，请检查后重试。` });
    } finally {
      setSubmitting(false);
    }
  }, [
    advancedScene,
    advancedSceneLabel,
    advancedVisualFocus,
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
    if (!isAuthed) return;
    void loadAdvancedSceneOptions(selectedFormat);
  }, [isAuthed, loadAdvancedSceneOptions, selectedFormat]);

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
    if (!AI_MODEL_OPTIONS.length) return;
    const exists = AI_MODEL_OPTIONS.some((item) => item.value === selectedAIModel && !item.disabled);
    if (exists) return;
    const fallback = AI_MODEL_OPTIONS.find((item) => !item.disabled)?.value || "auto";
    if (fallback !== selectedAIModel) {
      setSelectedAIModel(fallback);
    }
  }, [selectedAIModel]);

  useEffect(() => {
    if (!advancedSceneOptions.length) return;
    const exists = advancedSceneOptions.some((item) => item.value === advancedScene);
    if (exists) return;
    const fallback =
      advancedSceneOptions.find((item) => item.value === "default")?.value ||
      advancedSceneOptions[0]?.value ||
      "default";
    if (fallback !== advancedScene) {
      setAdvancedScene(fallback);
    }
  }, [advancedScene, advancedSceneOptions]);

  useEffect(() => {
    if (previewEmptyState) return;
    if (todayJobs.length === 0) {
      if (activeJobID && !todayJobs.some((item) => item.id === activeJobID)) {
        setActiveJobID(null);
      }
      return;
    }
    if (activeJobID && todayJobs.some((item) => item.id === activeJobID)) return;
    setActiveJobID(todayJobs[0].id);
  }, [todayJobs, activeJobID, previewEmptyState]);

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
        role: "system",
        name: "系统",
        level: "info",
        text: `已切换到任务 #${activeJobID}，正在同步处理日志...`,
      });
      void loadJobEvents(activeJobID, true);
    }

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      await loadJobDetail(activeJobID);
    };

    void poll();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    }, 3200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobID, appendTimeline, isAuthed, loadJobDetail, loadJobEvents]);

  useEffect(() => {
    if (!isAuthed || !activeJobID) return;
    if ((activeJob?.status || "").trim().toLowerCase() !== "done") return;
    void loadJobResult(activeJobID);
  }, [activeJob?.status, activeJobID, isAuthed, loadJobResult]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (mobilePane !== "canvas") {
        setMobilePane("canvas");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobilePane]);

  const activeResultError = useMemo(() => {
    if (!activeJobID) return "";
    return (jobResultErrorMap[activeJobID] || "").trim();
  }, [activeJobID, jobResultErrorMap]);
  const activeResultPendingInitialLoad = useMemo(() => {
    if (!activeJobID || !activeJob) return false;
    if ((activeJob.status || "").trim().toLowerCase() !== "done") return false;
    const hasResultState = Object.prototype.hasOwnProperty.call(jobResultMap, activeJobID);
    const hasErrorState = Object.prototype.hasOwnProperty.call(jobResultErrorMap, activeJobID);
    return !hasResultState && !hasErrorState;
  }, [activeJob, activeJobID, jobResultErrorMap, jobResultMap]);
  const viewActiveResultEmojis = useMemo(
    () => (previewEmptyState ? [] : activeResultEmojis),
    [previewEmptyState, activeResultEmojis]
  );
  const viewActiveResultError = previewEmptyState ? "" : activeResultError;
  const cleanTimeline = useMemo(() => {
    const matchesActiveJob = (item: TimelineMessage) => {
      if (!activeJobID) return true;
      if (!item.jobId) return item.role === "user";
      return item.jobId === activeJobID;
    };
    return timeline.filter((item) => {
      if (!matchesActiveJob(item)) return false;
      if (item.level === "error") return true;
      if (item.role === "user") return true;
      if (item.ai1Card || item.ai2Card || item.ai3Card) return true;
      if (item.role !== "assistant") return false;
      return (
        item.text.includes("任务处理完成") ||
        item.text.includes("等待") ||
        item.text.includes("确认") ||
        item.text.includes("已切换到任务")
      );
    });
  }, [activeJobID, timeline]);
  const taskInitSendBlockReason = useMemo(() => {
    if (submitting) return "任务提交中，请稍候…";
    if (selectedFormatOption?.disabled) {
      return selectedFormatOption.reason
        ? `当前格式暂不可用：${selectedFormatOption.reason}`
        : `当前格式暂不可用`;
    }
    if (!selectedFile) return "请先选择一个视频文件";
    return "";
  }, [selectedFile, selectedFormatOption, submitting]);
  const taskInitSendDisabled = taskInitSendBlockReason.length > 0;

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

  const streamMode = jobStreamState.mode === "streaming" || jobStreamState.mode === "fallback" ? jobStreamState.mode : "connecting";
  const canCancelActiveJob = Boolean(activeJob && (activeJob.status === "queued" || activeJob.status === "running"));
  const viewCanCancelActiveJob = previewEmptyState ? false : canCancelActiveJob;
  const viewActiveJobAwaitingAI1Confirm = previewEmptyState ? false : activeJobAwaitingAI1Confirm;
  return (
    <>
      {previewEmptyState ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          正在预览“无任务”空态（仅本地展示）。
          <a href="/create" className="ml-2 underline">
            退出预览
          </a>
        </div>
      ) : null}
      <div
        id="create-workbench-root"
        data-workbench-page="create"
        className="flex h-[calc(100vh-64px)] w-full flex-col overflow-hidden bg-slate-50 xl:flex-row xl:gap-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2 xl:hidden">
          <div className="text-xs font-semibold text-slate-700">工作台</div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {[
              { key: "tasks", label: "任务" },
              { key: "canvas", label: "画布" },
              { key: "console", label: "控制台" },
            ].map((item) => {
              const active = mobilePane === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMobilePane(item.key as "tasks" | "canvas" | "console")}
                  className={`rounded-md px-2.5 py-1 text-[11px] ${
                    active ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`${mobilePane === "tasks" ? "flex" : "hidden"} min-h-0 flex-1 xl:flex xl:flex-none`}>
          <TaskExplorer
            className="border-r-0 xl:border-r"
            jobs={viewTodayJobs}
            activeJobID={viewActiveJobID}
            loadingJobs={loadingJobs}
            statusLabelMap={STATUS_LABEL}
            onSelectJob={(jobID) => {
              setActiveJobID(jobID);
              setMobilePane("canvas");
            }}
            onCreateNew={() => {
              resetTaskInitDraft();
              openTaskInitDrawer();
            }}
            resolveRequestedFormats={(job) => resolveRequestedFormats(job as VideoJobItem)}
            resolvePreviewURL={(job) => resolveJobPreviewURL(job as VideoJobItem)}
            formatTime={formatTime}
          />
        </div>

        <div className={`${mobilePane === "canvas" ? "flex" : "hidden"} min-h-0 flex-1 xl:flex xl:min-w-0`}>
          <VisualCanvas
            loadingJobs={loadingJobs}
            activeJob={viewActiveJob}
            activeJobID={viewActiveJobID}
            stageLabelMap={STAGE_LABEL}
            statusLabelMap={STATUS_LABEL}
            streamMode={streamMode}
            activeResultEmojis={viewActiveResultEmojis}
            activePreviewIndex={activePreviewIndex}
            onSelectPreview={setActivePreviewIndex}
            activeResultLoading={
              previewEmptyState ? false : loadingResultJobID === activeJob?.id || activeResultPendingInitialLoad
            }
            activeResultError={viewActiveResultError}
            onRetryLoadResult={() => {
              if (!activeJob) return;
              void loadJobResult(activeJob.id, true);
            }}
            onDownloadOriginal={(item) => {
              void handleDownloadOriginal(item as VideoJobResultEmojiItem);
            }}
            downloadingOriginal={downloadingOriginal}
            resolveResultImageURL={resolveResultImageURL}
          />
        </div>

        <div className={`${mobilePane === "console" ? "flex" : "hidden"} min-h-0 flex-1 xl:flex xl:flex-none`}>
          <AIConsole
            loadingJobs={loadingJobs}
            className="border-l-0 xl:border-l"
            globalError={globalError}
            cleanTimeline={cleanTimeline}
            formatTime={formatTime}
            activeJobAwaitingAI1Confirm={viewActiveJobAwaitingAI1Confirm}
            confirmingContinue={confirmingContinue}
            onConfirmContinue={() => {
              if (!activeJob) return;
              void confirmContinueAfterAI1(activeJob.id);
            }}
            canCancelJob={viewCanCancelActiveJob}
            onCancelJob={() => {
              if (!activeJob) return;
              void handleCancelJob(activeJob.id);
            }}
          />
        </div>
      </div>

      <TaskInitDrawer
        open={taskInitDrawerOpen}
        onClose={() => setTaskInitDrawerOpen(false)}
        selectedFormat={selectedFormat}
        formatOptions={formatOptions}
        onChangeFormat={setSelectedFormat}
        selectedAIModel={selectedAIModel}
        modelOptions={AI_MODEL_OPTIONS}
        onChangeModel={setSelectedAIModel}
        fileInputRef={fileInputRef}
        selectedFileName={selectedFile?.name || ""}
        submitting={submitting}
        onFileSelected={setSelectedFile}
        showAdvancedOptions={showAdvancedOptions}
        onToggleAdvancedOptions={() => setShowAdvancedOptions((prev) => !prev)}
        advancedSceneOptions={advancedSceneOptions}
        advancedScene={advancedScene}
        onChangeScene={setAdvancedScene}
        advancedFocusOptions={ADVANCED_FOCUS_OPTIONS}
        advancedVisualFocus={advancedVisualFocus}
        onToggleFocus={(value) => toggleAdvancedFocus(value as AdvancedFocusOption["value"])}
        promptText={promptText}
        onPromptChange={handlePromptChange}
        promptMaxChars={TASK_PROMPT_MAX_CHARS}
        onSend={() => {
          void handleSend();
          setMobilePane("canvas");
        }}
        sendBlockReason={taskInitSendBlockReason}
        selectedFormatReason={selectedFormatOption?.reason}
        disabledSend={taskInitSendDisabled}
      />
    </>
  );
}
