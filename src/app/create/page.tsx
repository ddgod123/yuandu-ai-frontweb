"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  API_BASE,
  clearAuthSession,
  ensureAuthSession,
  fetchWithAuthRetry,
} from "@/lib/auth-client";
import { useJobStream, type JobStreamEnvelope } from "@/hooks/useJobStream";
import { MessageRenderer } from "@/components/create/rich-message/MessageRenderer";
import type { RichMessage, RichMessageAction } from "@/types/rich-message";

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

type VideoJobAI1DebugResponse = {
  job_id: number;
  requested_format?: string;
  flow_mode?: string;
  stage?: string;
  status?: string;
  source_prompt?: string;
  input?: Record<string, unknown>;
  model_request?: Record<string, unknown>;
  model_response?: Record<string, unknown>;
  output?: Record<string, unknown>;
  trace?: Record<string, unknown>;
};

type VideoJobAI1PlanPatchResponse = {
  plan_revision?: number;
};

type AI1EditableDraft = {
  supplement_prompt: string;
  objective: string;
  style_direction: string;
  must_capture_text: string;
  avoid_text: string;
  quality_semantic: string;
  quality_clarity: string;
  quality_loop: string;
  quality_efficiency: string;
  risk_flags_text: string;
  max_blur_tolerance: "low" | "medium" | "high";
  avoid_watermarks: boolean;
  avoid_extreme_dark: boolean;
  summary: string;
  interactive_action: "proceed" | "need_clarify";
  clarify_questions_text: string;
};

type AI1DebugTimelineStep = {
  key: string;
  title: string;
  status: string;
  summary: string;
  details?: Record<string, unknown>;
};

type AI1FieldAuditRow = {
  key: string;
  label: string;
  instructionValue: string;
  effectiveValue: string;
  source: string;
  edited: boolean;
  drift: boolean;
};

type AI2CandidateExplainRow = {
  rank: number;
  frameName: string;
  decisionKey: string;
  decision: string;
  rejectReason: string;
  mustCaptureHits: string[];
  avoidHits: string[];
  summary: string;
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

const AI1_FIELD_AUDIT_EDITED_ONLY_STORAGE_KEY = "create_ai1_field_audit_edited_only_v1";

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

function formatCNY(value?: number) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "¥0.0000";
  return `¥${amount.toFixed(4)}`;
}

function formatPoints(value?: number) {
  const points = Number(value || 0);
  if (!Number.isFinite(points) || points <= 0) return "0";
  return `${Math.round(points)}`;
}

function formatHoldStatus(raw?: string) {
  const value = (raw || "").trim().toLowerCase();
  switch (value) {
    case "settled":
      return "已结算";
    case "held":
      return "预冻结";
    case "released":
      return "已释放";
    case "cancelled":
      return "已取消";
    case "failed":
      return "失败";
    default:
      return raw || "-";
  }
}

