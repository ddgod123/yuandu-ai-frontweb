"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { WorkbenchJobItem, WorkbenchResultEmojiItem } from "./types";

const PAGE_SIZE = 14;

type VisualCanvasProps = {
  className?: string;
  loadingJobs: boolean;
  activeJob: WorkbenchJobItem | null;
  activeJobID: number | null;
  stageLabelMap: Record<string, string>;
  statusLabelMap: Record<string, string>;
  streamMode: "streaming" | "fallback" | "connecting";
  activeResultEmojis: WorkbenchResultEmojiItem[];
  activePreviewIndex: number;
  onSelectPreview: (idx: number) => void;
  activeResultLoading: boolean;
  activeResultError: string;
  onRetryLoadResult: () => void;
  onDownloadOriginal: (item: WorkbenchResultEmojiItem) => void;
  downloadingOriginal: boolean;
  resolveResultImageURL: (item?: WorkbenchResultEmojiItem | null) => string;
  resolvePipelineModeLabel: (job: WorkbenchJobItem | null) => string;
};

function normalizeFormatLabel(value?: string) {
  const format = (value || "").trim().toLowerCase();
  if (!format) return "-";
  if (format === "jpeg") return "JPG";
  return format.toUpperCase();
}

function formatBytes(value?: number) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024) return `${Math.round(size)}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)}MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

export function VisualCanvas({
  className,
  loadingJobs,
  activeJob,
  activeJobID,
  stageLabelMap,
  statusLabelMap,
  streamMode,
  activeResultEmojis,
  activePreviewIndex,
  onSelectPreview,
  activeResultLoading,
  activeResultError,
  onRetryLoadResult,
  onDownloadOriginal,
  downloadingOriginal,
  resolveResultImageURL,
  resolvePipelineModeLabel,
}: VisualCanvasProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const safeIndex = useMemo(() => {
    if (!activeResultEmojis.length) return 0;
    return Math.max(0, Math.min(activePreviewIndex, activeResultEmojis.length - 1));
  }, [activePreviewIndex, activeResultEmojis.length]);

  const activePreviewItem = useMemo(() => activeResultEmojis[safeIndex] || null, [activeResultEmojis, safeIndex]);
  const pipelineModeLabel = useMemo(() => resolvePipelineModeLabel(activeJob), [activeJob, resolvePipelineModeLabel]);

  const canPrev = activeResultEmojis.length > 1 && safeIndex > 0;
  const canNext = activeResultEmojis.length > 1 && safeIndex < activeResultEmojis.length - 1;
  const activeStatus = (activeJob?.status || "").trim().toLowerCase();
  const showSyncBadge =
    Boolean(activeJobID) &&
    streamMode !== "connecting" &&
    activeStatus !== "done" &&
    activeStatus !== "failed" &&
    activeStatus !== "cancelled";

  const totalPages = useMemo(() => Math.ceil(activeResultEmojis.length / PAGE_SIZE), [activeResultEmojis.length]);
  const validPage = Math.max(0, Math.floor(safeIndex / PAGE_SIZE));
  const visibleItems = useMemo(() => {
    if (!activeResultEmojis.length) return [];
    return activeResultEmojis.slice(validPage * PAGE_SIZE, (validPage + 1) * PAGE_SIZE);
  }, [activeResultEmojis, validPage]);

  const formatCandidateScore = (raw?: number) => {
    if (typeof raw !== "number" || !Number.isFinite(raw)) return "";
    const score = raw <= 1 ? raw * 100 : raw;
    return `${Math.max(0, Math.min(100, Math.round(score)))}分`;
  };
  const previewMeta = useMemo(() => {
    if (!activePreviewItem) {
      return { format: "-", size: "-", dimension: "-", resolution: "-" };
    }
    const width = Number(activePreviewItem.width || 0);
    const height = Number(activePreviewItem.height || 0);
    const hasWH = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
    const mp = hasWH ? ((width * height) / 1_000_000).toFixed(2) : "-";
    return {
      format: normalizeFormatLabel(activePreviewItem.format),
      size: formatBytes(activePreviewItem.size_bytes),
      dimension: hasWH ? `${width}×${height}px` : "-",
      resolution: hasWH ? `${mp}MP` : "-",
    };
  }, [activePreviewItem]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
        return;
      }
      if (event.key === "ArrowLeft" && canPrev) {
        onSelectPreview(safeIndex - 1);
      }
      if (event.key === "ArrowRight" && canNext) {
        onSelectPreview(safeIndex + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canNext, canPrev, lightboxOpen, onSelectPreview, safeIndex]);

  return (
    <main className={["flex min-w-0 flex-1 flex-col bg-slate-50", className || ""].join(" ")}>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-5 backdrop-blur-md">
        <div className="min-w-0 flex items-center gap-3">
          <div className="truncate text-base font-bold text-slate-800">
            {activeJob ? (activeJob.title || `任务 #${activeJob.id}`) : "工作区"}
          </div>
          {activeJob && (
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                {stageLabelMap[(activeJob.stage || "").trim().toLowerCase()] || activeJob.stage || "-"}
              </span>
              {pipelineModeLabel ? (
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20">
                  {pipelineModeLabel}
                </span>
              ) : null}
              {showSyncBadge ? (
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  streamMode === "streaming" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-amber-50 text-amber-700 ring-amber-600/20"
                }`}>
                  {streamMode === "streaming" ? "实时同步" : "自动刷新"}
                </span>
              ) : null}
            </div>
          )}
        </div>
        {activeJob ? (
          <div className="flex items-center text-sm font-medium">
            <Link
              href={`/mine/works/${activeJob.id}`}
              className="text-slate-500 hover:text-slate-900 transition-colors"
            >
              查看详情
            </Link>
          </div>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 md:p-3 lg:p-4">
        {!activeJob && loadingJobs ? (
          <div className="flex h-full flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50/50">
            <div className="h-10 w-40 animate-pulse bg-slate-200" />
            <div className="mt-3 h-3 w-64 animate-pulse bg-slate-100" />
          </div>
        ) : !activeJob ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 transition-colors hover:bg-slate-50">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100/50 text-emerald-600 mb-6">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="text-xl font-bold text-slate-800">开始创作视觉资产</div>
            <div className="mt-3 max-w-md text-center text-sm leading-relaxed text-slate-500">
              请在左侧「新建创作任务」中上传视频并填写提示词，系统会自动提取并生成高质量图片。
            </div>
          </div>
        ) : (activeJob.status || "").trim().toLowerCase() === "done" ? (
          <div className="flex h-full flex-col gap-4">
            {activeResultLoading && !activeResultEmojis.length ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
                正在加载任务结果...
              </div>
            ) : activeResultError ? (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm text-rose-700">
                <div>{activeResultError}</div>
                <button
                  type="button"
                  onClick={onRetryLoadResult}
                  className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-1 text-xs text-rose-700 hover:bg-rose-100"
                >
                  重试加载
                </button>
              </div>
            ) : activeResultEmojis.length ? (
              <>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
                      <span>
                        结果预览 <span className="ml-1 bg-slate-200 px-2 py-0.5 text-xs">{safeIndex + 1} / {activeResultEmojis.length}</span>
                      </span>
                      <span className="text-xs font-normal text-slate-500">
                        格式 {previewMeta.format} · 尺寸 {previewMeta.dimension} · 分辨率 {previewMeta.resolution} · 大小 {previewMeta.size}
                      </span>
                    </div>
                    {activePreviewItem ? (
                      <button
                        type="button"
                        onClick={() => onDownloadOriginal(activePreviewItem)}
                        disabled={downloadingOriginal}
                        className="flex items-center gap-1.5 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {downloadingOriginal ? "下载中..." : "下载原图"}
                      </button>
                    ) : null}
                  </div>
                  <div className="group relative flex flex-1 items-center justify-center overflow-hidden bg-[url('https://cdn.tailwindcss.com/patterns/grid.svg')] bg-center p-6">
                    <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-[1px]"></div>
                    {activePreviewItem ? (
                      <>
                        <button
                          type="button"
                          className="relative z-20 cursor-zoom-in overflow-hidden bg-white shadow-xl ring-1 ring-slate-900/5"
                          onClick={() => setLightboxOpen(true)}
                          aria-label="放大预览"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolveResultImageURL(activePreviewItem)}
                            alt={activePreviewItem.title || `output-${activePreviewItem.id}`}
                            className="max-h-[60vh] w-auto max-w-full object-contain"
                          />
                        </button>
                      </>
                    ) : (
                      <div className="relative z-20 text-sm font-medium text-slate-400">暂无可预览图片</div>
                    )}
                  </div>
                </div>
                
                <div className="shrink-0 border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <div className="text-xs font-bold text-slate-700">
                      候选帧 <span className="ml-1 text-[10px] font-normal text-slate-400">共 {activeResultEmojis.length} 张</span>
                    </div>
                    {totalPages > 1 && (
                      <div className="text-[10px] font-medium text-slate-500">
                        第 {validPage + 1} / {totalPages} 页
                      </div>
                    )}
                  </div>
                  <div className="relative flex items-center group/filmstrip">
                    {totalPages > 1 && (
                      <button
                        type="button"
                        onClick={() => onSelectPreview(Math.max(0, (validPage - 1) * PAGE_SIZE))}
                        disabled={validPage === 0}
                        className="absolute left-0 z-10 -ml-2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur transition-all hover:bg-white hover:text-emerald-600 disabled:pointer-events-none disabled:opacity-0 opacity-0 group-hover/filmstrip:opacity-100"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}
                    
                    <div className="flex-1 overflow-hidden px-1">
                      <div className="flex gap-2 transition-transform duration-300">
                        {visibleItems.map((item, localIdx) => {
                          const globalIdx = validPage * PAGE_SIZE + localIdx;
                          const thumb = resolveResultImageURL(item);
                          const active = globalIdx === safeIndex;
                          return (
                            <button
                              key={`${item.id}-${globalIdx}`}
                              type="button"
                              onClick={() => onSelectPreview(globalIdx)}
                              className={`group relative h-[68px] w-[68px] shrink-0 overflow-hidden transition-all duration-200 ${
                                active ? "ring-2 ring-emerald-500 ring-offset-1" : "ring-1 ring-slate-200 hover:ring-slate-300"
                              }`}
                              title={item.title || `图片 ${globalIdx + 1}`}
                            >
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt={item.title || `thumb-${globalIdx + 1}`} className={`h-full w-full object-cover transition-transform duration-300 ${active ? "" : "group-hover:scale-110"}`} />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-slate-50 text-[10px] text-slate-400">
                                  无预览
                                </div>
                              )}
                              <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                                {globalIdx + 1}
                              </div>
                              {formatCandidateScore(item.output_score) ? (
                                <div className="absolute top-1 right-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                                  {formatCandidateScore(item.output_score)}
                                </div>
                              ) : null}
                              {active && <div className="absolute inset-0 bg-emerald-500/10"></div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {totalPages > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectPreview(Math.min(activeResultEmojis.length - 1, (validPage + 1) * PAGE_SIZE))
                        }
                        disabled={validPage >= totalPages - 1}
                        className="absolute right-0 z-10 -mr-2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur transition-all hover:bg-white hover:text-emerald-600 disabled:pointer-events-none disabled:opacity-0 opacity-0 group-hover/filmstrip:opacity-100"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-sm text-slate-500">
                <div>任务已完成，但当前未读取到图片结果。</div>
                <button
                  type="button"
                  onClick={onRetryLoadResult}
                  className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  重新加载结果
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-8 shadow-sm">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100 opacity-75"></div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
                <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
            <div className="mt-8 text-2xl font-bold text-slate-800">
              {statusLabelMap[(activeJob.status || "").trim().toLowerCase()] || activeJob.status || "处理中"}
            </div>
            <div className="mt-3 text-base font-medium text-emerald-600">
              {stageLabelMap[(activeJob.stage || "").trim().toLowerCase()] || activeJob.stage || "-"}
            </div>
            <div className="mt-8 w-full max-w-md">
              <div className="flex justify-between text-sm font-medium text-slate-600 mb-2">
                <span>整体进度</span>
                <span>{Math.max(0, Math.min(100, Number(activeJob.progress || 0)))}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(2, Math.min(100, Number(activeJob.progress || 0)))}%` }}
                />
              </div>
            </div>
            {activeJob.error_message ? (
              <div className="mt-8 max-w-lg rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
                <div className="font-bold mb-1">处理遇到问题</div>
                {activeJob.error_message}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {lightboxOpen && activePreviewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <button className="absolute inset-0" aria-label="关闭预览" onClick={() => setLightboxOpen(false)} />
          <div className="relative z-10 flex max-h-full max-w-[96vw] items-center gap-3">
            <button
              type="button"
              onClick={() => canPrev && onSelectPreview(safeIndex - 1)}
              disabled={!canPrev}
              className="rounded-full border border-white/30 bg-white/20 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
            <div className="relative max-h-[92vh] max-w-[86vw] overflow-hidden rounded-xl border border-white/20 bg-black/40 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveResultImageURL(activePreviewItem)}
                alt={activePreviewItem.title || `preview-${activePreviewItem.id}`}
                className="max-h-[88vh] w-auto max-w-[84vw] object-contain"
              />
              <div className="absolute bottom-2 left-2 rounded bg-black/55 px-2 py-1 text-[11px] text-white">
                {safeIndex + 1} / {activeResultEmojis.length}
              </div>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="absolute right-2 top-2 rounded-full border border-white/30 bg-black/50 px-2 py-0.5 text-xs text-white"
              >
                关闭
              </button>
            </div>
            <button
              type="button"
              onClick={() => canNext && onSelectPreview(safeIndex + 1)}
              disabled={!canNext}
              className="rounded-full border border-white/30 bg-white/20 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
