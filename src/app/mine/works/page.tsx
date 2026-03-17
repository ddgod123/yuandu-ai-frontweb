"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE, clearAuthSession, fetchWithAuthRetry } from "@/lib/auth-client";
import { requestDownloadLink, triggerURLDownload } from "@/lib/download-client";
import { parseQualityTemplateSuggestionFromOptions } from "@/lib/video-quality-template";

type VideoJobItem = {
  id: number;
  title?: string;
  status?: string;
  stage?: string;
  progress?: number;
  result_collection_id?: number;
  created_at?: string;
  updated_at?: string;
  options?: Record<string, unknown>;
  result_summary?: VideoJobResultSummary;
};

type VideoJobListResponse = {
  items?: VideoJobItem[];
};

type VideoJobResultSummary = {
  collection_id?: number;
  collection_title?: string;
  file_count?: number;
  preview_images?: string[];
  format_summary?: string[];
  package_status?: string;
  quality_sample_count?: number;
  quality_top_score?: number;
  quality_avg_score?: number;
  quality_avg_loop_closure?: number;
};

type WorkCard = {
  jobID: number;
  title: string;
  createdAt: string;
  collectionID: number;
  fileCount: number;
  previewImages: string[];
  formatSummary: string[];
  packageStatus: "ready" | "processing" | "failed";
  qualitySampleCount: number;
  qualityTopScore: number;
  qualityAvgScore: number;
  qualityAvgLoopClosure: number;
  qualityTemplateSummary: string;
  qualityTemplateApplied: boolean;
};

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;

