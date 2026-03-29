"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE, clearAuthSession, fetchWithAuthRetry } from "@/lib/auth-client";
import { requestDownloadLink, triggerURLDownload } from "@/lib/download-client";

import {
  RefreshCw,
  Plus,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Clock,
  Image as ImageIcon,
  HardDrive,
  Package,
  ChevronDown,
} from "lucide-react";

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
  billing?: VideoJobBillingInfo;
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
  package_size_bytes?: number;
  output_total_size_bytes?: number;
  quality_sample_count?: number;
  quality_top_score?: number;
  quality_avg_score?: number;
  quality_avg_loop_closure?: number;
};

type VideoJobBillingInfo = {
  actual_cost_cny?: number;
  currency?: string;
  pricing_version?: string;
  charged_points?: number;
  reserved_points?: number;
  hold_status?: string;
  point_per_cny?: number;
  cost_markup_multiplier?: number;
};

type WorkCard = {
  jobID: number;
  title: string;
  createdAt: string;
  collectionID: number;
  requestedFormat: string;
  fileCount: number;
  previewImages: string[];
  formatSummary: string[];
  packageStatus: "ready" | "processing" | "failed";
  packageSizeBytes: number;
  outputTotalSizeBytes: number;
  actualCostCNY: number;
  chargedPoints: number;
  holdStatus: string;
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

  // 避免 SSR/CSR 首帧因 window 协议差异导致 hydration mismatch。
  const preferHttps = true;

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
    add(trimmed);
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
  const outputFormats = Array.isArray((job as { output_formats?: unknown }).output_formats)
    ? ((job as { output_formats?: unknown[] }).output_formats || []).map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const requestedFormat = outputFormats[0] || String(job.options?.requested_format || "").trim().toLowerCase();
  return {
    jobID,
    title: (job.title || "未命名作品").trim() || "未命名作品",
    createdAt: job.created_at || "",
    collectionID: Number(job.result_collection_id || 0),
    requestedFormat,
    fileCount: 0,
    previewImages: [],
    formatSummary: [],
    packageStatus: "processing",
    packageSizeBytes: 0,
    outputTotalSizeBytes: 0,
    actualCostCNY: Math.max(0, Number(job.billing?.actual_cost_cny || 0)),
    chargedPoints: Math.max(0, Number(job.billing?.charged_points || 0)),
    holdStatus: String(job.billing?.hold_status || "").trim(),
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
  if (!summary) {
    return fallback;
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
    requestedFormat: fallback.requestedFormat,
    fileCount: fileCount > 0 ? fileCount : previewImages.length,
    previewImages,
    formatSummary,
    packageStatus: normalizePackageStatus(summary.package_status),
    packageSizeBytes: Math.max(0, Number(summary.package_size_bytes || 0)),
    outputTotalSizeBytes: Math.max(0, Number(summary.output_total_size_bytes || 0)),
    actualCostCNY: fallback.actualCostCNY,
    chargedPoints: fallback.chargedPoints,
    holdStatus: fallback.holdStatus,
  };
}

function formatBytes(value?: number) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024) return `${Math.round(size)} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatCNY(value?: number) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return `¥${n.toFixed(4)}`;
}

function formatBadgeLabel(raw: string) {
  const value = (raw || "").trim().toLowerCase();
  if (!value) return "未标注";
  if (value === "jpeg") return "JPG";
  return value.toUpperCase();
}

function packageStatusText(status: "ready" | "processing" | "failed") {
  if (status === "ready") return "ZIP 已就绪";
  if (status === "failed") return "ZIP 生成失败";
  return "ZIP 处理中";
}

function holdStatusText(raw?: string) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "settled") return "已结算";
  if (value === "held") return "预冻结";
  if (value === "released") return "已释放";
  if (value === "cancelled") return "已取消";
  if (value === "failed") return "失败";
  return "-";
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
  const hero = images[0] || "";
  const thumbs = images.slice(1, 4);
  while (thumbs.length < 3) {
    thumbs.push("");
  }

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-slate-50/50">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-inset ring-slate-900/5">
        {hero ? <FallbackImage url={hero} alt="preview-hero" /> : null}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {thumbs.map((url, idx) => (
          <div key={`${url}-${idx}`} className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-900/5">
            {url ? <FallbackImage url={url} alt={`preview-thumb-${idx}`} /> : null}
          </div>
        ))}
      </div>
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
  const [formatFilter, setFormatFilter] = useState("all");
  const [selectedJobIDs, setSelectedJobIDs] = useState<number[]>([]);
  const [batchHint, setBatchHint] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDownloading, setBatchDownloading] = useState(false);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBatchHint(null);
    try {
      const myWorksParams = new URLSearchParams();
      myWorksParams.set("limit", "80");
      if ((formatFilter || "").trim() && formatFilter !== "all") {
        myWorksParams.set("format", formatFilter);
      }
      let jobsRes = await fetchWithAuthRetry(`${API_BASE}/my/works?${myWorksParams.toString()}`);
      if (jobsRes.status === 404 || jobsRes.status === 405) {
        jobsRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs?limit=80&include_result_summary=1&status=done`);
      }
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
        .filter((item) => {
          if (item.status !== "done") return false;
          const fileCount = Number(item.result_summary?.file_count || 0);
          if (fileCount <= 0) return false;
          const collectionID = Number(item.result_collection_id || item.result_summary?.collection_id || 0);
          return collectionID > 0;
        })
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
  }, [formatFilter, router]);

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
  const totalFiles = useMemo(() => cards.reduce((acc, item) => acc + Math.max(0, item.fileCount || 0), 0), [cards]);
  const totalSizeBytes = useMemo(
    () =>
      cards.reduce((acc, item) => {
        const outputBytes = Math.max(0, Number(item.outputTotalSizeBytes || 0));
        const packageBytes = Math.max(0, Number(item.packageSizeBytes || 0));
        return acc + (outputBytes > 0 ? outputBytes : packageBytes);
      }, 0),
    [cards]
  );

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
      <div className="flex flex-col gap-4 mb-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">我的作品</h1>
          <p className="mt-1 text-sm text-slate-500">按合集展示视频转图片结果，支持预览、下载 ZIP 与批量管理。</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadWorks()}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition-all"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            {loading ? "刷新中" : "刷新"}
          </button>
          <Link href="/create" className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-all">
            <Plus className="h-4 w-4" /> 去创作
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-inset ring-slate-100 md:flex-row md:items-center md:justify-between">
        <div className="flex divide-x divide-slate-100 text-sm">
          <div className="px-4 first:pl-2">
            <span className="text-slate-500">合集</span>
            <span className="ml-2 font-bold text-slate-900">{total}</span>
          </div>
          <div className="px-4">
            <span className="text-slate-500">文件</span>
            <span className="ml-2 font-bold text-slate-900">{totalFiles}</span>
          </div>
          <div className="px-4 pr-2">
            <span className="text-slate-500">容量</span>
            <span className="ml-2 font-bold text-slate-900">{formatBytes(totalSizeBytes)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={formatFilter}
              onChange={(event) => setFormatFilter(event.target.value)}
              className="appearance-none rounded-lg bg-slate-50 pl-3 pr-8 py-1.5 text-sm font-medium text-slate-700 outline-none ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">全部格式</option>
              <option value="gif">GIF</option>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
              <option value="webp">WEBP</option>
              <option value="live">LIVE</option>
              <option value="mp4">MP4</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="mx-1 h-4 w-px bg-slate-200" />

          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={total === 0}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {allSelected ? <CheckSquare className="h-4 w-4 text-emerald-500" /> : <Square className="h-4 w-4 text-slate-400" />}
            全选
          </button>

          {selectedCount > 0 && (
            <>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-600">已选 {selectedCount}</span>
              <button
                type="button"
                onClick={() => void handleBatchDownload()}
                disabled={batchDownloading || batchDeleting}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" /> {batchDownloading ? "下载中" : "批量下载"}
              </button>
              <button
                type="button"
                onClick={() => void handleBatchDelete()}
                disabled={batchDeleting || batchDownloading}
                className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" /> {batchDeleting ? "删除中" : "批量删除"}
              </button>
            </>
          )}
        </div>
      </div>

      {batchHint ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">{batchHint}</div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{error}</div>
      ) : null}

      {loading && cards.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={`skeleton-${idx}`} className="animate-pulse flex flex-col rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
              <div className="aspect-[16/10] w-full rounded-xl bg-slate-100" />
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <div className="aspect-square rounded-lg bg-slate-100" />
                <div className="aspect-square rounded-lg bg-slate-100" />
                <div className="aspect-square rounded-lg bg-slate-100" />
              </div>
              <div className="p-2 mt-2 space-y-3">
                <div className="h-5 w-2/3 rounded bg-slate-100" />
                <div className="grid grid-cols-2 gap-2">
                   <div className="h-4 w-full rounded bg-slate-100" />
                   <div className="h-4 w-full rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-24 text-center">
          <ImageIcon className="mb-4 h-12 w-12 text-slate-300" />
          <h3 className="text-lg font-bold text-slate-900">暂无作品</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm">您还没有生成过任何视频转图片的作品。快去创作您的第一个合集吧！</p>
          <Link href="/create" className="mt-6 flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-all">
            开始创作
          </Link>
        </div>
      ) : null}

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((item) => {
            const selected = selectedJobIDs.includes(item.jobID);
            const mainFormat = formatBadgeLabel(item.requestedFormat || "");
            const totalBytes = item.outputTotalSizeBytes > 0 ? item.outputTotalSizeBytes : item.packageSizeBytes;
            return (
              <Link
                key={item.jobID}
                href={`/mine/works/${item.jobID}`}
                className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-inset transition-all hover:-translate-y-1 hover:shadow-md ${
                  selected ? "ring-2 ring-emerald-500" : "ring-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleJobSelection(item.jobID);
                  }}
                  className={`absolute right-3 top-3 z-10 rounded-full p-1 transition-all ${
                    selected
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-white/80 text-slate-400 backdrop-blur hover:bg-white hover:text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200/50 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                </button>

                <PreviewGrid images={item.previewImages} />

                <div className="flex flex-1 flex-col p-4 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-1 text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors" title={item.title}>{item.title}</h3>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                      {mainFormat}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-y-2.5 gap-x-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5" title="生成时间">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{formatTime(item.createdAt).split(" ")[0]}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="文件数量">
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{item.fileCount} 个</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="文件总大小">
                      <HardDrive className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{formatBytes(totalBytes)}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="ZIP 状态">
                      <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{packageStatusText(item.packageStatus)}</span>
                    </div>
                  </div>

                  {item.actualCostCNY > 0 || item.chargedPoints > 0 || item.holdStatus ? (
                    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-2 text-[11px] text-indigo-700">
                      成本 {formatCNY(item.actualCostCNY)} · 扣点 {item.chargedPoints > 0 ? item.chargedPoints : 0} · {holdStatusText(item.holdStatus)}
                    </div>
                  ) : null}

                  {item.formatSummary.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 pt-3 border-t border-slate-100">
                      {item.formatSummary.slice(0, 3).map((line) => (
                        <span key={line} className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500 border border-slate-100">
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
