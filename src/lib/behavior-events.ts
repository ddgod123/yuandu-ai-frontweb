"use client";

import { API_BASE, getOrCreateDeviceID } from "@/lib/auth-client";

type BehaviorEventPayload = {
  route?: string;
  referrer?: string;
  collection_id?: number;
  emoji_id?: number;
  ip_id?: number;
  subscription_status?: string;
  success?: boolean;
  error_code?: string;
  request_id?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
};

export function emitBehaviorEvent(eventName: string, payload: BehaviorEventPayload = {}) {
  if (typeof window === "undefined") return;
  const name = (eventName || "").trim();
  if (!name) return;

  const body: Record<string, unknown> = {
    event_name: name,
    route: payload.route || `${window.location.pathname}${window.location.search}`,
    referrer: payload.referrer || document.referrer || "",
    collection_id: payload.collection_id,
    emoji_id: payload.emoji_id,
    ip_id: payload.ip_id,
    subscription_status: payload.subscription_status || "",
    success: typeof payload.success === "boolean" ? payload.success : undefined,
    error_code: payload.error_code || "",
    request_id: payload.request_id || "",
    session_id: payload.session_id || "",
    metadata: payload.metadata || {},
    device_id: getOrCreateDeviceID(),
  };

  void fetch(`${API_BASE}/behavior/events`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Device-ID": getOrCreateDeviceID(),
    },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // Best-effort telemetry.
  });
}

