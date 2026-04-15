"use client";

import { useMemo, useState } from "react";
import { buildImageCandidates } from "@/lib/image-candidates";
import type { WorkbenchJobItem } from "./types";

type TaskExplorerProps = {
  className?: string;
  jobs: WorkbenchJobItem[];
  activeJobID: number | null;
  loadingJobs: boolean;
  statusLabelMap: Record<string, string>;
  onSelectJob: (jobID: number) => void;
  onCreateNew: () => void;
  resolveRequestedFormats: (job: WorkbenchJobItem) => string[];
  resolvePipelineModeLabel: (job: WorkbenchJobItem) => string;
  resolvePreviewURL: (job: WorkbenchJobItem) => string;
  formatTime: (value?: string | number) => string;
};

function TaskPreviewThumb({
  url,
  alt,
  fallbackText,
}: {
  url: string;
  alt: string;
  fallbackText: string;
}) {
  const candidates = useMemo(() => buildImageCandidates((url || "").trim(), { preferProxy: true }), [url]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[candidateIndex] || "";

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-[10px] font-bold text-slate-400">
        {fallbackText}
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        onError={() => setCandidateIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev))}
      />
    </>
  );
}

export function TaskExplorer({
  className,
  jobs,
  activeJobID,
  loadingJobs,
  statusLabelMap,
  onSelectJob,
  onCreateNew,
  resolveRequestedFormats,
  resolvePipelineModeLabel,
  resolvePreviewURL,
  formatTime,
}: TaskExplorerProps) {
  const todayLabel = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <aside
      className={[
        "flex h-full w-full xl:w-72 shrink-0 flex-col border-r border-slate-200 bg-white",
        className || "",
      ].join(" ")}
    >
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-5 backdrop-blur-md">
        <div className="flex items-center gap-2 text-base font-bold text-slate-800">
          <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          任务列表
        </div>
      </header>
      <div className="border-b border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={onCreateNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-[0.98]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新建创作任务
        </button>
      </div>
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-[11px] font-medium text-slate-500">
        <span>今日任务 {jobs.length} · {todayLabel}</span>
        {loadingJobs ? (
          <span className="flex items-center gap-1 text-emerald-600">
            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            同步中...
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 py-3">
        {loadingJobs ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`task-skeleton-${idx}`}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
              >
                <div className="h-[52px] w-[52px] animate-pulse bg-slate-200" />
                <div className="flex-1 space-y-2 py-0.5">
                  <div className="h-3.5 w-2/3 animate-pulse bg-slate-200" />
                  <div className="h-2.5 w-1/2 animate-pulse bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-slate-400">
            <svg className="mb-2 h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <span className="text-xs font-medium">今日暂无任务</span>
          </div>
        ) : (
          jobs.map((job) => {
            const active = job.id === activeJobID;
            const preview = (resolvePreviewURL(job) || "").trim();
            const status = (job.status || "").trim().toLowerCase();
            const formatText = (resolveRequestedFormats(job)[0] || "png").toUpperCase();
            const modeLabel = (resolvePipelineModeLabel(job) || "").trim();
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => onSelectJob(job.id)}
                className={`group relative flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all duration-200 ${
                  active
                    ? "bg-emerald-50/60 shadow-sm ring-1 ring-emerald-200"
                    : "bg-transparent hover:bg-slate-50 hover:shadow-sm"
                }`}
              >
                <div className={`relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg border shadow-sm transition-colors ${
                  active ? "border-emerald-200" : "border-slate-200"
                }`}>
                  <TaskPreviewThumb url={preview} alt={`task-${job.id}`} fallbackText={formatText} />
                  {status === "running" && (
                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-slate-200/80 backdrop-blur-sm">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, Number(job.progress || 0)))}%` }} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <div className={`truncate text-sm font-bold ${active ? "text-emerald-900" : "text-slate-700 group-hover:text-slate-900"}`}>
                    {(job.title || `任务 #${job.id}`).trim() || `任务 #${job.id}`}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                      status === "done" ? "bg-emerald-100 text-emerald-700" :
                      status === "failed" || status === "cancelled" ? "bg-rose-100 text-rose-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {statusLabelMap[status] || job.status}
                    </span>
                    {modeLabel ? (
                      <span className="inline-flex items-center rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-sky-700">
                        {modeLabel}
                      </span>
                    ) : null}
                    <span className="text-[10px] font-medium text-slate-400">{formatTime(job.updated_at || job.created_at)}</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