function isImageFile(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return IMAGE_EXT_REGEX.test(clean);
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

function buildStorageProxyCandidate(rawUrl: string) {
  const key = extractObjectKey(rawUrl);
  if (!key || !key.startsWith("emoji/")) return "";
  return `${API_BASE}/storage/proxy?key=${encodeURIComponent(key)}`;
}

function buildImageCandidates(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];

  const proxyCandidate = buildStorageProxyCandidate(trimmed);
  if (!isImageFile(trimmed) && !proxyCandidate) return [];

  const candidates: string[] = [];
  const isProxyURL = (value: string) => value.includes("/api/storage/proxy?");
  const add = (value: string) => {
    if (!value) return;
    if (!isProxyURL(value) && !isImageFile(value)) return;
    if (!candidates.includes(value)) candidates.push(value);
  };

  // 开发阶段默认优先走后端 storage proxy，避免依赖未备案/冻结域名。
  add(proxyCandidate);

  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  const preferHttps = protocol === "https:";

  if (trimmed.startsWith("//")) {
    const httpsURL = `https:${trimmed}`;
    const httpURL = `http:${trimmed}`;
    if (preferHttps) {
      add(httpsURL);
      add(httpURL);
    } else {
      add(httpURL);
      add(httpsURL);
    }
    add(proxyCandidate);
    return candidates;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const httpsURL = trimmed.replace(/^http:\/\//i, "https://");
    const httpURL = trimmed.replace(/^https:\/\//i, "http://");
    if (preferHttps) {
      add(httpsURL);
      add(httpURL);
    } else {
      add(httpURL);
      add(httpsURL);
    }
    add(proxyCandidate);
    return candidates;
  }

  if (trimmed.startsWith("/")) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    add(origin ? `${origin}${trimmed}` : trimmed);
    add(proxyCandidate);
    return candidates;
  }

  const hostCandidate = trimmed.split("/")[0];
  if (hostCandidate.includes(".") || hostCandidate.includes(":")) {
    if (preferHttps) {
      add(`https://${trimmed}`);
      add(`http://${trimmed}`);
    } else {
      add(`http://${trimmed}`);
      add(`https://${trimmed}`);
    }
    add(proxyCandidate);
    return candidates;
  }

  add(trimmed);
  add(proxyCandidate);
  return candidates;
}

function formatTime(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("zh-CN");
}

function parseTimestamp(value?: string) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function createFallbackCard(job: VideoJobItem): WorkCard {
  const jobID = Number(job.id || 0);
  return {
    jobID,
    title: (job.title || "未命名作品").trim() || "未命名作品",
    createdAt: job.created_at || "",
    collectionID: Number(job.result_collection_id || 0),
    fileCount: 0,
    previewImages: [],
    formatSummary: [],
    packageStatus: "processing",
    qualitySampleCount: 0,
    qualityTopScore: 0,
    qualityAvgScore: 0,
    qualityAvgLoopClosure: 0,
    qualityTemplateSummary: "",
    qualityTemplateApplied: false,
  };
}

function normalizePackageStatus(raw?: string): "ready" | "processing" | "failed" {
  const value = (raw || "").trim().toLowerCase();
  if (value === "ready") return "ready";
  if (value === "failed") return "failed";
  if (value === "pending" || value === "processing") return "processing";
  return "processing";
}

function buildWorkCard(job: VideoJobItem): WorkCard {
  const fallback = createFallbackCard(job);
  const summary = job.result_summary;
  const suggestion = parseQualityTemplateSuggestionFromOptions(job.options || {});
  if (!summary) {
    return {
      ...fallback,
      qualityTemplateSummary: suggestion?.summary || "",
      qualityTemplateApplied: Boolean(suggestion?.applied),
    };
  }

  const previewImages = (Array.isArray(summary.preview_images) ? summary.preview_images : [])
    .map((item) => (item || "").trim())
    .filter(Boolean)
    .slice(0, 15);
  const formatSummary = (Array.isArray(summary.format_summary) ? summary.format_summary : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const fileCount = Number(summary.file_count || 0);

  return {
    jobID: fallback.jobID,
    title: (summary.collection_title || fallback.title || "未命名作品").trim() || "未命名作品",
    createdAt: fallback.createdAt,
    collectionID: Number(summary.collection_id || fallback.collectionID || 0),
    fileCount: fileCount > 0 ? fileCount : previewImages.length,
    previewImages,
    formatSummary,
    packageStatus: normalizePackageStatus(summary.package_status),
    qualitySampleCount: Math.max(0, Number(summary.quality_sample_count || 0)),
    qualityTopScore: Number(summary.quality_top_score || 0),
    qualityAvgScore: Number(summary.quality_avg_score || 0),
    qualityAvgLoopClosure: Number(summary.quality_avg_loop_closure || 0),
    qualityTemplateSummary: suggestion?.summary || "",
    qualityTemplateApplied: Boolean(suggestion?.applied),
  };
}

function formatScore(value: number, digits = 3) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

async function parseApiErrorMessage(response: Response, fallback: string) {
  const text = (await response.text()).trim();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.message || parsed.error || fallback;
  } catch {
    return text;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function PreviewGrid({ images }: { images: string[] }) {
  const maxCount = 15;
  const filled = [...images.slice(0, maxCount)];
  while (filled.length < maxCount) {
    filled.push("");
  }

  return (
    <div className="grid grid-cols-5 gap-1.5 rounded-2xl bg-slate-50 p-2">
      {filled.map((url, idx) => (
        <div key={`${url}-${idx}`} className="relative aspect-square overflow-hidden rounded-lg bg-white">
          {url ? <FallbackImage url={url} alt={`preview-${idx}`} /> : null}
        </div>
      ))}
    </div>
  );
}

function FallbackImage({ url, alt }: { url: string; alt: string }) {
  const candidates = useMemo(() => buildImageCandidates(url), [url]);
  const [index, setIndex] = useState(0);

  const src = candidates[index];
  if (!src) {
    return <div className="h-full w-full bg-slate-50" />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      className="object-cover"
      onError={() => {
        setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
      }}
    />
  );
}

export default function MineWorksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<WorkCard[]>([]);
  const [selectedJobIDs, setSelectedJobIDs] = useState<number[]>([]);
  const [batchHint, setBatchHint] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDownloading, setBatchDownloading] = useState(false);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBatchHint(null);
    try {
      const jobsRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs?limit=80&include_result_summary=1`);
      if (jobsRes.status === 401) {
        clearAuthSession();
        router.replace(`/login?next=${encodeURIComponent("/mine/works")}`);
        return;
      }
      if (!jobsRes.ok) {
        throw new Error((await jobsRes.text()) || "加载作品失败");
      }

      const payload = (await jobsRes.json()) as VideoJobListResponse;
      const doneJobs = (Array.isArray(payload.items) ? payload.items : [])
        .filter((item) => item.status === "done" && Number(item.result_collection_id || 0) > 0)
        .sort((a, b) => parseTimestamp(b.updated_at || b.created_at) - parseTimestamp(a.updated_at || a.created_at));

      if (!doneJobs.length) {
        setCards([]);
        return;
      }

      const nextCards = doneJobs.map((job) => buildWorkCard(job));
      setCards(nextCards);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "加载作品失败";
      setError(message);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  useEffect(() => {
    const exists = new Set(cards.map((item) => item.jobID));
    setSelectedJobIDs((prev) => prev.filter((id) => exists.has(id)));
  }, [cards]);

  const total = useMemo(() => cards.length, [cards.length]);
  const selectedCount = selectedJobIDs.length;
  const allSelected = total > 0 && selectedCount === total;
  const selectedCards = useMemo(() => {
    if (!selectedJobIDs.length) return [];
    const selectedSet = new Set(selectedJobIDs);
    return cards.filter((card) => selectedSet.has(card.jobID));
  }, [cards, selectedJobIDs]);

  const toggleJobSelection = useCallback((jobID: number) => {
    setSelectedJobIDs((prev) => {
      if (prev.includes(jobID)) {
        return prev.filter((item) => item !== jobID);
      }
      return [...prev, jobID];
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedJobIDs((prev) => {
      if (cards.length === 0) return [];
      if (prev.length === cards.length) return [];
      return cards.map((item) => item.jobID);
    });
  }, [cards]);

  const handleBatchDownload = useCallback(async () => {
    if (!selectedCards.length || batchDownloading) return;
    setBatchHint(null);
    setBatchDownloading(true);
    let successCount = 0;
    const failed: string[] = [];
    for (const card of selectedCards) {
      const endpoint = `${API_BASE}/video-jobs/${card.jobID}/download-zip`;
      const result = await requestDownloadLink(endpoint);
      if (!result.ok) {
        failed.push(`#${card.jobID}`);
        continue;
      }
      triggerURLDownload(result.data.url, result.data.name || `${card.title || `job-${card.jobID}`}.zip`);
      successCount += 1;
      await sleep(220);
    }
    if (failed.length) {
      setBatchHint(`批量下载完成：成功 ${successCount}，失败 ${failed.length}（${failed.slice(0, 5).join("、")}）`);
    } else {
      setBatchHint(`批量下载已触发，共 ${successCount} 个合集。`);
    }
    setBatchDownloading(false);
  }, [batchDownloading, selectedCards]);

  const handleBatchDelete = useCallback(async () => {
    if (!selectedCards.length || batchDeleting) return;
    const confirmed = window.confirm(`确认删除已选 ${selectedCards.length} 个合集？该操作不可恢复。`);
    if (!confirmed) return;

    setBatchHint(null);
    setBatchDeleting(true);

    let successCount = 0;
    const failed: string[] = [];
    const succeededJobIDs: number[] = [];
    for (const card of selectedCards) {
      const res = await fetchWithAuthRetry(`${API_BASE}/video-jobs/${card.jobID}/delete-collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm_name: card.title,
          reason: "user_batch_delete",
        }),
      });
      if (!res.ok) {
        const message = await parseApiErrorMessage(res, "删除失败");
        failed.push(`#${card.jobID}(${message})`);
        continue;
      }
      successCount += 1;
      succeededJobIDs.push(card.jobID);
    }

    setBatchDeleting(false);

    if (succeededJobIDs.length) {
      setSelectedJobIDs((prev) => prev.filter((id) => !succeededJobIDs.includes(id)));
      await loadWorks();
    }

    if (failed.length) {
      setBatchHint(`批量删除完成：成功 ${successCount}，失败 ${failed.length}（${failed.slice(0, 3).join("；")}）`);
    } else {
      setBatchHint(`批量删除完成，共删除 ${successCount} 个合集。`);
    }
  }, [batchDeleting, loadWorks, selectedCards]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">我的作品</h1>
            <p className="mt-1 text-sm text-slate-500">展示你通过视频生成的个人作品合集，支持查看大图、单张下载和 ZIP 下载。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadWorks()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {loading ? "刷新中..." : "刷新"}
            </button>
            <Link href="/create" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              去创作
            </Link>
          </div>
        </div>
        <div className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {total} 个结果
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={total === 0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 disabled:opacity-60"
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
          <span className="font-semibold">已选 {selectedCount} / {total}</span>
          <button
            type="button"
            onClick={() => void handleBatchDownload()}
            disabled={selectedCount === 0 || batchDownloading || batchDeleting}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 font-semibold text-indigo-700 disabled:opacity-60"
          >
            {batchDownloading ? "批量下载中..." : "批量下载 ZIP"}
          </button>
          <button
            type="button"
            onClick={() => void handleBatchDelete()}
            disabled={selectedCount === 0 || batchDeleting || batchDownloading}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 disabled:opacity-60"
          >
            {batchDeleting ? "批量删除中..." : "批量删除合集"}
          </button>
        </div>
        {batchHint ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">{batchHint}</div>
        ) : null}
        <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs text-sky-700">
          说明：源视频在任务完成后会自动清理；作品文件与 ZIP 会持久化保存（除非你主动删除或命中过期清理）。
        </div>
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
        ) : null}
      </div>

      {loading && cards.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={`skeleton-${idx}`} className="animate-pulse rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="h-44 rounded-2xl bg-slate-100" />
              <div className="mt-4 h-6 w-2/3 rounded bg-slate-100" />
              <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && cards.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
          暂无作品，先去创作一个视频任务吧。
        </div>
      ) : null}

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((item) => {
            const selected = selectedJobIDs.includes(item.jobID);
            return (
            <Link
              key={item.jobID}
              href={`/mine/works/${item.jobID}`}
              className={`group relative overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${
                selected ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-100"
              }`}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleJobSelection(item.jobID);
                }}
                className={`absolute right-3 top-3 z-10 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  selected
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                {selected ? "已选" : "选择"}
              </button>
              <PreviewGrid images={item.previewImages} />
              <div className="mt-4 space-y-2">
                <div className="line-clamp-1 text-xl font-black text-slate-900 group-hover:text-emerald-600">{item.title}</div>
                <div className="text-xs text-slate-500">任务 #{item.jobID} · 合集 #{item.collectionID || "-"}</div>
                <div className="text-xs text-slate-400">{formatTime(item.createdAt)}</div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {item.fileCount} 个文件
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      item.packageStatus === "ready"
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : item.packageStatus === "failed"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {item.packageStatus === "ready" ? "ZIP 已就绪" : item.packageStatus === "failed" ? "ZIP 失败" : "ZIP 处理中"}
                  </span>
                </div>
                {item.formatSummary.length ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {item.formatSummary.slice(0, 3).map((line) => (
                      <span key={line} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                        {line}
                      </span>
                    ))}
                  </div>
                ) : null}
                {item.qualityTemplateSummary ? (
                  <div className="pt-1">
                    <span
                      className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] ${
                        item.qualityTemplateApplied
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      模板建议：{item.qualityTemplateSummary}
                    </span>
                  </div>
                ) : null}
                {item.qualitySampleCount > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                      Top {formatScore(item.qualityTopScore)}
                    </span>
                    <span className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
                      均值 {formatScore(item.qualityAvgScore)}
                    </span>
                    <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                      闭环 {formatScore(item.qualityAvgLoopClosure)}
                    </span>
                  </div>
                ) : null}
              </div>
            </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
