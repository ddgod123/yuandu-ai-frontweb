export type RichMessageRole = "user" | "assistant" | "system";

export type RichMessageType =
  | "text"
  | "upload_progress"
  | "ai1_plan_card"
  | "processing_status"
  | "final_gallery";

export type RichMessageActionStyle = "primary" | "secondary" | "danger";

export type RichMessageAction = {
  key: string;
  label: string;
  style?: RichMessageActionStyle;
  disabled?: boolean;
  href?: string;
  target?: "_self" | "_blank";
};

export type UploadProgressPayload = {
  job_id: number;
  stage?: string;
  stage_label?: string;
  status?: string;
  status_label?: string;
  progress_percent: number;
  requested_format?: string;
  generated_formats?: string[];
  queue_label?: string;
  updated_at?: string;
};

export type AI1PlanCardPayload = {
  requested_format?: string;
  summary?: string;
  intent_understanding?: string;
  strategy_summary?: string;
  detected_tags?: string[];
  risk_warning?: {
    has_risk?: boolean;
    message?: string;
  };
  confidence?: number;
  clarify_questions?: string[];
  estimated_eta_seconds?: number;
  must_capture?: string[];
  avoid?: string[];
  style_direction?: string;
  objective?: string;
  interactive_action?: "proceed" | "need_clarify" | string;
  quality_weights?: Record<string, number>;
  risk_flags?: string[];
  technical_reject?: {
    max_blur_tolerance?: string;
    avoid_watermarks?: boolean;
    avoid_extreme_dark?: boolean;
  };
  advanced_options?: Record<string, unknown>;
  applied_strategy_profile?: Record<string, unknown>;
  strategy_override_report_v1?: Record<string, unknown>;
};

export type ProcessingStatusPayload = {
  stage_key: string;
  stage_title: string;
  status: string;
  summary?: string;
  details?: Record<string, unknown>;
};

export type FinalGalleryAsset = {
  id?: string;
  url: string;
  thumb_url?: string;
  file_name?: string;
  mime_type?: string;
};

export type FinalGalleryPayload = {
  job_id: number;
  requested_format?: string;
  output_count?: number;
  assets?: FinalGalleryAsset[];
  note?: string;
};

export type RichMessagePayloadMap = {
  text: { text?: string };
  upload_progress: UploadProgressPayload;
  ai1_plan_card: AI1PlanCardPayload;
  processing_status: ProcessingStatusPayload;
  final_gallery: FinalGalleryPayload;
};

export type RichMessage<T extends RichMessageType = RichMessageType> = {
  id: string;
  role: RichMessageRole;
  type: T;
  created_at: number;
  content?: string;
  payload?: RichMessagePayloadMap[T];
  actions?: RichMessageAction[];
  raw?: Record<string, unknown>;
};

export type RichMessageStreamEnvelope = {
  schema_version: "ui_message_v1";
  message: RichMessage;
};
