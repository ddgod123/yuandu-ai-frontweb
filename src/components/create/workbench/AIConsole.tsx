"use client";

import { useEffect, useRef } from "react";
import type { WorkbenchTimelineMessage } from "./types";

type AIConsoleProps = {
  className?: string;
  loadingJobs: boolean;
  globalError: string | null;
  cleanTimeline: WorkbenchTimelineMessage[];
  formatTime: (value?: string | number) => string;
  activeJobAwaitingAI1Confirm: boolean;
  confirmingContinue: boolean;
  onConfirmContinue: () => void;
  canCancelJob: boolean;
  onCancelJob: () => void;
};

export function AIConsole({
  className,
  loadingJobs,
  globalError,
  cleanTimeline,
  formatTime,
  activeJobAwaitingAI1Confirm,
  confirmingContinue,
  onConfirmContinue,
  canCancelJob,
  onCancelJob,
}: AIConsoleProps) {
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const lastMessageSignature =
    cleanTimeline.length > 0
      ? `${cleanTimeline[cleanTimeline.length - 1].id}:${cleanTimeline[cleanTimeline.length - 1].ts}:${cleanTimeline[cleanTimeline.length - 1].text}`
      : "empty";

  useEffect(() => {
    const node = timelineScrollRef.current;
    if (!node) return;
    const rafID = window.requestAnimationFrame(() => {
      node.scrollTo({ top: node.scrollHeight, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(rafID);
  }, [cleanTimeline.length, lastMessageSignature]);

  return (
    <aside
      className={[
        "flex h-full w-full xl:w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white",
        className || "",
      ].join(" ")}
    >
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-base font-bold text-slate-800">
          <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          智能交互控制台
        </div>
      </header>
      <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
        {globalError ? (
          <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
            {globalError}
          </div>
        ) : null}
        <p className="text-[11px] text-slate-500">当前面板按“理解 → 规划 → 复审”流程展示关键分析过程。</p>
      </div>

      <div ref={timelineScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/50 px-5 py-4">
        <div className="mb-4 flex items-center justify-center">
          <span className="rounded-full bg-slate-200/60 px-3 py-1 text-[10px] font-medium text-slate-500">
            任务交互流 ({cleanTimeline.length})
          </span>
        </div>
        <div className="space-y-5">
          {cleanTimeline.length ? (
            cleanTimeline.map((item) => {
              const isUser = item.role === "user";
              return (
                <div key={item.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[90%] gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm ${
                        isUser ? "bg-emerald-600 text-white" : "bg-slate-800 text-white"
                      }`}
                    >
                      {isUser ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`flex items-center gap-2 text-[10px] font-medium ${isUser ? "flex-row-reverse text-emerald-700" : "text-slate-500"}`}>
                        <span>{isUser ? "你" : item.name || "AI"}</span>
                        <span className="font-normal opacity-70">{formatTime(item.ts)}</span>
                      </div>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                          isUser
                            ? "rounded-tr-sm bg-emerald-600 text-white"
                            : item.level === "error"
                              ? "rounded-tl-sm border border-rose-200 bg-rose-50 text-rose-700"
                              : "rounded-tl-sm border border-slate-200 bg-white text-slate-800"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{item.text}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              {loadingJobs ? (
                <>
                  <div className="h-3 w-28 animate-pulse bg-slate-200" />
                  <div className="mt-2 h-3 w-40 animate-pulse bg-slate-100" />
                </>
              ) : (
                <>
                  <svg className="mb-3 h-10 w-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-xs">暂无交互消息</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          {activeJobAwaitingAI1Confirm ? (
            <button
              type="button"
              onClick={onConfirmContinue}
              disabled={confirmingContinue}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-60"
            >
              {confirmingContinue ? "确认中..." : "确认继续"}
            </button>
          ) : null}
          {canCancelJob ? (
            <button
              type="button"
              onClick={onCancelJob}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
            >
              中止任务
            </button>
          ) : null}
          {!activeJobAwaitingAI1Confirm && !canCancelJob ? (
            <span className="text-[11px] text-slate-400">当前任务暂无可执行动作</span>
          ) : null}
        </div>
        {canCancelJob ? (
          <div className="mt-2 text-[10px] text-rose-500">中止后将停止处理，本次任务不会产出可下载结果。</div>
        ) : null}
      </div>
    </aside>
  );
}