function prettyJSON(value: unknown) {
  if (value === null || value === undefined) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function normalizeAI1DebugStepStatus(raw: string) {
  return raw.trim().toLowerCase();
}

function isAI1DebugAnomalyStatus(raw: string) {
  const value = normalizeAI1DebugStepStatus(raw);
  return value === "error" || value === "repaired" || value === "warn";
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

function parseEditableListText(raw: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  const parts = raw
    .split(/\r?\n|,|，|、|;/g)
    .map((item) => item.trim())
    .filter(Boolean);
  for (const item of parts) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function joinEditableListText(items: unknown) {
  const list = stringListFromAny(items);
  return list.join("\n");
}

function mergeEditableList(base: string[], incoming: string[], limit = 16) {
  const out: string[] = [];
  const seen = new Set<string>();
  const append = (item: string) => {
    const text = (item || "").trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };
  for (const item of base) append(item);
  for (const item of incoming) append(item);
  if (limit > 0 && out.length > limit) {
    return out.slice(0, limit);
  }
  return out;
}

function parseAI1SupplementPrompt(raw: string) {
  const mustCapture: string[] = [];
  const avoid: string[] = [];
  const clarifyQuestions: string[] = [];
  const lines = raw
    .split(/[\r\n；;]+/g)
    .map((item) => item.replace(/^[\s\-*•\d.、()（）]+/, "").trim())
    .filter(Boolean);

  const avoidPattern = /(不要|别|避免|规避|排除|去掉|去除|勿|不需要|avoid|exclude|without|skip)/i;
  const questionPattern = /[?？]$/;
  const questionPrefixPattern = /(请问|是否|能否|可否|需不需要|要不要)/;

  for (const line of lines) {
    if (!line) continue;
    if (questionPattern.test(line) || questionPrefixPattern.test(line)) {
      clarifyQuestions.push(line);
      continue;
    }
    if (avoidPattern.test(line)) {
      avoid.push(line);
      continue;
    }
    mustCapture.push(line);
  }

  return {
    mustCapture: mergeEditableList([], mustCapture, 16),
    avoid: mergeEditableList([], avoid, 16),
    clarifyQuestions: mergeEditableList([], clarifyQuestions, 6),
  };
}

function numberFromAny(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() || "-";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const texts = value.map((item) => compactValue(item)).filter((item) => item && item !== "-");
    return texts.length ? texts.join("、") : "-";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "-";
    }
  }
  return String(value);
}

function normalizeAuditText(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function firstNonEmptyText(...values: string[]) {
  for (const value of values) {
    const text = (value || "").trim();
    if (text) return text;
  }
  return "";
}

function boolFromAny(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes" || text === "on";
  }
  return false;
}

function objectFromAny(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function objectListFromAny(value: unknown) {
  if (!Array.isArray(value)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    out.push(item as Record<string, unknown>);
  }
  return out;
}

function decisionLabelFromKey(value: string) {
  switch (value.trim().toLowerCase()) {
    case "kept":
      return "保留";
    case "rejected":
      return "拒绝";
    case "dropped_by_budget":
      return "预算淘汰";
    case "selected":
      return "入选候选";
    default:
      return value || "-";
  }
}

function formatWeightValue(value: number, fallback: number) {
  const n = Number.isFinite(value) && value > 0 ? value : fallback;
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

function parseWeightInput(raw: string) {
  const text = raw.trim();
  if (!text) return 0;
  let n = Number(text);
  if (!Number.isFinite(n)) return 0;
  if (n > 1 && n <= 100) {
    n = n / 100;
  }
  if (n < 0) n = 0;
  if (n > 1) n = 1;
  return n;
}

function csvEscape(value: unknown) {
  let text = "";
  if (typeof value === "string") {
    text = value;
  } else if (typeof value === "number") {
    text = Number.isFinite(value) ? String(value) : "";
  } else if (typeof value === "boolean") {
    text = value ? "true" : "false";
  } else if (value !== null && value !== undefined) {
    text = String(value);
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
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
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [advancedSceneOptions, setAdvancedSceneOptions] = useState<AdvancedSceneOption[]>(
    filterAdvancedSceneOptionsForMainline("png", FALLBACK_ADVANCED_SCENE_OPTIONS)
  );
  const [advancedSceneOptionsLoading, setAdvancedSceneOptionsLoading] = useState(false);
  const [advancedSceneOptionsError, setAdvancedSceneOptionsError] = useState<string | null>(null);
  const [advancedScene, setAdvancedScene] = useState<AdvancedSceneOption["value"]>("default");
  const [advancedVisualFocus, setAdvancedVisualFocus] = useState<AdvancedFocusOption["value"][]>([]);
  const [advancedEnableMatting, setAdvancedEnableMatting] = useState(false);

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
  const [ai1Debug, setAI1Debug] = useState<VideoJobAI1DebugResponse | null>(null);
  const [loadingAI1Debug, setLoadingAI1Debug] = useState(false);
  const [ai1DebugError, setAI1DebugError] = useState<string | null>(null);
  const [ai1DebugTab, setAI1DebugTab] = useState<"timeline" | "normalized" | "request" | "response">("timeline");
  const [ai1TimelineAnomalyOnly, setAI1TimelineAnomalyOnly] = useState(false);
  const [ai1FieldAuditEditedOnly, setAI1FieldAuditEditedOnly] = useState(false);
  const [ai2CandidateExplainFilter, setAI2CandidateExplainFilter] = useState<"all" | "rejected" | "must_capture">("all");
  const [ai1IssueCopyState, setAI1IssueCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingContinue, setConfirmingContinue] = useState(false);
  const [pendingRichActionKey, setPendingRichActionKey] = useState<string | null>(null);
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [showAI1DebugModal, setShowAI1DebugModal] = useState(false);
  const [showAI1EditModal, setShowAI1EditModal] = useState(false);
  const [savingAI1Edit, setSavingAI1Edit] = useState(false);
  const [ai1EditError, setAI1EditError] = useState<string | null>(null);
  const [ai1EditDraft, setAI1EditDraft] = useState<AI1EditableDraft>({
    supplement_prompt: "",
    objective: "",
    style_direction: "",
    must_capture_text: "",
    avoid_text: "",
    quality_semantic: "0.35",
    quality_clarity: "0.35",
    quality_loop: "0.05",
    quality_efficiency: "0.25",
    risk_flags_text: "",
    max_blur_tolerance: "low",
    avoid_watermarks: true,
    avoid_extreme_dark: true,
    summary: "",
    interactive_action: "proceed",
    clarify_questions_text: "",
  });
  // const [taskListCompact, setTaskListCompact] = useState(true);

  const [globalError, setGlobalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timelineEndRef = useRef<HTMLDivElement | null>(null);
  const eventCursorRef = useRef<Record<number, number>>({});
  const seenEventRef = useRef<Set<string>>(new Set());
  const announcedActiveJobRef = useRef<number | null>(null);

  const activeJob = useMemo(() => jobs.find((item) => item.id === activeJobID) || null, [jobs, activeJobID]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(AI1_FIELD_AUDIT_EDITED_ONLY_STORAGE_KEY);
      if (saved === "1") {
        setAI1FieldAuditEditedOnly(true);
      } else if (saved === "0") {
        setAI1FieldAuditEditedOnly(false);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(AI1_FIELD_AUDIT_EDITED_ONLY_STORAGE_KEY, ai1FieldAuditEditedOnly ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [ai1FieldAuditEditedOnly]);

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
  const ai1DebugOutput = useMemo(() => {
    if (!ai1Debug || !ai1Debug.output || typeof ai1Debug.output !== "object") {
      return {
        userReply: {},
        ai2Instruction: {},
        ai1OutputV2: {},
        contractReport: {},
        advancedOptions: {},
        appliedStrategyProfile: {},
        advancedSceneGuard: {},
        strategyOverrideReport: {},
        ai2ExecutionObservability: {},
        pipelineAlignmentReport: {},
      };
    }
    const output = ai1Debug.output as Record<string, unknown>;
    const userReply =
      output.user_reply && typeof output.user_reply === "object"
        ? (output.user_reply as Record<string, unknown>)
        : {};
    const ai2Instruction =
      output.ai2_instruction && typeof output.ai2_instruction === "object"
        ? (output.ai2_instruction as Record<string, unknown>)
        : {};
    const ai1OutputV2 =
      output.ai1_output_v2 && typeof output.ai1_output_v2 === "object"
        ? (output.ai1_output_v2 as Record<string, unknown>)
        : {};
    const trace = ai1Debug.trace && typeof ai1Debug.trace === "object" ? (ai1Debug.trace as Record<string, unknown>) : {};
    const contractFromOutput =
      output.contract_report && typeof output.contract_report === "object"
        ? (output.contract_report as Record<string, unknown>)
        : {};
    const contractFromTrace =
      trace.ai1_output_contract_v2 && typeof trace.ai1_output_contract_v2 === "object"
        ? (trace.ai1_output_contract_v2 as Record<string, unknown>)
        : {};
    const advancedOptions =
      output.advanced_options && typeof output.advanced_options === "object"
        ? (output.advanced_options as Record<string, unknown>)
        : userReply.advanced_options && typeof userReply.advanced_options === "object"
          ? (userReply.advanced_options as Record<string, unknown>)
          : {};
    const appliedStrategyProfile =
      output.applied_strategy_profile && typeof output.applied_strategy_profile === "object"
        ? (output.applied_strategy_profile as Record<string, unknown>)
        : userReply.applied_strategy_profile && typeof userReply.applied_strategy_profile === "object"
          ? (userReply.applied_strategy_profile as Record<string, unknown>)
          : {};
    const advancedSceneGuard =
      output.advanced_scene_guard_v1 && typeof output.advanced_scene_guard_v1 === "object"
        ? (output.advanced_scene_guard_v1 as Record<string, unknown>)
        : trace.advanced_scene_guard_v1 && typeof trace.advanced_scene_guard_v1 === "object"
          ? (trace.advanced_scene_guard_v1 as Record<string, unknown>)
          : {};
    const strategyOverrideReport =
      output.strategy_override_report_v1 && typeof output.strategy_override_report_v1 === "object"
        ? (output.strategy_override_report_v1 as Record<string, unknown>)
        : trace.strategy_override_report_v1 && typeof trace.strategy_override_report_v1 === "object"
          ? (trace.strategy_override_report_v1 as Record<string, unknown>)
          : {};
    const ai2ExecutionObservability =
      output.ai2_execution_observability_v1 && typeof output.ai2_execution_observability_v1 === "object"
        ? (output.ai2_execution_observability_v1 as Record<string, unknown>)
        : trace.ai2_execution_observability_v1 && typeof trace.ai2_execution_observability_v1 === "object"
          ? (trace.ai2_execution_observability_v1 as Record<string, unknown>)
          : {};
    const pipelineAlignmentReport =
      output.pipeline_alignment_report_v1 && typeof output.pipeline_alignment_report_v1 === "object"
        ? (output.pipeline_alignment_report_v1 as Record<string, unknown>)
        : trace.pipeline_alignment_report_v1 && typeof trace.pipeline_alignment_report_v1 === "object"
          ? (trace.pipeline_alignment_report_v1 as Record<string, unknown>)
          : {};
    return {
      userReply,
      ai2Instruction,
      ai1OutputV2,
      contractReport: Object.keys(contractFromOutput).length ? contractFromOutput : contractFromTrace,
      advancedOptions,
      appliedStrategyProfile,
      advancedSceneGuard,
      strategyOverrideReport,
      ai2ExecutionObservability,
      pipelineAlignmentReport,
    };
  }, [ai1Debug]);
  const ai1PlanRevision = useMemo(() => {
    const trace = ai1Debug?.trace && typeof ai1Debug.trace === "object" ? (ai1Debug.trace as Record<string, unknown>) : {};
    const planMeta = trace.plan && typeof trace.plan === "object" ? (trace.plan as Record<string, unknown>) : {};
    const revision = numberFromAny(planMeta.plan_revision);
    return revision > 0 ? Math.trunc(revision) : 1;
  }, [ai1Debug?.trace]);
  const ai1EditedFieldSet = useMemo(() => {
    const out = new Set<string>();
    const ai1OutputTrace = objectFromAny(ai1DebugOutput.ai1OutputV2.trace);
    for (const item of stringListFromAny(ai1OutputTrace.user_edited_fields)) {
      out.add(item);
    }
    const trace = objectFromAny(ai1Debug?.trace);
    const plan = objectFromAny(trace.plan);
    const planJSON = objectFromAny(plan.plan_json);
    for (const item of stringListFromAny(planJSON.last_user_edit_fields)) {
      out.add(item);
    }
    return out;
  }, [ai1Debug?.trace, ai1DebugOutput.ai1OutputV2]);
  const ai1FieldAuditRows = useMemo<AI1FieldAuditRow[]>(() => {
    const ai2Instruction = objectFromAny(ai1DebugOutput.ai2Instruction);
    const ai2Obs = objectFromAny(ai1DebugOutput.ai2ExecutionObservability);
    const instructionWeights = objectFromAny(ai2Instruction.quality_weights);
    const effectiveWeights = objectFromAny(ai2Obs.effective_quality_weights);
    const instructionRiskFlags = stringListFromAny(ai2Instruction.risk_flags);
    const effectiveRiskFlags = stringListFromAny(ai2Obs.risk_flags_applied);
    const instructionTechnical = objectFromAny(ai2Instruction.technical_reject);
    const effectiveTechnical = objectFromAny(ai2Obs.technical_reject);

    const rowList: AI1FieldAuditRow[] = [];
    const pushRow = (
      key: string,
      label: string,
      instructionValue: unknown,
      effectiveValue: unknown,
      source: string,
      editedField: string
    ) => {
      const instructionText = compactValue(instructionValue);
      const effectiveText = compactValue(effectiveValue);
      rowList.push({
        key,
        label,
        instructionValue: instructionText,
        effectiveValue: effectiveText,
        source,
        edited: ai1EditedFieldSet.has(editedField),
        drift: instructionText !== "-" && effectiveText !== "-" && normalizeAuditText(instructionText) !== normalizeAuditText(effectiveText),
      });
    };

    pushRow(
      "quality_weights",
      "质量权重 quality_weights",
      {
        semantic: numberFromAny(instructionWeights.semantic),
        clarity: numberFromAny(instructionWeights.clarity),
        loop: numberFromAny(instructionWeights.loop),
        efficiency: numberFromAny(instructionWeights.efficiency),
      },
      {
        semantic: numberFromAny(effectiveWeights.semantic),
        clarity: numberFromAny(effectiveWeights.clarity),
        loop: numberFromAny(effectiveWeights.loop),
        efficiency: numberFromAny(effectiveWeights.efficiency),
      },
      "ai2_instruction / ai2_execution_observability",
      "quality_weights"
    );
    pushRow(
      "risk_flags",
      "风险标记 risk_flags",
      instructionRiskFlags,
      effectiveRiskFlags,
      "ai2_instruction / ai2_execution_observability",
      "risk_flags"
    );
    pushRow(
      "max_blur_tolerance",
      "模糊容忍 max_blur_tolerance",
      instructionTechnical.max_blur_tolerance,
      firstNonEmptyText(
        stringFromAny(ai2Obs.max_blur_tolerance),
        stringFromAny(effectiveTechnical.max_blur_tolerance),
        stringFromAny(instructionTechnical.max_blur_tolerance)
      ),
      "ai2_instruction.technical_reject / ai2_execution_observability",
      "max_blur_tolerance"
    );
    pushRow(
      "avoid_watermarks",
      "避开水印 avoid_watermarks",
      instructionTechnical.avoid_watermarks,
      firstNonEmptyText(
        compactValue(effectiveTechnical.avoid_watermarks),
        compactValue(instructionTechnical.avoid_watermarks)
      ),
      "ai2_instruction.technical_reject / ai2_execution_observability",
      "avoid_watermarks"
    );
    pushRow(
      "avoid_extreme_dark",
      "避开极暗画面 avoid_extreme_dark",
      instructionTechnical.avoid_extreme_dark,
      firstNonEmptyText(
        compactValue(effectiveTechnical.avoid_extreme_dark),
        compactValue(instructionTechnical.avoid_extreme_dark)
      ),
      "ai2_instruction.technical_reject / ai2_execution_observability",
      "avoid_extreme_dark"
    );

    return rowList;
  }, [ai1DebugOutput.ai2ExecutionObservability, ai1DebugOutput.ai2Instruction, ai1EditedFieldSet]);
  const ai1FieldAuditRowsForRender = useMemo(
    () => (ai1FieldAuditEditedOnly ? ai1FieldAuditRows.filter((row) => row.edited) : ai1FieldAuditRows),
    [ai1FieldAuditEditedOnly, ai1FieldAuditRows]
  );
  const ai1FieldAuditStats = useMemo(() => {
    const edited = ai1FieldAuditRows.filter((row) => row.edited).length;
    const drift = ai1FieldAuditRows.filter((row) => row.drift).length;
    return { edited, drift, total: ai1FieldAuditRows.length };
  }, [ai1FieldAuditRows]);
  const ai2CandidateExplainability = useMemo(() => {
    const ai2Obs = objectFromAny(ai1DebugOutput.ai2ExecutionObservability);
    const explain = objectFromAny(ai2Obs.candidate_explainability);
    const frameSummary = objectFromAny(ai2Obs.frame_quality_summary);
    const rejectCounts = objectFromAny(frameSummary.reject_counts);
    const decisionCountsRaw = objectFromAny(explain.decision_counts);
    const decisionCounts = Object.entries(decisionCountsRaw)
      .map(([key, value]) => {
        const count = Math.max(0, Math.trunc(numberFromAny(value)));
        return {
          key: key.trim().toLowerCase(),
          label: decisionLabelFromKey(key),
          count,
        };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);

    const rows = objectListFromAny(explain.top_rows)
      .map((row): AI2CandidateExplainRow => {
        const decisionKey = stringFromAny(row.decision).trim().toLowerCase();
        const frameName = firstNonEmptyText(stringFromAny(row.frame_name), stringFromAny(row.frame_path), "-");
        return {
          rank: Math.max(0, Math.trunc(numberFromAny(row.rank))),
          frameName,
          decisionKey,
          decision: decisionLabelFromKey(decisionKey),
          rejectReason: stringFromAny(row.reject_reason),
          mustCaptureHits: stringListFromAny(row.must_capture_hits),
          avoidHits: stringListFromAny(row.avoid_hits),
          summary: stringFromAny(row.summary),
        };
      })
      .filter((item) => item.rank > 0 || item.frameName !== "-");

    return {
      totalCandidates: Math.max(0, Math.trunc(numberFromAny(explain.total_candidates))),
      mustCaptureHitFrames: Math.max(0, Math.trunc(numberFromAny(explain.must_capture_hit_frames))),
      avoidHitFrames: Math.max(0, Math.trunc(numberFromAny(explain.avoid_hit_frames))),
      scoringFormula: stringFromAny(ai2Obs.scoring_formula),
      selectorVersion: stringFromAny(ai2Obs.selector_version),
      scoringMode: stringFromAny(ai2Obs.scoring_mode),
      selectionPolicy: stringFromAny(ai2Obs.selection_policy),
      rejectCounts: {
        blur: Math.max(0, Math.trunc(numberFromAny(rejectCounts.blur))),
        brightness: Math.max(0, Math.trunc(numberFromAny(rejectCounts.brightness))),
        exposure: Math.max(0, Math.trunc(numberFromAny(rejectCounts.exposure))),
        resolution: Math.max(0, Math.trunc(numberFromAny(rejectCounts.resolution))),
        stillBlur: Math.max(0, Math.trunc(numberFromAny(rejectCounts.still_blur))),
        watermark: Math.max(0, Math.trunc(numberFromAny(rejectCounts.watermark))),
        nearDup: Math.max(0, Math.trunc(numberFromAny(rejectCounts.near_dup))),
        total: Math.max(0, Math.trunc(numberFromAny(rejectCounts.total_reject))),
      },
      decisionCounts,
      rows,
    };
  }, [ai1DebugOutput.ai2ExecutionObservability]);
  const ai1PipelineAlignment = useMemo(() => {
    const report = objectFromAny(ai1DebugOutput.pipelineAlignmentReport);
    const summary = objectFromAny(report.summary);
    const scenario = objectFromAny(report.scenario);
    const checks = objectListFromAny(report.consistency_checks).map((row, idx) => ({
      key: stringFromAny(row.key) || `check_${idx}`,
      label: stringFromAny(row.label) || "-",
      status: stringFromAny(row.status).toLowerCase() || "warn",
      detail: stringFromAny(row.detail),
      value: objectFromAny(row.value),
    }));
    const passCount = Math.max(0, Math.trunc(numberFromAny(summary.pass_count)));
    const warnCount = Math.max(0, Math.trunc(numberFromAny(summary.warn_count)));
    const failCount = Math.max(0, Math.trunc(numberFromAny(summary.fail_count)));
    return {
      report,
      scenario,
      status: stringFromAny(summary.status).toLowerCase() || (failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass"),
      totalChecks: Math.max(0, Math.trunc(numberFromAny(summary.total_checks))) || checks.length,
      passCount,
      warnCount,
      failCount,
      checks,
    };
  }, [ai1DebugOutput.pipelineAlignmentReport]);
  const ai1SceneBaselineDiff = useMemo(() => {
    const diff = objectFromAny(ai1PipelineAlignment.report.scene_baseline_diff_v1);
    const weightDelta = objectFromAny(diff.quality_weight_delta);
    const weightDiffKeys = stringListFromAny(diff.weight_diff_keys);
    const mustAdded = stringListFromAny(diff.must_capture_added);
    const avoidAdded = stringListFromAny(diff.avoid_added);
    const technicalChanged = stringListFromAny(diff.technical_reject_changed_keys);
    return {
      diff,
      sceneChanged: Boolean(diff.scene_changed),
      baselineScene: stringFromAny(diff.baseline_scene),
      currentScene: stringFromAny(diff.current_scene),
      summary: stringFromAny(diff.recommendation_summary),
      weightDelta,
      weightDiffKeys,
      mustAdded,
      avoidAdded,
      technicalChanged,
    };
  }, [ai1PipelineAlignment.report]);
  const exportPipelineAlignmentJSON = useCallback(() => {
    if (!activeJob || !Object.keys(ai1PipelineAlignment.report || {}).length) return;
    const ai2Node = objectFromAny(ai1PipelineAlignment.report.ai2);
    const workerNode = objectFromAny(ai1PipelineAlignment.report.worker);
    const ai3Node = objectFromAny(ai1PipelineAlignment.report.ai3);
    const ai3Review = objectFromAny(ai3Node.review);
    const sceneBaselineDiff = objectFromAny(ai1PipelineAlignment.report.scene_baseline_diff_v1);
    const payload = {
      schema_version: "pipeline_alignment_export_v1",
      exported_at: new Date().toISOString(),
      job_id: activeJob.id,
      requested_format: stringFromAny(ai1PipelineAlignment.report.requested_format || ai1Debug?.requested_format || "").toLowerCase(),
      scene: stringFromAny(ai1PipelineAlignment.scenario.scene_label || ai1PipelineAlignment.scenario.scene),
      summary: {
        status: ai1PipelineAlignment.status,
        pass_count: ai1PipelineAlignment.passCount,
        warn_count: ai1PipelineAlignment.warnCount,
        fail_count: ai1PipelineAlignment.failCount,
        total_checks: ai1PipelineAlignment.totalChecks,
      },
      checks: objectListFromAny(ai1PipelineAlignment.report.consistency_checks),
      mainline_diagnostics: {
        ai2: {
          objective: stringFromAny(ai2Node.objective),
          style_direction: stringFromAny(ai2Node.style_direction),
          scoring_formula: stringFromAny(ai2Node.scoring_formula),
          selection_policy: stringFromAny(ai2Node.selection_policy),
          requested_quality_weights: objectFromAny(ai2Node.requested_quality_weights),
          effective_quality_weights: objectFromAny(ai2Node.effective_quality_weights),
        },
        worker: {
          stage: objectFromAny(workerNode.stage),
          technical_reject: objectFromAny(workerNode.technical_reject),
          frame_quality_summary: objectFromAny(workerNode.frame_quality_summary),
        },
        ai3: {
          stage: stringFromAny(ai3Node.stage),
          recommendation: stringFromAny(ai3Review.recommendation || ai3Review.final_recommendation),
          summary_note: stringFromAny(ai3Review.summary_note),
        },
      },
      scene_baseline_diff_v1: sceneBaselineDiff,
    };
    const jobPart = `job_${activeJob.id}`;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    downloadTextFile(`${jobPart}_pipeline_alignment_${ts}.json`, prettyJSON(payload), "application/json;charset=utf-8;");
  }, [activeJob, ai1Debug?.requested_format, ai1PipelineAlignment]);
  const exportPipelineAlignmentCSV = useCallback(() => {
    if (!activeJob || !Object.keys(ai1PipelineAlignment.report || {}).length) return;
    const ai2Node = objectFromAny(ai1PipelineAlignment.report.ai2);
    const workerNode = objectFromAny(ai1PipelineAlignment.report.worker);
    const ai3Node = objectFromAny(ai1PipelineAlignment.report.ai3);
    const ai3Review = objectFromAny(ai3Node.review);
    const workerStage = objectFromAny(workerNode.stage);
    const sceneBaselineDiff = objectFromAny(ai1PipelineAlignment.report.scene_baseline_diff_v1);
    const checks = objectListFromAny(ai1PipelineAlignment.report.consistency_checks);
    const rows = (checks.length
      ? checks
      : [
          {
            key: "-",
            label: "无检查项",
            status: "warn",
            detail: "报告中未包含 consistency_checks",
            value: null,
          },
        ]
    ).map((row) => ({
      job_id: activeJob.id,
      requested_format: stringFromAny(ai1PipelineAlignment.report.requested_format || ai1Debug?.requested_format || "").toLowerCase(),
      scene: stringFromAny(ai1PipelineAlignment.scenario.scene_label || ai1PipelineAlignment.scenario.scene),
      report_status: ai1PipelineAlignment.status,
      check_key: stringFromAny(row.key),
      check_label: stringFromAny(row.label),
      check_status: stringFromAny(row.status),
      check_detail: stringFromAny(row.detail),
      check_value: row.value === null || typeof row.value === "undefined" ? "" : prettyJSON(row.value),
      ai2_objective: stringFromAny(ai2Node.objective),
      ai2_scoring_formula: stringFromAny(ai2Node.scoring_formula),
      ai2_selection_policy: stringFromAny(ai2Node.selection_policy),
      worker_stage: stringFromAny(workerStage.worker),
      extraction_stage: stringFromAny(workerStage.extraction),
      ai3_stage: stringFromAny(ai3Node.stage),
      ai3_recommendation: stringFromAny(ai3Review.recommendation || ai3Review.final_recommendation),
      baseline_scene: stringFromAny(sceneBaselineDiff.baseline_scene),
      current_scene: stringFromAny(sceneBaselineDiff.current_scene),
      baseline_summary: stringFromAny(sceneBaselineDiff.recommendation_summary),
    }));
    const headers = [
      "job_id",
      "requested_format",
      "scene",
      "report_status",
      "check_key",
      "check_label",
      "check_status",
      "check_detail",
      "check_value",
      "ai2_objective",
      "ai2_scoring_formula",
      "ai2_selection_policy",
      "worker_stage",
      "extraction_stage",
      "ai3_stage",
      "ai3_recommendation",
      "baseline_scene",
      "current_scene",
      "baseline_summary",
    ];
    const csvLines = [headers, ...rows.map((row) => headers.map((key) => csvEscape(row[key as keyof typeof row])))].map((line) =>
      line.join(",")
    );
    const jobPart = `job_${activeJob.id}`;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    downloadTextFile(
      `${jobPart}_pipeline_alignment_${ts}.csv`,
      `\uFEFF${csvLines.join("\r\n")}`,
      "text/csv;charset=utf-8;"
    );
  }, [activeJob, ai1Debug?.requested_format, ai1PipelineAlignment]);
  const ai2CandidateExplainRowsForRender = useMemo(() => {
    if (ai2CandidateExplainFilter === "rejected") {
      return ai2CandidateExplainability.rows.filter((row) => row.decisionKey === "rejected");
    }
    if (ai2CandidateExplainFilter === "must_capture") {
      return ai2CandidateExplainability.rows.filter((row) => row.mustCaptureHits.length > 0);
    }
    return ai2CandidateExplainability.rows;
  }, [ai2CandidateExplainFilter, ai2CandidateExplainability.rows]);
  const exportAI2CandidateExplainCSV = useCallback(() => {
    if (!ai2CandidateExplainRowsForRender.length) return;
    const headers = ["任务ID", "筛选", "排名", "帧", "决策", "must_capture命中", "avoid触发", "解释", "拒绝原因"];
    const rows = ai2CandidateExplainRowsForRender.map((row) => [
      activeJob?.id || "",
      ai2CandidateExplainFilter,
      row.rank || "",
      row.frameName || "",
      row.decision || "",
      row.mustCaptureHits.join(" | "),
      row.avoidHits.join(" | "),
      row.summary || "",
      row.rejectReason || "",
    ]);
    const csvLines = [headers, ...rows].map((line) => line.map((item) => csvEscape(item)).join(","));
    const blob = new Blob(["\uFEFF", csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const jobPart = activeJob?.id ? `job_${activeJob.id}` : "job";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `${jobPart}_ai2_candidate_explain_${ai2CandidateExplainFilter}_${ts}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [activeJob?.id, ai2CandidateExplainFilter, ai2CandidateExplainRowsForRender]);
  const ai1DebugTimeline = useMemo<AI1DebugTimelineStep[]>(() => {
    if (!ai1Debug) return [];
    const trace = ai1Debug?.trace && typeof ai1Debug.trace === "object" ? (ai1Debug.trace as Record<string, unknown>) : {};
    const rawTimeline = trace.timeline_v1;
    if (Array.isArray(rawTimeline)) {
      const fromServer = rawTimeline
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const key = typeof row.key === "string" ? row.key.trim() : "";
          const title = typeof row.title === "string" ? row.title.trim() : "";
          const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : "pending";
          const summary = typeof row.summary === "string" ? row.summary.trim() : "";
          const details = row.details && typeof row.details === "object" ? (row.details as Record<string, unknown>) : undefined;
          if (!key || !title) return null;
          return { key, title, status, summary, details } as AI1DebugTimelineStep;
        })
        .filter((item): item is AI1DebugTimelineStep => Boolean(item));
      if (fromServer.length) return fromServer;
    }

    const contractReport = ai1DebugOutput.contractReport || {};
    const repaired = Boolean(contractReport.contract_repaired);
    const valid = Boolean(contractReport.valid);
    const requestStatus = typeof ai1Debug?.model_request?.request_status === "string"
      ? ai1Debug.model_request.request_status.trim().toLowerCase()
      : "";
    const requestStepStatus = requestStatus === "error" ? "error" : "done";
    const responseSummary = ai1Debug?.model_response?.response_summary_v2 as Record<string, unknown> | undefined;
    const responseStatusRaw = typeof responseSummary?.request_status === "string" ? responseSummary.request_status : "";
    const responseStepStatus = responseStatusRaw.trim().toLowerCase() === "error" ? "error" : "done";
    const contractStatus = repaired ? "repaired" : valid ? "done" : "warn";
    const finalStatus =
      Object.keys(ai1DebugOutput.userReply || {}).length && Object.keys(ai1DebugOutput.ai2Instruction || {}).length
        ? "done"
        : "warn";

    return [
      {
        key: "input",
        title: "输入聚合（用户 + 视频 + 开发规则）",
        status: "done",
        summary: "已读取用户提示词、视频元数据和开发规则。",
        details: ai1Debug?.input,
      },
      {
        key: "model_request",
        title: "POST 模型请求",
        status: requestStepStatus,
        summary: "已构建模型请求负载。",
        details: ai1Debug?.model_request,
      },
      {
        key: "model_response",
        title: "模型响应解析",
        status: responseStepStatus,
        summary: "已解析模型返回和标准化结果。",
        details: ai1Debug?.model_response,
      },
      {
        key: "contract",
        title: "AI1 协议校验与修复",
        status: contractStatus,
        summary: repaired ? "输出已自动修复并记录修复项。" : valid ? "输出通过契约校验。" : "输出存在契约风险。",
        details: contractReport,
      },
      {
        key: "final_output",
        title: "最终输出（用户反馈 + AI2 指令）",
        status: finalStatus,
        summary: "已产出用户可读反馈与 AI2 可执行指令。",
        details: {
          user_reply: ai1DebugOutput.userReply,
          ai2_instruction: ai1DebugOutput.ai2Instruction,
        },
      },
    ];
  }, [ai1Debug, ai1DebugOutput]);
  const ai1DebugTimelineAnomalies = useMemo(
    () => ai1DebugTimeline.filter((step) => isAI1DebugAnomalyStatus(step.status)),
    [ai1DebugTimeline]
  );
  const ai1DebugTimelineStepsForRender = useMemo(
    () => (ai1TimelineAnomalyOnly ? ai1DebugTimelineAnomalies : ai1DebugTimeline),
    [ai1DebugTimeline, ai1DebugTimelineAnomalies, ai1TimelineAnomalyOnly]
  );
  const ai1DebugTimelineStatusStats = useMemo(() => {
    const stats = { done: 0, repaired: 0, warn: 0, error: 0, pending: 0, unknown: 0 };
    for (const step of ai1DebugTimeline) {
      const status = normalizeAI1DebugStepStatus(step.status);
      if (status === "done") stats.done += 1;
      else if (status === "repaired") stats.repaired += 1;
      else if (status === "warn") stats.warn += 1;
      else if (status === "error") stats.error += 1;
      else if (status === "pending") stats.pending += 1;
      else stats.unknown += 1;
    }
    return stats;
  }, [ai1DebugTimeline]);
  const copyAI1IssueContext = useCallback(async () => {
    if (!ai1Debug || !activeJob) return;
    const payload = {
      schema_version: "ai1_issue_context_v1",
      copied_at: new Date().toISOString(),
      job: {
        job_id: activeJob.id,
        title: activeJob.title || "",
        requested_format: ai1Debug.requested_format || "",
        flow_mode: ai1Debug.flow_mode || "",
        stage: ai1Debug.stage || "",
        status: ai1Debug.status || "",
        source_prompt: ai1Debug.source_prompt || "",
      },
      anomaly_steps: ai1DebugTimelineAnomalies,
      contract_report: ai1DebugOutput.contractReport,
      advanced_options: ai1DebugOutput.advancedOptions,
      applied_strategy_profile: ai1DebugOutput.appliedStrategyProfile,
      advanced_scene_guard_v1: ai1DebugOutput.advancedSceneGuard,
      strategy_override_report_v1: ai1DebugOutput.strategyOverrideReport,
      pipeline_alignment_report_v1: ai1DebugOutput.pipelineAlignmentReport,
      model_request_summary:
        (ai1Debug.model_request?.payload_summary_v2 as Record<string, unknown> | undefined) || ai1Debug.model_request || {},
      model_response_summary:
        (ai1Debug.model_response?.response_summary_v2 as Record<string, unknown> | undefined) || ai1Debug.model_response || {},
      trace_contract:
        (ai1Debug.trace?.ai1_output_contract_v2 as Record<string, unknown> | undefined) || ai1DebugOutput.contractReport,
    };
    const text = prettyJSON(payload);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("clipboard_unavailable");
      }
      setAI1IssueCopyState("copied");
      window.setTimeout(() => setAI1IssueCopyState("idle"), 1600);
    } catch {
      setAI1IssueCopyState("error");
      window.setTimeout(() => setAI1IssueCopyState("idle"), 2200);
    }
  }, [
    activeJob,
    ai1Debug,
    ai1DebugOutput.appliedStrategyProfile,
    ai1DebugOutput.advancedOptions,
    ai1DebugOutput.advancedSceneGuard,
    ai1DebugOutput.contractReport,
    ai1DebugOutput.pipelineAlignmentReport,
    ai1DebugOutput.strategyOverrideReport,
    ai1DebugTimelineAnomalies,
  ]);
  const ai1RichMessages = useMemo<RichMessage[]>(() => {
    if (!activeJob) return [];

    const now = Date.now();
    const messages: RichMessage[] = [];
    const focusAnomalyOnly = ai1TimelineAnomalyOnly;
    const requestedFormat = (ai1Debug?.requested_format || activeJobRequestedFormats[0] || "").toLowerCase();
    const outputCount = numberFromAny(activeJob.metrics?.output_count);
    const generatedFormats = activeJobGeneratedFormats.length ? activeJobGeneratedFormats : activeJobRequestedFormats;

    if (!focusAnomalyOnly) {
      messages.push({
        id: `upload-progress-${activeJob.id}`,
        role: "system",
        type: "upload_progress",
        created_at: now,
        payload: {
          job_id: activeJob.id,
          stage: activeJob.stage,
          stage_label: STAGE_LABEL[activeJob.stage] || activeJob.stage || "-",
          status: activeJob.status,
          status_label: STATUS_LABEL[activeJob.status] || activeJob.status || "-",
          progress_percent: Math.max(0, Math.min(100, Number(activeJob.progress || 0))),
          requested_format: requestedFormat,
          generated_formats: generatedFormats,
          queue_label: executionLaneLabel(activeJob.options?.execution_queue) || stringFromAny(activeJob.options?.execution_queue) || "-",
          updated_at: activeJob.updated_at,
        },
      });
    }

    if (!focusAnomalyOnly && (Object.keys(ai1DebugOutput.userReply).length || Object.keys(ai1DebugOutput.ai2Instruction).length)) {
      const userReply = ai1DebugOutput.userReply;
      const ai2Instruction = ai1DebugOutput.ai2Instruction;
      const interactiveAction = stringFromAny(userReply.interactive_action).toLowerCase();
      const needClarify = interactiveAction === "need_clarify";
      const riskWarning =
        userReply.risk_warning && typeof userReply.risk_warning === "object"
          ? (userReply.risk_warning as { has_risk?: boolean; message?: string })
          : undefined;
      messages.push({
        id: `ai1-plan-${activeJob.id}`,
        role: "assistant",
        type: "ai1_plan_card",
        created_at: now + 1,
        payload: {
          requested_format: requestedFormat,
          summary: stringFromAny(userReply.summary),
          intent_understanding: stringFromAny(userReply.intent_understanding),
          strategy_summary: stringFromAny(userReply.strategy_summary),
          detected_tags: stringListFromAny(userReply.detected_tags),
          risk_warning: riskWarning,
          confidence: numberFromAny(userReply.confidence),
          clarify_questions: stringListFromAny(userReply.clarify_questions),
          estimated_eta_seconds: numberFromAny(userReply.estimated_eta_seconds),
          must_capture: stringListFromAny(ai2Instruction.must_capture),
          avoid: stringListFromAny(ai2Instruction.avoid),
          style_direction: stringFromAny(ai2Instruction.style_direction),
          objective: stringFromAny(ai2Instruction.objective),
          interactive_action: interactiveAction,
          quality_weights: objectFromAny(ai2Instruction.quality_weights) as Record<string, number>,
          risk_flags: stringListFromAny(ai2Instruction.risk_flags),
          technical_reject: objectFromAny(ai2Instruction.technical_reject) as {
            max_blur_tolerance?: string;
            avoid_watermarks?: boolean;
            avoid_extreme_dark?: boolean;
          },
          advanced_options: ai1DebugOutput.advancedOptions,
          applied_strategy_profile: ai1DebugOutput.appliedStrategyProfile,
          strategy_override_report_v1: ai1DebugOutput.strategyOverrideReport,
        },
        actions: [
          {
            key: "confirm_ai1",
            label: activeJobAwaitingAI1Confirm ? (needClarify ? "补充后继续执行" : "确认方案并继续") : "当前无需确认",
            style: "primary",
            disabled: !activeJobAwaitingAI1Confirm,
          },
          {
            key: "edit_ai1_plan",
            label: activeJobAwaitingAI1Confirm ? (needClarify ? "补充并编辑 AI1" : "编辑 AI1 方案") : "非确认态不可编辑",
            style: "secondary",
            disabled: !activeJobAwaitingAI1Confirm,
          },
          {
            key: "copy_issue_context",
            label: "复制问题上下文",
            style: "secondary",
            disabled: !ai1DebugTimelineAnomalies.length,
          },
        ],
      });
    }

    for (let i = 0; i < ai1DebugTimelineStepsForRender.length; i += 1) {
      const step = ai1DebugTimelineStepsForRender[i];
      messages.push({
        id: `processing-${activeJob.id}-${step.key}-${i}`,
        role: "system",
        type: "processing_status",
        created_at: now + 2 + i,
        payload: {
          stage_key: step.key,
          stage_title: step.title,
          status: step.status,
          summary: step.summary,
          details: step.details,
        },
      });
    }

    if (!focusAnomalyOnly && activeJob.status === "done") {
      messages.push({
        id: `final-gallery-${activeJob.id}`,
        role: "assistant",
        type: "final_gallery",
        created_at: now + 999,
        payload: {
          job_id: activeJob.id,
          requested_format: requestedFormat,
          output_count: outputCount > 0 ? outputCount : undefined,
          assets: [],
          note: outputCount > 0 ? "任务已完成，可进入我的作品查看全部资源。" : "任务已完成，可进入我的作品查看结果。",
        },
        actions: [
          {
            key: "goto_my_works",
            label: "查看我的作品",
            style: "primary",
            href: "/mine/works",
          },
        ],
      });
    }

    return messages;
  }, [
    activeJob,
    activeJobGeneratedFormats,
    activeJobRequestedFormats,
    activeJobAwaitingAI1Confirm,
    ai1Debug,
    ai1DebugOutput.appliedStrategyProfile,
    ai1DebugOutput.advancedOptions,
    ai1DebugOutput.ai2Instruction,
    ai1DebugOutput.strategyOverrideReport,
    ai1DebugOutput.userReply,
    ai1DebugTimelineAnomalies.length,
    ai1DebugTimelineStepsForRender,
    ai1TimelineAnomalyOnly,
  ]);

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

  const loadAdvancedSceneOptions = useCallback(async (format: string) => {
    const targetFormat = (format || "png").trim().toLowerCase() || "png";
    setAdvancedSceneOptionsLoading(true);
    setAdvancedSceneOptionsError(null);
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
      setAdvancedSceneOptionsError(msg);
      setAdvancedSceneOptions(filterAdvancedSceneOptionsForMainline(targetFormat, FALLBACK_ADVANCED_SCENE_OPTIONS));
    } finally {
      setAdvancedSceneOptionsLoading(false);
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
  const selectedAdvancedSceneOption = useMemo(
    () => advancedSceneOptions.find((item) => item.value === advancedScene) || advancedSceneOptions[0] || FALLBACK_ADVANCED_SCENE_OPTIONS[0],
    [advancedScene, advancedSceneOptions]
  );
  const advancedSceneLabel = useMemo(
    () => selectedAdvancedSceneOption?.label || "通用截图",
    [selectedAdvancedSceneOption]
  );
  const selectedAdvancedSceneOperatorIdentity = useMemo(() => {
    const value = selectedAdvancedSceneOption?.operator_identity;
    if (!value) return "";
    return String(value).trim();
  }, [selectedAdvancedSceneOption]);
  const selectedAdvancedSceneCandidateHint = useMemo(() => {
    const minRaw = selectedAdvancedSceneOption?.candidate_count_min;
    const maxRaw = selectedAdvancedSceneOption?.candidate_count_max;
    const min = Number(minRaw);
    const max = Number(maxRaw);
    const hasMin = Number.isFinite(min) && min > 0;
    const hasMax = Number.isFinite(max) && max > 0;
    if (hasMin && hasMax) {
      if (min === max) return `${min}`;
      return min < max ? `${min} ~ ${max}` : `${max} ~ ${min}`;
    }
    if (hasMin) return `≥ ${min}`;
    if (hasMax) return `≤ ${max}`;
    return "";
  }, [selectedAdvancedSceneOption]);
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
      if (!res.ok) return null;
      const job = (await res.json()) as VideoJobItem;
      syncOneJob(job);
      return job;
    },
    [syncOneJob]
  );

  const loadAI1Debug = useCallback(async (jobID: number, silent = false) => {
    if (!jobID) return;
    if (!silent) {
      setLoadingAI1Debug(true);
      setAI1DebugError(null);
    }
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/ai1-debug`);
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        setAI1Debug(null);
        return;
      }
      if (res.status === 404) {
        setAI1Debug(null);
        return;
      }
      if (!res.ok) {
        throw new Error((await res.text()) || "加载 AI1 调试信息失败");
      }
      const data = (await res.json()) as VideoJobAI1DebugResponse;
      setAI1Debug(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "加载 AI1 调试信息失败";
      setAI1DebugError(msg);
    } finally {
      if (!silent) {
        setLoadingAI1Debug(false);
      }
    }
  }, []);

  const consumeJobEvents = useCallback(
    (jobID: number, items: VideoJobEventItem[]) => {
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
    },
    [appendTimeline]
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

      let res: Response;
      try {
        res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/events?${params.toString()}`);
      } catch (err) {
        console.warn("[create] loadJobEvents network error", err);
        return;
      }
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as VideoJobEventListResponse;
      const items = Array.isArray(data.items) ? data.items : [];
      consumeJobEvents(jobID, items);

      const maxEventID = items.reduce((maxID, item) => {
        const value = Number(item.id || 0);
        return Number.isFinite(value) && value > maxID ? Math.trunc(value) : maxID;
      }, 0);
      const nextSinceID = Number(data.next_since_id || maxEventID || currentCursor || 0);
      if (Number.isFinite(nextSinceID) && nextSinceID >= 0) {
        const prev = eventCursorRef.current[jobID] || 0;
        if (nextSinceID > prev) {
          eventCursorRef.current[jobID] = nextSinceID;
        }
      }
    },
    [consumeJobEvents]
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
    async (jobID: number, revisionOverride?: number) => {
      if (!jobID || confirmingContinue) return;
      setConfirmingContinue(true);
      try {
        const planRevision =
          typeof revisionOverride === "number" && Number.isFinite(revisionOverride) && revisionOverride > 0
            ? Math.trunc(revisionOverride)
            : numberFromAny(
                ((ai1Debug?.trace as Record<string, unknown> | undefined)?.plan as Record<string, unknown> | undefined)
                  ?.plan_revision
              );
        const requestBody =
          planRevision > 0
            ? {
                plan_revision: planRevision,
              }
            : undefined;
        const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/confirm-ai1`, {
          method: "POST",
          headers: requestBody ? { "Content-Type": "application/json" } : undefined,
          body: requestBody ? JSON.stringify(requestBody) : undefined,
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
          text: planRevision > 0 ? `已确认 AI1（revision=${planRevision}），任务将恢复执行。` : "已发送继续指令，任务将恢复执行。",
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
    [ai1Debug?.trace, appendTimeline, confirmingContinue, loadJobEvents, loadJobs]
  );
  const openAI1PlanEditor = useCallback(() => {
    const userReply = ai1DebugOutput.userReply;
    const ai2Instruction = ai1DebugOutput.ai2Instruction;
    const interactiveActionRaw = stringFromAny(userReply.interactive_action).toLowerCase();
    const qualityWeights = objectFromAny(ai2Instruction.quality_weights);
    const technicalReject = objectFromAny(ai2Instruction.technical_reject);
    const maxBlurToleranceRaw = stringFromAny(technicalReject.max_blur_tolerance).toLowerCase();
    const maxBlurTolerance: "low" | "medium" | "high" =
      maxBlurToleranceRaw === "high" || maxBlurToleranceRaw === "medium" ? maxBlurToleranceRaw : "low";
    const hasAvoidWatermarks = Object.prototype.hasOwnProperty.call(technicalReject, "avoid_watermarks");
    const hasAvoidExtremeDark = Object.prototype.hasOwnProperty.call(technicalReject, "avoid_extreme_dark");
    setAI1EditDraft({
      supplement_prompt: "",
      objective: stringFromAny(ai2Instruction.objective),
      style_direction: stringFromAny(ai2Instruction.style_direction),
      must_capture_text: joinEditableListText(ai2Instruction.must_capture),
      avoid_text: joinEditableListText(ai2Instruction.avoid),
      quality_semantic: formatWeightValue(numberFromAny(qualityWeights.semantic), 0.35),
      quality_clarity: formatWeightValue(numberFromAny(qualityWeights.clarity), 0.35),
      quality_loop: formatWeightValue(numberFromAny(qualityWeights.loop), 0.05),
      quality_efficiency: formatWeightValue(numberFromAny(qualityWeights.efficiency), 0.25),
      risk_flags_text: joinEditableListText(ai2Instruction.risk_flags),
      max_blur_tolerance: maxBlurTolerance,
      avoid_watermarks: hasAvoidWatermarks ? boolFromAny(technicalReject.avoid_watermarks) : true,
      avoid_extreme_dark: hasAvoidExtremeDark ? boolFromAny(technicalReject.avoid_extreme_dark) : true,
      summary: stringFromAny(userReply.summary),
      interactive_action: interactiveActionRaw === "need_clarify" ? "need_clarify" : "proceed",
      clarify_questions_text: joinEditableListText(userReply.clarify_questions),
    });
    setAI1EditError(null);
    setShowAI1EditModal(true);
  }, [ai1DebugOutput.ai2Instruction, ai1DebugOutput.userReply]);
  const submitAI1PlanEdit = useCallback(async (autoContinue = false) => {
    const jobID = activeJob?.id;
    if (!jobID || savingAI1Edit || (autoContinue && confirmingContinue)) return;
    setSavingAI1Edit(true);
    setAI1EditError(null);
    try {
      const supplementPrompt = ai1EditDraft.supplement_prompt.trim();
      const supplement = parseAI1SupplementPrompt(supplementPrompt);
      const mustCapture = mergeEditableList(parseEditableListText(ai1EditDraft.must_capture_text), supplement.mustCapture, 16);
      const avoid = mergeEditableList(parseEditableListText(ai1EditDraft.avoid_text), supplement.avoid, 16);
      const clarifyQuestions = mergeEditableList(
        parseEditableListText(ai1EditDraft.clarify_questions_text),
        supplement.clarifyQuestions,
        6
      );
      const qualityWeights = {
        semantic: parseWeightInput(ai1EditDraft.quality_semantic),
        clarity: parseWeightInput(ai1EditDraft.quality_clarity),
        loop: parseWeightInput(ai1EditDraft.quality_loop),
        efficiency: parseWeightInput(ai1EditDraft.quality_efficiency),
      };
      const qualityWeightSum =
        qualityWeights.semantic + qualityWeights.clarity + qualityWeights.loop + qualityWeights.efficiency;
      if (qualityWeightSum <= 0) {
        throw new Error("质量权重至少需要一个大于 0 的值。");
      }
      const riskFlags = parseEditableListText(ai1EditDraft.risk_flags_text).map((item) =>
        item.trim().toLowerCase().replace(/[\s-]+/g, "_")
      );
      const interactiveAction = autoContinue ? "proceed" : ai1EditDraft.interactive_action;
      const clarifyQuestionsPayload = interactiveAction === "need_clarify" ? clarifyQuestions : [];
      const payload: Record<string, unknown> = {
        plan_revision: ai1PlanRevision,
        must_capture: mustCapture,
        avoid,
        style_direction: ai1EditDraft.style_direction.trim(),
        interactive_action: interactiveAction,
        clarify_questions: clarifyQuestionsPayload,
        quality_weights: qualityWeights,
        risk_flags: riskFlags,
        max_blur_tolerance: ai1EditDraft.max_blur_tolerance,
        avoid_watermarks: ai1EditDraft.avoid_watermarks,
        avoid_extreme_dark: ai1EditDraft.avoid_extreme_dark,
      };
      const objective = ai1EditDraft.objective.trim();
      if (objective) {
        payload.objective = objective;
      }
      const summary = ai1EditDraft.summary.trim();
      if (summary) {
        payload.summary = summary;
      }

      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${jobID}/ai1-plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        setGlobalError("登录已失效，请重新登录");
        return;
      }
      if (!res.ok) {
        let detail = "";
        try {
          const text = await res.text();
          detail = text.trim();
        } catch {
          detail = "";
        }
        if (res.status === 409) {
          throw new Error("AI1 方案版本已更新，请先刷新调试视图后再编辑。");
        }
        throw new Error(detail || "保存 AI1 方案失败");
      }
      let patchResponse: VideoJobAI1PlanPatchResponse | null = null;
      try {
        patchResponse = (await res.json()) as VideoJobAI1PlanPatchResponse;
      } catch {
        patchResponse = null;
      }
      const nextRevision = numberFromAny(patchResponse?.plan_revision);
      const displayRevision = nextRevision > 0 ? nextRevision : ai1PlanRevision + 1;
      appendTimeline({
        role: "assistant",
        name: "系统",
        level: "success",
        text: autoContinue
          ? `AI1 方案已更新（revision=${displayRevision}），正在继续执行后续流程。`
          : `AI1 方案已更新（revision=${displayRevision}），请确认继续执行。`,
        jobId: jobID,
      });
      setShowAI1EditModal(false);
      if (autoContinue) {
        await confirmContinueAfterAI1(jobID, nextRevision > 0 ? nextRevision : undefined);
      }
      await Promise.all([loadJobs(), loadJobEvents(jobID, false), loadAI1Debug(jobID, true)]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "保存 AI1 方案失败";
      setAI1EditError(msg);
    } finally {
      setSavingAI1Edit(false);
    }
  }, [
    activeJob?.id,
    ai1EditDraft.avoid_text,
    ai1EditDraft.avoid_extreme_dark,
    ai1EditDraft.avoid_watermarks,
    ai1EditDraft.clarify_questions_text,
    ai1EditDraft.interactive_action,
    ai1EditDraft.supplement_prompt,
    ai1EditDraft.max_blur_tolerance,
    ai1EditDraft.must_capture_text,
    ai1EditDraft.objective,
    ai1EditDraft.quality_clarity,
    ai1EditDraft.quality_efficiency,
    ai1EditDraft.quality_loop,
    ai1EditDraft.quality_semantic,
    ai1EditDraft.risk_flags_text,
    ai1EditDraft.style_direction,
    ai1EditDraft.summary,
    ai1PlanRevision,
    appendTimeline,
    confirmContinueAfterAI1,
    confirmingContinue,
    loadAI1Debug,
    loadJobEvents,
    loadJobs,
    savingAI1Edit,
  ]);
  const handleRichMessageAction = useCallback(
    async (action: RichMessageAction) => {
      const key = (action.key || "").trim().toLowerCase();
      if (!key) return;
      if (pendingRichActionKey) return;
      setPendingRichActionKey(key);
      try {
        if (key === "confirm_ai1") {
          if (activeJob?.id) {
            await confirmContinueAfterAI1(activeJob.id);
          }
          return;
        }
        if (key === "copy_issue_context") {
          await copyAI1IssueContext();
          return;
        }
        if (key === "edit_ai1_plan") {
          openAI1PlanEditor();
          return;
        }
        if (key === "open_normalized_debug") {
          setAI1DebugTab("normalized");
          return;
        }
        if (action.href) {
          if (typeof window !== "undefined") {
            if (action.target === "_blank") {
              window.open(action.href, "_blank", "noopener,noreferrer");
            } else {
              window.location.href = action.href;
            }
          }
        }
      } finally {
        setPendingRichActionKey(null);
      }
    },
    [activeJob?.id, confirmContinueAfterAI1, copyAI1IssueContext, openAI1PlanEditor, pendingRichActionKey]
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
      meta: `格式：${normalizedFormat.toUpperCase()} · 模型：${modelLabel} · 场景：${advancedSceneLabel} · 文件：${file.name}`,
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
        advanced_options: {
          scene: advancedScene,
          visual_focus: advancedVisualFocus,
          enable_matting: advancedEnableMatting,
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
    advancedEnableMatting,
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
      setAI1Debug(null);
      setAI1DebugError(null);
      setAI1TimelineAnomalyOnly(false);
      setAI1IssueCopyState("idle");
      appendTimeline({
        role: "assistant",
        name: "系统",
        level: "info",
        text: `已切换到任务 #${activeJobID}，正在同步处理日志...`,
      });
      void loadJobEvents(activeJobID, true);
      void loadAI1Debug(activeJobID);
    }

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      await Promise.all([loadJobDetail(activeJobID), loadAI1Debug(activeJobID, true)]);
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
  }, [activeJobID, appendTimeline, isAuthed, loadAI1Debug, loadJobDetail, loadJobEvents]);

  useEffect(() => {
    if (!showAI1DebugModal) {
      setAI1IssueCopyState("idle");
    }
  }, [showAI1DebugModal]);

  useEffect(() => {
    if (!showAI1EditModal) {
      setAI1EditError(null);
    }
  }, [showAI1EditModal]);

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [timeline.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showAI1EditModal) {
        if (!savingAI1Edit) {
          setShowAI1EditModal(false);
        }
        return;
      }
      if (showAI1DebugModal) {
        setShowAI1DebugModal(false);
        return;
      }
      if (showTaskPanel) {
        setShowTaskPanel(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [savingAI1Edit, showAI1DebugModal, showAI1EditModal, showTaskPanel]);

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
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 main-content-height flex flex-col">
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
            {activeJobID ? (
              <span
                className={`rounded-full border px-2 py-0.5 ${
                  jobStreamState.mode === "streaming"
                    ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                    : jobStreamState.mode === "fallback"
                      ? "border-amber-100 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-500"
                }`}
                title={jobStreamState.lastError || "事件同步链路状态"}
              >
                {jobStreamState.mode === "streaming"
                  ? "事件流：SSE"
                  : jobStreamState.mode === "fallback"
                    ? "事件流：轮询降级"
                    : "事件流：连接中"}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowAI1DebugModal(true);
              if (activeJob?.id) {
                void loadAI1Debug(activeJob.id);
              }
            }}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition shadow-sm ${
              showAI1DebugModal
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            AI1 调试视图
          </button>
          <button
            onClick={() => setShowTaskPanel((prev) => !prev)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition shadow-sm ${
              showTaskPanel
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {showTaskPanel ? "收起任务面板" : "任务面板"}
          </button>
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

      <section className="relative flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scroll-smooth sm:px-6 lg:px-8">
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

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 p-4">
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

            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] text-slate-600 transition hover:bg-slate-50"
              >
                <span>⚙️ 高级处理选项（可选）</span>
                <span className="text-slate-400">{showAdvancedOptions ? "收起" : "展开"}</span>
              </button>
              {showAdvancedOptions ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="text-[12px] font-semibold text-slate-700">场景与用途</div>
                  {advancedSceneOptionsLoading ? (
                    <div className="mt-1 text-[11px] text-slate-500">正在同步场景配置...</div>
                  ) : null}
                  {advancedSceneOptionsError ? (
                    <div className="mt-1 text-[11px] text-amber-600">场景配置加载失败，已使用默认场景。</div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {advancedSceneOptions.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setAdvancedScene(item.value)}
                        title={item.description || item.label}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                          advancedScene === item.value
                            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {selectedAdvancedSceneOption?.description ? (
                    <div className="mt-1 text-[11px] text-slate-500">{selectedAdvancedSceneOption.description}</div>
                  ) : null}
                  {selectedAdvancedSceneOperatorIdentity ? (
                    <div className="mt-1 text-[11px] text-slate-500">运营身份：{selectedAdvancedSceneOperatorIdentity}</div>
                  ) : null}
                  {selectedAdvancedSceneCandidateHint ? (
                    <div className="mt-1 text-[11px] text-slate-500">建议候选数：{selectedAdvancedSceneCandidateHint}</div>
                  ) : null}

                  <div className="mt-3 text-[12px] font-semibold text-slate-700">视觉聚焦（最多 2 项）</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ADVANCED_FOCUS_OPTIONS.map((item) => {
                      const active = advancedVisualFocus.includes(item.value);
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => toggleAdvancedFocus(item.value)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                            active
                              ? "border-blue-300 bg-blue-100 text-blue-800"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-[12px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={advancedEnableMatting}
                        onChange={(e) => setAdvancedEnableMatting(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                      />
                      启用人物主体抠图（透明底 PNG）
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAdvancedScene(
                          advancedSceneOptions.find((item) => item.value === "default")?.value ||
                            advancedSceneOptions[0]?.value ||
                            "default"
                        );
                        setAdvancedVisualFocus([]);
                        setAdvancedEnableMatting(false);
                      }}
                      className="text-[11px] text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                    >
                      重置高级选项
                    </button>
                  </div>
                </div>
              ) : null}
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

        {showTaskPanel ? (
          <div className="fixed inset-0 z-40">
            <button
              aria-label="关闭任务面板"
              className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]"
              onClick={() => setShowTaskPanel(false)}
            />
            <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-start justify-end px-4 py-6 lg:px-6">
              <div className="flex h-[calc(100vh-120px)] w-full max-w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-800">任务面板</div>
                  <button
                    onClick={() => setShowTaskPanel(false)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                  >
                    关闭
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">任务列表（紧凑）</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{compactJobs.length}</span>
                    </div>
                    {compactJobs.length > 0 ? (
                      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                        {compactJobs.map((job) => {
                          const active = job.id === activeJobID;
                          return (
                            <button
                              key={job.id}
                              onClick={() => setActiveJobID(job.id)}
                              className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                                active
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                              title={job.title || `任务 #${job.id}`}
                            >
                              <div className="font-semibold">#{job.id}</div>
                              <div className="mt-0.5 text-[11px] opacity-80">
                                {(job.output_formats?.[0] || "auto").toUpperCase()} · {STATUS_LABEL[job.status] || job.status}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-400">
                        暂无任务
                      </div>
                    )}
                  </div>

                  {activeJob ? (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-sm font-semibold text-slate-800">当前任务 #{activeJob.id}</div>
                      <div className="text-xs text-slate-500">{activeJob.title || "未命名任务"}</div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                          {STATUS_LABEL[activeJob.status] || activeJob.status}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                          {STAGE_LABEL[activeJob.stage] || activeJob.stage || "-"}
                        </span>
                      </div>

                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${Math.max(2, Math.min(100, Number(activeJob.progress || 0)))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>进度 {Math.max(0, Math.min(100, Number(activeJob.progress || 0)))}%</span>
                        <span>{formatTime(activeJob.updated_at)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                          请求：{activeJobRequestedFormats.length ? activeJobRequestedFormats.map((it) => it.toUpperCase()).join(", ") : "-"}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                          产出：{activeJobGeneratedFormats.length ? activeJobGeneratedFormats.map((it) => it.toUpperCase()).join(", ") : "-"}
                        </span>
                      </div>

                      {activeJob.billing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-[11px] text-slate-600">
                          <div className="mb-1.5 font-semibold text-slate-700">任务账单</div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            <span>真实成本</span>
                            <span className="text-right font-medium text-slate-700">{formatCNY(activeJob.billing.actual_cost_cny)}</span>
                            <span>扣除算力点</span>
                            <span className="text-right font-medium text-slate-700">{formatPoints(activeJob.billing.charged_points)}</span>
                            <span>预冻结点数</span>
                            <span className="text-right">{formatPoints(activeJob.billing.reserved_points)}</span>
                            <span>结算状态</span>
                            <span className="text-right">{formatHoldStatus(activeJob.billing.hold_status)}</span>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {activeJobAwaitingAI1Confirm ? (
                          <button
                            onClick={() => void confirmContinueAfterAI1(activeJob.id)}
                            disabled={confirmingContinue}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            {confirmingContinue ? "确认中..." : "确认继续"}
                          </button>
                        ) : null}
                        {activeJob.status === "queued" || activeJob.status === "running" ? (
                          <button
                            onClick={() => void handleCancelJob(activeJob.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                          >
                            取消任务
                          </button>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-600">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-700">AI1 调试数据</span>
                          {loadingAI1Debug ? (
                            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-600">同步中</span>
                          ) : null}
                          {ai1Debug ? (
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600">已获取</span>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">暂无</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setShowAI1DebugModal(true);
                              void loadAI1Debug(activeJob.id);
                            }}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            打开 AI1 调试视图
                          </button>
                          <button
                            onClick={() => void loadAI1Debug(activeJob.id)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                            disabled={loadingAI1Debug}
                          >
                            {loadingAI1Debug ? "刷新中..." : "刷新"}
                          </button>
                        </div>
                      </div>

                      {activeJob.error_message ? (
                        <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          错误：{activeJob.error_message}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-400">
                      当前没有选中任务
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showAI1EditModal ? (
          <div className="fixed inset-0 z-50">
            <button
              aria-label="关闭 AI1 编辑"
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
              onClick={() => {
                if (savingAI1Edit) return;
                setShowAI1EditModal(false);
              }}
            />
            <div className="relative z-10 mx-auto flex h-full w-full max-w-4xl items-start justify-center px-4 py-6 lg:px-6">
              <div className="flex h-[calc(100vh-120px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">编辑 AI1 方案</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {activeJob ? `任务 #${activeJob.id} · revision ${ai1PlanRevision}` : "当前没有选中任务"}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (savingAI1Edit) return;
                      setShowAI1EditModal(false);
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    disabled={savingAI1Edit}
                  >
                    关闭
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {ai1EditError ? (
                    <div className="mb-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{ai1EditError}</div>
                  ) : null}
                  <div className="space-y-3">
                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-600">补充提示词（可选）</div>
                      <textarea
                        value={ai1EditDraft.supplement_prompt}
                        onChange={(event) =>
                          setAI1EditDraft((prev) => ({
                            ...prev,
                            supplement_prompt: event.target.value,
                          }))
                        }
                        placeholder={"例如：\n重点抓住进球后庆祝动作\n避免裁到广告牌\n是否优先前 10 秒?"}
                        className="h-20 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      />
                      <div className="mt-1 text-[11px] text-slate-500">
                        保存时会自动拆分补充内容并合并到 must_capture / avoid / clarify_questions。
                      </div>
                    </label>

                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-600">目标（objective）</div>
                      <input
                        value={ai1EditDraft.objective}
                        onChange={(event) =>
                          setAI1EditDraft((prev) => ({
                            ...prev,
                            objective: event.target.value,
                          }))
                        }
                        placeholder="例如：提取进球瞬间的高清静态帧"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-600">风格（style_direction）</div>
                      <input
                        value={ai1EditDraft.style_direction}
                        onChange={(event) =>
                          setAI1EditDraft((prev) => ({
                            ...prev,
                            style_direction: event.target.value,
                          }))
                        }
                        placeholder="例如：高清、主体居中、表情清晰"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-600">必须捕捉（must_capture）</div>
                      <textarea
                        value={ai1EditDraft.must_capture_text}
                        onChange={(event) =>
                          setAI1EditDraft((prev) => ({
                            ...prev,
                            must_capture_text: event.target.value,
                          }))
                        }
                        placeholder={"每行一个词，例如：\n进球瞬间\n球员庆祝\n观众欢呼"}
                        className="h-24 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-600">规避项（avoid）</div>
                      <textarea
                        value={ai1EditDraft.avoid_text}
                        onChange={(event) =>
                          setAI1EditDraft((prev) => ({
                            ...prev,
                            avoid_text: event.target.value,
                          }))
                        }
                        placeholder={"每行一个词，例如：\n黑场\n重影\n强抖动"}
                        className="h-20 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-xs font-medium text-slate-600">权重 semantic（0~1）</div>
                        <input
                          value={ai1EditDraft.quality_semantic}
                          onChange={(event) =>
                            setAI1EditDraft((prev) => ({
                              ...prev,
                              quality_semantic: event.target.value,
                            }))
                          }
                          placeholder="例如：0.40"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-medium text-slate-600">权重 clarity（0~1）</div>
                        <input
                          value={ai1EditDraft.quality_clarity}
                          onChange={(event) =>
                            setAI1EditDraft((prev) => ({
                              ...prev,
                              quality_clarity: event.target.value,
                            }))
                          }
                          placeholder="例如：0.40"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-medium text-slate-600">权重 loop（0~1）</div>
                        <input
                          value={ai1EditDraft.quality_loop}
                          onChange={(event) =>
                            setAI1EditDraft((prev) => ({
                              ...prev,
                              quality_loop: event.target.value,
                            }))
                          }
                          placeholder="例如：0.05"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-medium text-slate-600">权重 efficiency（0~1）</div>
                        <input
                          value={ai1EditDraft.quality_efficiency}
                          onChange={(event) =>
                            setAI1EditDraft((prev) => ({
                              ...prev,
                              quality_efficiency: event.target.value,
                            }))
                          }
                          placeholder="例如：0.15"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-600">风险标记（risk_flags）</div>
                      <textarea
                        value={ai1EditDraft.risk_flags_text}
                        onChange={(event) =>
                          setAI1EditDraft((prev) => ({
                            ...prev,
                            risk_flags_text: event.target.value,
                          }))
                        }
                        placeholder={"每行一个，例如：\nlow_light\nfast_motion"}
                        className="h-20 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="block">
                        <div className="mb-1 text-xs font-medium text-slate-600">模糊容忍（max_blur_tolerance）</div>
                        <select
                          value={ai1EditDraft.max_blur_tolerance}
                          onChange={(event) =>
                            setAI1EditDraft((prev) => ({
                              ...prev,
                              max_blur_tolerance:
                                event.target.value === "high" || event.target.value === "medium"
                                  ? (event.target.value as "high" | "medium")
                                  : "low",
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="low">low（严格）</option>
                          <option value="medium">medium（平衡）</option>
                          <option value="high">high（宽松）</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={ai1EditDraft.avoid_watermarks}
                          onChange={(event) =>
                            setAI1EditDraft((prev) => ({
                              ...prev,
                              avoid_watermarks: event.target.checked,
                            }))
                          }
                        />
                        避开水印（avoid_watermarks）
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={ai1EditDraft.avoid_extreme_dark}
                          onChange={(event) =>
                            setAI1EditDraft((prev) => ({
                              ...prev,
                              avoid_extreme_dark: event.target.checked,
                            }))
                          }
                        />
                        避开极暗画面（avoid_extreme_dark）
                      </label>
                    </div>

                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-600">用户反馈摘要（summary）</div>
                      <textarea
                        value={ai1EditDraft.summary}
                        onChange={(event) =>
                          setAI1EditDraft((prev) => ({
                            ...prev,
                            summary: event.target.value,
                          }))
                        }
                        placeholder="给用户看的自然语言说明"
                        className="h-20 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-xs font-medium text-slate-600">交互动作（interactive_action）</div>
                        <select
                          value={ai1EditDraft.interactive_action}
                          onChange={(event) =>
                            setAI1EditDraft((prev) => ({
                              ...prev,
                              interactive_action: event.target.value === "need_clarify" ? "need_clarify" : "proceed",
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="proceed">proceed（可继续）</option>
                          <option value="need_clarify">need_clarify（需补充）</option>
                        </select>
                      </label>

                      <label className="block">
                        <div className="mb-1 text-xs font-medium text-slate-600">补充提问（clarify_questions）</div>
                        <textarea
                          value={ai1EditDraft.clarify_questions_text}
                          onChange={(event) =>
                            setAI1EditDraft((prev) => ({
                              ...prev,
                              clarify_questions_text: event.target.value,
                            }))
                          }
                          placeholder={"每行一个问题"}
                          className="h-20 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
                  <button
                    onClick={() => {
                      if (savingAI1Edit) return;
                      setShowAI1EditModal(false);
                    }}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    disabled={savingAI1Edit}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void submitAI1PlanEdit(true)}
                    className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={savingAI1Edit || confirmingContinue || !activeJob}
                  >
                    {savingAI1Edit || confirmingContinue ? "处理中..." : "保存并继续执行"}
                  </button>
                  <button
                    onClick={() => void submitAI1PlanEdit()}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={savingAI1Edit || !activeJob}
                  >
                    {savingAI1Edit ? "保存中..." : "保存并更新 AI1"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showAI1DebugModal ? (
          <div className="fixed inset-0 z-50">
            <button
              aria-label="关闭 AI1 调试视图"
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]"
              onClick={() => setShowAI1DebugModal(false)}
            />
            <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-start justify-center px-4 py-6 lg:px-6">
              <div className="flex h-[calc(100vh-120px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">AI1 调试视图</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {activeJob ? `任务 #${activeJob.id} · ${activeJob.title || "未命名任务"}` : "当前没有选中任务"}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAI1DebugModal(false)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                  >
                    关闭
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {activeJob ? (
                    <div className="space-y-3">
                      {ai1DebugError ? (
                        <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          {ai1DebugError}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-600">
                          {ai1Debug ? (
                            <>
                              格式 {String(ai1Debug.requested_format || "-").toUpperCase()} · 流程 {ai1Debug.flow_mode || "-"} · 状态{" "}
                              {ai1Debug.status || "-"}
                              {ai1Debug.source_prompt ? ` · 提示词：${ai1Debug.source_prompt}` : ""}
                            </>
                          ) : (
                            "AI1 数据尚未生成，可稍后刷新。"
                          )}
                        </div>
                        <button
                          onClick={() => void loadAI1Debug(activeJob.id)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          disabled={loadingAI1Debug}
                        >
                          {loadingAI1Debug ? "刷新中..." : "刷新"}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setAI1DebugTab("timeline")}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            ai1DebugTab === "timeline"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          时序视图
                        </button>
                        <button
                          onClick={() => setAI1DebugTab("normalized")}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            ai1DebugTab === "normalized"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          规范输出
                        </button>
                        <button
                          onClick={() => setAI1DebugTab("request")}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            ai1DebugTab === "request"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          POST 请求
                        </button>
                        <button
                          onClick={() => setAI1DebugTab("response")}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            ai1DebugTab === "response"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          模型返回
                        </button>
                      </div>

                      {ai1DebugTab === "timeline" ? (
                        <div className="h-[calc(100vh-330px)] min-h-[280px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">总步骤 {ai1DebugTimeline.length}</span>
                                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                                  异常 {ai1DebugTimelineAnomalies.length}
                                </span>
                                {ai1DebugTimelineStatusStats.repaired > 0 ? (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                    修复 {ai1DebugTimelineStatusStats.repaired}
                                  </span>
                                ) : null}
                                {ai1DebugTimelineStatusStats.error > 0 ? (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                                    失败 {ai1DebugTimelineStatusStats.error}
                                  </span>
                                ) : null}
                                {ai1DebugTimelineStatusStats.warn > 0 ? (
                                  <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-orange-700">
                                    风险 {ai1DebugTimelineStatusStats.warn}
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => setAI1TimelineAnomalyOnly((prev) => !prev)}
                                  className={`rounded-md border px-2.5 py-1 text-[11px] ${
                                    ai1TimelineAnomalyOnly
                                      ? "border-rose-200 bg-rose-50 text-rose-700"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {ai1TimelineAnomalyOnly ? "显示全部步骤" : "异常聚焦（失败/修复）"}
                                </button>
                                <button
                                  onClick={() => void copyAI1IssueContext()}
                                  disabled={!ai1DebugTimelineAnomalies.length}
                                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {ai1IssueCopyState === "copied" ? "已复制" : ai1IssueCopyState === "error" ? "复制失败" : "复制问题上下文"}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            {ai1RichMessages.length ? (
                              ai1RichMessages.map((message) => (
                                <MessageRenderer
                                  key={message.id}
                                  message={message}
                                  onAction={handleRichMessageAction}
                                  pendingActionKey={pendingRichActionKey}
                                />
                              ))
                            ) : ai1DebugTimeline.length ? (
                              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-6 text-center text-xs text-amber-700">
                                当前无异常步骤，已通过聚焦模式过滤。
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-500">
                                暂无 AI1 时序数据，请先触发一次 AI1 调试请求。
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {ai1DebugTab === "normalized" ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-700">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold">字段级审计（AI1→AI2）</span>
                                  <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5">
                                    重点字段 {ai1FieldAuditStats.total} 项
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                    用户编辑字段 {ai1FieldAuditStats.edited}
                                  </span>
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                    指令/执行差异 {ai1FieldAuditStats.drift}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setAI1FieldAuditEditedOnly((prev) => !prev)}
                                  className={`rounded-md border px-2.5 py-1 text-[11px] ${
                                    ai1FieldAuditEditedOnly
                                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {ai1FieldAuditEditedOnly ? "显示全部字段" : "仅看用户编辑字段"}
                                </button>
                              </div>
                              <div className="overflow-x-auto rounded-md border border-emerald-100 bg-white">
                                <table className="min-w-full text-[11px]">
                                  <thead className="bg-emerald-50 text-emerald-700">
                                    <tr>
                                      <th className="px-2 py-1.5 text-left font-semibold">字段</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">AI1 指令值</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">执行生效值</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">状态</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ai1FieldAuditRowsForRender.map((row) => (
                                      <tr key={row.key} className="border-t border-emerald-50 text-slate-700">
                                        <td className="px-2 py-1.5">
                                          <div className="font-medium">{row.label}</div>
                                          <div className="text-[10px] text-slate-400">{row.source}</div>
                                        </td>
                                        <td className="px-2 py-1.5 align-top">
                                          <code className="break-all text-[11px]">{row.instructionValue}</code>
                                        </td>
                                        <td className="px-2 py-1.5 align-top">
                                          <code className="break-all text-[11px]">{row.effectiveValue}</code>
                                        </td>
                                        <td className="px-2 py-1.5 align-top">
                                          <div className="flex flex-wrap gap-1">
                                            {row.edited ? (
                                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
                                                用户编辑
                                              </span>
                                            ) : (
                                              <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                                                未编辑
                                              </span>
                                            )}
                                            {row.drift ? (
                                              <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                                                指令/执行有差异
                                              </span>
                                            ) : (
                                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                                                一致
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                    {ai1FieldAuditRowsForRender.length === 0 ? (
                                      <tr className="border-t border-emerald-50 text-slate-500">
                                        <td className="px-2 py-3 text-center" colSpan={4}>
                                          当前筛选下没有字段可展示。
                                        </td>
                                      </tr>
                                    ) : null}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}
                          {ai1DebugTab === "normalized" && Object.keys(ai1PipelineAlignment.report || {}).length ? (
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
                              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-700">
                                  <span className="font-semibold">AI1→AI2→Worker→AI3 对照报告</span>
                                  <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5">
                                    检查项 {ai1PipelineAlignment.totalChecks}
                                  </span>
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                    通过 {ai1PipelineAlignment.passCount}
                                  </span>
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                    风险 {ai1PipelineAlignment.warnCount}
                                  </span>
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                                    失败 {ai1PipelineAlignment.failCount}
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                    场景 {stringFromAny(ai1PipelineAlignment.scenario.scene_label || ai1PipelineAlignment.scenario.scene) || "-"}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 ${
                                      ai1PipelineAlignment.status === "pass"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : ai1PipelineAlignment.status === "fail"
                                          ? "border-rose-200 bg-rose-50 text-rose-700"
                                          : "border-amber-200 bg-amber-50 text-amber-700"
                                    }`}
                                  >
                                    总状态 {ai1PipelineAlignment.status || "-"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={exportPipelineAlignmentJSON}
                                    className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-700 hover:bg-indigo-100"
                                  >
                                    导出 JSON
                                  </button>
                                  <button
                                    type="button"
                                    onClick={exportPipelineAlignmentCSV}
                                    className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] text-indigo-700 hover:bg-indigo-50"
                                  >
                                    导出 CSV
                                  </button>
                                </div>
                              </div>
                              {ai1PipelineAlignment.checks.length ? (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                  {ai1PipelineAlignment.checks.slice(0, 8).map((check) => (
                                    <span
                                      key={check.key}
                                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                        check.status === "pass"
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : check.status === "fail"
                                            ? "border-rose-200 bg-rose-50 text-rose-700"
                                            : "border-amber-200 bg-amber-50 text-amber-700"
                                      }`}
                                      title={check.detail || check.label}
                                    >
                                      {check.label} · {check.status || "warn"}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <pre className="max-h-52 overflow-auto rounded-md border border-indigo-100 bg-white p-2 text-[11px] leading-relaxed text-slate-700">
                                {prettyJSON(ai1PipelineAlignment.report)}
                              </pre>
                            </div>
                          ) : null}
                          {ai1DebugTab === "normalized" && Object.keys(ai1SceneBaselineDiff.diff || {}).length ? (
                            <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3">
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-teal-700">
                                <span className="font-semibold">场景基线差异（default vs 当前）</span>
                                <span className="rounded-full border border-teal-200 bg-white px-2 py-0.5">
                                  baseline {ai1SceneBaselineDiff.baselineScene || "-"}
                                </span>
                                <span className="rounded-full border border-teal-200 bg-white px-2 py-0.5">
                                  current {ai1SceneBaselineDiff.currentScene || "-"}
                                </span>
                                <span
                                  className={`rounded-full border px-2 py-0.5 ${
                                    ai1SceneBaselineDiff.sceneChanged
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  {ai1SceneBaselineDiff.sceneChanged ? "存在场景差异" : "当前即基线"}
                                </span>
                              </div>
                              {ai1SceneBaselineDiff.summary ? (
                                <div className="mb-2 rounded-md border border-teal-100 bg-white px-2 py-1 text-[11px] text-teal-700">
                                  {ai1SceneBaselineDiff.summary}
                                </div>
                              ) : null}
                              <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                                {ai1SceneBaselineDiff.weightDiffKeys.length ? (
                                  <span className="rounded-full border border-teal-200 bg-white px-2 py-0.5 text-teal-700">
                                    权重差异: {ai1SceneBaselineDiff.weightDiffKeys.join("、")}
                                  </span>
                                ) : (
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                    权重差异: 无
                                  </span>
                                )}
                                {ai1SceneBaselineDiff.mustAdded.length ? (
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                    must_capture新增: {ai1SceneBaselineDiff.mustAdded.join("、")}
                                  </span>
                                ) : null}
                                {ai1SceneBaselineDiff.avoidAdded.length ? (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                                    avoid新增: {ai1SceneBaselineDiff.avoidAdded.join("、")}
                                  </span>
                                ) : null}
                                {ai1SceneBaselineDiff.technicalChanged.length ? (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                    门槛变化: {ai1SceneBaselineDiff.technicalChanged.join("、")}
                                  </span>
                                ) : null}
                              </div>
                              <pre className="max-h-40 overflow-auto rounded-md border border-teal-100 bg-white p-2 text-[11px] leading-relaxed text-slate-700">
                                {prettyJSON(ai1SceneBaselineDiff.diff)}
                              </pre>
                            </div>
                          ) : null}
                          {ai1DebugTab === "normalized" && Object.keys(ai1DebugOutput.advancedSceneGuard || {}).length ? (
                            <div className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-3">
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-cyan-700">
                                <span className="font-semibold">PNG 主线场景收敛</span>
                                <span className="rounded-full border border-cyan-200 bg-white px-2 py-0.5">
                                  请求场景 {stringFromAny(ai1DebugOutput.advancedSceneGuard.requested_scene) || "-"}
                                </span>
                                <span className="rounded-full border border-cyan-200 bg-white px-2 py-0.5">
                                  生效场景 {stringFromAny(ai1DebugOutput.advancedSceneGuard.applied_scene) || "-"}
                                </span>
                              </div>
                              <pre className="max-h-40 overflow-auto rounded-md border border-cyan-100 bg-white p-2 text-[11px] leading-relaxed text-slate-700">
                                {prettyJSON(ai1DebugOutput.advancedSceneGuard)}
                              </pre>
                            </div>
                          ) : null}
                          {ai1DebugTab === "normalized" && Object.keys(ai1DebugOutput.strategyOverrideReport || {}).length ? (
                            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-violet-700">
                                <span className="font-semibold">策略强约束覆盖报告</span>
                                <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5">
                                  覆盖项 {numberFromAny(ai1DebugOutput.strategyOverrideReport.override_count) || 0}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                  场景 {stringFromAny(ai1DebugOutput.strategyOverrideReport.scene_label || ai1DebugOutput.strategyOverrideReport.scene) || "-"}
                                </span>
                              </div>
                              <pre className="max-h-52 overflow-auto rounded-md border border-violet-100 bg-white p-2 text-[11px] leading-relaxed text-slate-700">
                                {prettyJSON(ai1DebugOutput.strategyOverrideReport)}
                              </pre>
                            </div>
                          ) : null}
                          {ai1DebugTab === "normalized" && (ai2CandidateExplainability.totalCandidates > 0 || ai2CandidateExplainability.rows.length) ? (
                            <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-3">
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-sky-700">
                                <span className="font-semibold">AI2 候选解释（must_capture / avoid 命中）</span>
                                <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5">
                                  候选 {ai2CandidateExplainability.totalCandidates}
                                </span>
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                  must_capture 命中帧 {ai2CandidateExplainability.mustCaptureHitFrames}
                                </span>
                                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                                  avoid 触发帧 {ai2CandidateExplainability.avoidHitFrames}
                                </span>
                                {ai2CandidateExplainability.decisionCounts.map((item) => (
                                  <span
                                    key={`${item.key}-${item.count}`}
                                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600"
                                  >
                                    {item.label} {item.count}
                                  </span>
                                ))}
                                {ai2CandidateExplainability.selectorVersion ? (
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                    选择器 {ai2CandidateExplainability.selectorVersion}
                                  </span>
                                ) : null}
                                {ai2CandidateExplainability.scoringMode ? (
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                    打分模式 {ai2CandidateExplainability.scoringMode}
                                  </span>
                                ) : null}
                                {ai2CandidateExplainability.selectionPolicy ? (
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                    选帧策略 {ai2CandidateExplainability.selectionPolicy}
                                  </span>
                                ) : null}
                              </div>
                              {ai2CandidateExplainability.scoringFormula ? (
                                <div className="mb-2 rounded-md border border-sky-100 bg-white px-2 py-1 text-[11px] text-sky-700">
                                  打分公式：{ai2CandidateExplainability.scoringFormula}
                                </div>
                              ) : null}
                              {ai2CandidateExplainability.rejectCounts.total > 0 ? (
                                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                    拒绝总数 {ai2CandidateExplainability.rejectCounts.total}
                                  </span>
                                  {ai2CandidateExplainability.rejectCounts.blur > 0 ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                      模糊 {ai2CandidateExplainability.rejectCounts.blur}
                                    </span>
                                  ) : null}
                                  {ai2CandidateExplainability.rejectCounts.brightness > 0 ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                      亮度 {ai2CandidateExplainability.rejectCounts.brightness}
                                    </span>
                                  ) : null}
                                  {ai2CandidateExplainability.rejectCounts.exposure > 0 ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                      曝光 {ai2CandidateExplainability.rejectCounts.exposure}
                                    </span>
                                  ) : null}
                                  {ai2CandidateExplainability.rejectCounts.stillBlur > 0 ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                      清晰度门槛 {ai2CandidateExplainability.rejectCounts.stillBlur}
                                    </span>
                                  ) : null}
                                  {ai2CandidateExplainability.rejectCounts.watermark > 0 ? (
                                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                                      水印风险 {ai2CandidateExplainability.rejectCounts.watermark}
                                    </span>
                                  ) : null}
                                  {ai2CandidateExplainability.rejectCounts.nearDup > 0 ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                      近重复 {ai2CandidateExplainability.rejectCounts.nearDup}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setAI2CandidateExplainFilter("all")}
                                  className={`rounded-md border px-2.5 py-1 text-[11px] ${
                                    ai2CandidateExplainFilter === "all"
                                      ? "border-sky-300 bg-sky-100 text-sky-800"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  全部
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAI2CandidateExplainFilter("rejected")}
                                  className={`rounded-md border px-2.5 py-1 text-[11px] ${
                                    ai2CandidateExplainFilter === "rejected"
                                      ? "border-rose-300 bg-rose-100 text-rose-700"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  仅看被拒绝
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAI2CandidateExplainFilter("must_capture")}
                                  className={`rounded-md border px-2.5 py-1 text-[11px] ${
                                    ai2CandidateExplainFilter === "must_capture"
                                      ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  仅看命中 must_capture
                                </button>
                                <button
                                  type="button"
                                  onClick={exportAI2CandidateExplainCSV}
                                  disabled={!ai2CandidateExplainRowsForRender.length}
                                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  导出 CSV
                                </button>
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                                  当前显示 {ai2CandidateExplainRowsForRender.length}
                                </span>
                              </div>
                              <div className="overflow-x-auto rounded-md border border-sky-100 bg-white">
                                <table className="min-w-full text-[11px]">
                                  <thead className="bg-sky-50 text-sky-700">
                                    <tr>
                                      <th className="px-2 py-1.5 text-left font-semibold">排名</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">帧</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">决策</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">must_capture 命中</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">avoid 触发</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">解释</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ai2CandidateExplainRowsForRender.map((row, idx) => (
                                      <tr key={`${row.rank}-${row.frameName}-${idx}`} className="border-t border-sky-50 text-slate-700">
                                        <td className="px-2 py-1.5">{row.rank || "-"}</td>
                                        <td className="px-2 py-1.5">
                                          <div className="max-w-[180px] truncate" title={row.frameName}>
                                            {row.frameName}
                                          </div>
                                        </td>
                                        <td className="px-2 py-1.5">{row.decision || "-"}</td>
                                        <td className="px-2 py-1.5">
                                          {row.mustCaptureHits.length ? row.mustCaptureHits.join("、") : "-"}
                                        </td>
                                        <td className="px-2 py-1.5">{row.avoidHits.length ? row.avoidHits.join("、") : "-"}</td>
                                        <td className="px-2 py-1.5">
                                          <div className="max-w-[320px] truncate" title={row.summary || row.rejectReason || "-"}>
                                            {row.summary || row.rejectReason || "-"}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                    {ai2CandidateExplainRowsForRender.length === 0 ? (
                                      <tr className="border-t border-sky-50 text-slate-500">
                                        <td className="px-2 py-3 text-center" colSpan={6}>
                                          当前筛选下暂无候选解释详情。
                                        </td>
                                      </tr>
                                    ) : null}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}
                          <pre className="h-[calc(100vh-430px)] min-h-[220px] overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-4 text-[12px] leading-relaxed text-emerald-100">
                            {ai1DebugTab === "normalized"
                              ? prettyJSON({
                                  user_reply: ai1DebugOutput.userReply,
                                  ai2_instruction: ai1DebugOutput.ai2Instruction,
                                  ai2_execution_observability_v1: ai1DebugOutput.ai2ExecutionObservability,
                                  ai1_output_v2: ai1DebugOutput.ai1OutputV2,
                                  contract_report: ai1DebugOutput.contractReport,
                                  advanced_scene_guard_v1: ai1DebugOutput.advancedSceneGuard,
                                  strategy_override_report_v1: ai1DebugOutput.strategyOverrideReport,
                                  pipeline_alignment_report_v1: ai1DebugOutput.pipelineAlignmentReport,
                                })
                              : ai1DebugTab === "request"
                                ? prettyJSON({
                                    input: ai1Debug?.input,
                                    model_request: ai1Debug?.model_request,
                                  })
                                : prettyJSON({
                                    model_response: ai1Debug?.model_response,
                                    trace: ai1Debug?.trace,
                                  })}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      当前没有选中任务，无法查看 AI1 调试数据。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
    </>
  );
}
