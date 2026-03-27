"use client";

import { useEffect, useRef, useState } from "react";

import { fetchWithAuthRetry } from "@/lib/auth-client";

export type JobStreamEventItem = {
  id?: number;
  stage?: string;
  level?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

export type JobStreamEnvelope = {
  schema_version?: string;
  type?: string;
  job_id?: number;
  event?: JobStreamEventItem;
  next_since_id?: number;
  ts?: string;
  message?: string;
};

export type JobStreamMode = "idle" | "connecting" | "streaming" | "fallback";

type UseJobStreamOptions = {
  apiBase: string;
  jobID?: number | null;
  enabled?: boolean;
  initialSinceID?: number;
  onEnvelope?: (envelope: JobStreamEnvelope, eventName: string) => void;
  onFallbackPoll?: () => Promise<void> | void;
  fallbackIntervalMs?: number;
};

type UseJobStreamState = {
  mode: JobStreamMode;
  isStreaming: boolean;
  isFallback: boolean;
  lastError: string;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useJobStream({
  apiBase,
  jobID,
  enabled = true,
  initialSinceID = 0,
  onEnvelope,
  onFallbackPoll,
  fallbackIntervalMs = 2800,
}: UseJobStreamOptions): UseJobStreamState {
  const [mode, setMode] = useState<JobStreamMode>("idle");
  const [lastError, setLastError] = useState("");

  const onEnvelopeRef = useRef(onEnvelope);
  const onFallbackPollRef = useRef(onFallbackPoll);
  const lastSinceIDRef = useRef(Math.max(0, Math.trunc(Number(initialSinceID || 0))));

  useEffect(() => {
    onEnvelopeRef.current = onEnvelope;
  }, [onEnvelope]);

  useEffect(() => {
    onFallbackPollRef.current = onFallbackPoll;
  }, [onFallbackPoll]);

  useEffect(() => {
    lastSinceIDRef.current = Math.max(0, Math.trunc(Number(initialSinceID || 0)));
  }, [initialSinceID, jobID]);

  useEffect(() => {
    if (!enabled || !jobID) {
      setMode("idle");
      setLastError("");
      return;
    }

    let stopped = false;
    let activeAbortController: AbortController | null = null;
    let fallbackTimer: number | null = null;
    let reconnectDelayMs = 1200;
    let failedAttempts = 0;

    const stopFallback = () => {
      if (fallbackTimer) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const startFallback = () => {
      if (stopped || fallbackTimer) return;
      setMode("fallback");
      const runFallbackPoll = () => {
        const fn = onFallbackPollRef.current;
        if (typeof fn === "function") {
          void Promise.resolve(fn());
        }
      };
      runFallbackPoll();
      fallbackTimer = window.setInterval(runFallbackPoll, Math.max(1200, fallbackIntervalMs));
    };

    const dispatchEnvelope = (envelope: JobStreamEnvelope, eventName: string) => {
      const nextSinceID = Number(envelope.next_since_id || envelope.event?.id || 0);
      if (Number.isFinite(nextSinceID) && nextSinceID > lastSinceIDRef.current) {
        lastSinceIDRef.current = Math.trunc(nextSinceID);
      }
      const cb = onEnvelopeRef.current;
      if (typeof cb === "function") {
        cb(envelope, eventName);
      }
    };

    const parseSSEBlock = (block: string) => {
      const normalized = block.replace(/\r/g, "");
      const lines = normalized.split("\n");
      let eventName = "message";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (!line) continue;
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim() || "message";
          continue;
        }
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (!dataLines.length) return;
      const dataText = dataLines.join("\n").trim();
      if (!dataText || dataText === "[DONE]") return;
      try {
        const payload = JSON.parse(dataText) as JobStreamEnvelope;
        dispatchEnvelope(payload, eventName);
      } catch {
        // ignore invalid frame, keep stream alive
      }
    };

    const run = async () => {
      while (!stopped) {
        try {
          setMode((prev) => (prev === "fallback" ? prev : "connecting"));
          activeAbortController = new AbortController();

          const params = new URLSearchParams();
          if (lastSinceIDRef.current > 0) {
            params.set("since_id", String(lastSinceIDRef.current));
          }
          params.set("heartbeat_sec", "15");
          const url = `${apiBase}/video-jobs/${jobID}/stream?${params.toString()}`;

          const res = await fetchWithAuthRetry(url, {
            method: "GET",
            headers: {
              Accept: "text/event-stream",
              "Cache-Control": "no-cache",
            },
            signal: activeAbortController.signal,
          });

          if (!res.ok) {
            throw new Error(`stream http ${res.status}`);
          }
          if (!res.body) {
            throw new Error("stream body unavailable");
          }

          failedAttempts = 0;
          reconnectDelayMs = 1200;
          setLastError("");
          stopFallback();
          setMode("streaming");

          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (!stopped) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.indexOf("\n\n");
            while (boundary >= 0) {
              const block = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              parseSSEBlock(block);
              boundary = buffer.indexOf("\n\n");
            }
          }
          if (stopped) return;
          throw new Error("stream closed");
        } catch (err: unknown) {
          if (stopped) return;
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          failedAttempts += 1;
          const message = err instanceof Error ? err.message : "stream error";
          setLastError(message);
          if (failedAttempts >= 2) {
            startFallback();
          }
          await sleep(reconnectDelayMs);
          reconnectDelayMs = Math.min(Math.floor(reconnectDelayMs * 1.8), 8000);
        } finally {
          activeAbortController = null;
        }
      }
    };

    void run();

    return () => {
      stopped = true;
      if (activeAbortController) {
        activeAbortController.abort();
      }
      stopFallback();
      setMode("idle");
    };
  }, [apiBase, enabled, fallbackIntervalMs, jobID]);

  return {
    mode,
    isStreaming: mode === "streaming",
    isFallback: mode === "fallback",
    lastError,
  };
}

