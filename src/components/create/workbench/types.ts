export type WorkbenchJobItem = {
  id: number;
  title: string;
  status: string;
  stage: string;
  progress: number;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
  output_formats?: string[];
  metrics?: Record<string, unknown>;
  result_summary?: {
    collection_id?: number;
    collection_title?: string;
    file_count?: number;
    preview_images?: string[];
    format_summary?: string[];
  };
};

export type WorkbenchResultEmojiItem = {
  id: number;
  title?: string;
  format?: string;
  file_url?: string;
  thumb_url?: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  display_order?: number;
  output_score?: number;
};

export type WorkbenchFormatOption = {
  value: string;
  label: string;
  disabled?: boolean;
  reason?: string;
};

export type WorkbenchModelOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type WorkbenchAdvancedSceneOption = {
  value: string;
  label: string;
  description?: string;
};

export type WorkbenchAdvancedFocusOption = {
  value: string;
  label: string;
};

export type WorkbenchTimelineMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  level?: "info" | "success" | "warn" | "error";
  name?: string;
  text: string;
  ts: number;
  meta?: string;
  jobId?: number;
  ai1Card?: {
    goal?: string;
    audience?: string;
    style?: string;
    mustCapture?: string[];
    avoid?: string[];
  };
  ai2Card?: {
    strategy?: string;
    startSec?: string;
    endSec?: string;
    score?: string;
    candidateCount?: string;
  };
  ai3Card?: {
    deliverCount?: string;
    rejectCount?: string;
    summaryNote?: string;
  };
};
