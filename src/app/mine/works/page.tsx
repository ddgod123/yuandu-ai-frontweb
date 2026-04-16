"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { API_BASE, clearAuthSession, fetchWithAuthRetry } from "@/lib/auth-client";
import { isStorageObjectKey } from "@/lib/storage-prefix";

import {
  RefreshCw,
  Trash2,
  CheckSquare,
  Square,
  Clock,
  Image as ImageIcon,
  HardDrive,
  Package,
  ChevronDown,
  Layers3,
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
  page?: number;
  limit?: number;
  total?: number;
  total_pages?: number;
  has_more?: boolean;
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
const PAGE_SIZE = 12;
const SUPPORTED_WORK_FORMATS = new Set(["gif", "png"]);

function normalizeFormatFilter(raw?: string | null) {
  const value = (raw || "").trim().toLowerCase();
  if (SUPPORTED_WORK_FORMATS.has(value)) return value;
  return "all";
}

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
  if (!isStorageObjectKey(key)) return "";
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
    // 直链失败再走 proxy 兜底，可减少后端 proxy 压力与首屏等待。
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
    // 直链失败再走 proxy 兜底，可减少后端 proxy 压力与首屏等待。
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
    // 直链失败再走 proxy 兜底，可减少后端 proxy 压力与首屏等待。
    add(proxyCandidate);
    return candidates;
  }

  if (isStorageObjectKey(trimmed)) {
    // 纯对象 key 必须走 proxy。
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

function PreviewGrid({ images, fileCount }: { images: string[]; fileCount: number }) {
  const hero = images[0] || "";
  const thumbs = images.slice(1, 4);
  while (thumbs.length < 3) {
    thumbs.push("");
  }
  const total = Math.max(fileCount || 0, images.length);

  return (
    <div className="flex flex-col gap-1">
      <div className="group/hero relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        {hero ? <FallbackImage url={hero} alt="preview-hero" /> : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-slate-300" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/50 px-2 py-1 text-[10px] font-bold tracking-wider text-white backdrop-blur-md transition-opacity group-hover/hero:bg-black/70">
          <Layers3 className="h-3 w-3" />
          {total} 张
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {thumbs.map((url, idx) => {
          const isLast = idx === 2;
          return (
            <div key={`${url}-${idx}`} className="group/thumb relative aspect-[16/11] w-full overflow-hidden bg-slate-50">
              {url ? (
                <>
                  <FallbackImage url={url} alt={`preview-thumb-${idx}`} />
                  {isLast && total > 4 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-colors group-hover/thumb:bg-black/50">
                      <span className="text-sm font-black text-white">+{total - 4}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-slate-200/70" />
                </div>
              )}
            </div>
          );
        })}
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryFormat = normalizeFormatFilter(searchParams.get("format"));
  const isPngPage = queryFormat === "png";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<WorkCard[]>([]);
  const [formatFilter, setFormatFilter] = useState(() => queryFormat);
  const [sortBy, setSortBy] = useState("time_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobIDs, setSelectedJobIDs] = useState<number[]>([]);
  const [batchHint, setBatchHint] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);

  useEffect(() => {
    if (formatFilter === queryFormat) return;
    setFormatFilter(queryFormat);
    setCurrentPage(1);
    setSelectedJobIDs([]);
  }, [formatFilter, queryFormat]);

  const handleFormatFilterChange = useCallback(
    (nextRawFormat: string) => {
      const nextFormat = normalizeFormatFilter(nextRawFormat);
      setFormatFilter(nextFormat);
      setCurrentPage(1);
      setSelectedJobIDs([]);

      const nextParams = new URLSearchParams(searchParams.toString());
      if (nextFormat === "all") {
        nextParams.delete("format");
      } else {
        nextParams.set("format", nextFormat);
      }
      nextParams.delete("page");

      const nextQuery = nextParams.toString();
      const nextURL = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(nextURL, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const loadWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBatchHint(null);
    try {
      const myWorksParams = new URLSearchParams();
      myWorksParams.set("page", String(currentPage));
      myWorksParams.set("limit", String(PAGE_SIZE));
      if ((formatFilter || "").trim() && formatFilter !== "all") {
        myWorksParams.set("format", formatFilter);
      }
      let jobsRes = await fetchWithAuthRetry(`${API_BASE}/my/works?${myWorksParams.toString()}`);
      let useLegacyEndpoint = false;
      if (jobsRes.status === 404 || jobsRes.status === 405) {
        useLegacyEndpoint = true;
        const fallbackLimit = Math.min(100, Math.max(PAGE_SIZE, PAGE_SIZE * currentPage));
        jobsRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs?limit=${fallbackLimit}&include_result_summary=1&status=done`);
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
      const sourceJobs = Array.isArray(payload.items) ? payload.items : [];
      const doneJobs = sourceJobs
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
        setTotalItems(0);
        setTotalPages(1);
        return;
      }

      const allCards = doneJobs.map((job) => buildWorkCard(job));

      if (useLegacyEndpoint) {
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageCards = allCards.slice(start, start + PAGE_SIZE);
        const nextTotalPages = Math.max(1, Math.ceil(allCards.length / PAGE_SIZE));
        if (currentPage > nextTotalPages) {
          setCurrentPage(nextTotalPages);
        }
        setCards(pageCards);
        setTotalItems(allCards.length);
        setTotalPages(nextTotalPages);
        return;
      }

      const apiTotal = Math.max(0, Number(payload.total || 0));
      const apiLimit = Math.max(1, Number(payload.limit || PAGE_SIZE));
      const apiTotalPages = Math.max(1, Number(payload.total_pages || Math.ceil(apiTotal / apiLimit) || 1));
      const apiPage = Math.max(1, Number(payload.page || currentPage));

      if (apiPage !== currentPage) {
        setCurrentPage(apiPage);
      }

      setCards(allCards);
      setTotalItems(apiTotal > 0 ? apiTotal : allCards.length);
      setTotalPages(apiTotalPages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "加载作品失败";
      setError(message);
      setCards([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, formatFilter, router]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  useEffect(() => {
    const exists = new Set(cards.map((item) => item.jobID));
    setSelectedJobIDs((prev) => prev.filter((id) => exists.has(id)));
  }, [cards]);

  const getCardTotalBytes = useCallback((item: WorkCard) => {
    const outputBytes = Math.max(0, Number(item.outputTotalSizeBytes || 0));
    const packageBytes = Math.max(0, Number(item.packageSizeBytes || 0));
    return outputBytes > 0 ? outputBytes : packageBytes;
  }, []);

  const sortedCards = useMemo(() => {
    const next = [...cards];
    next.sort((a, b) => {
      if (sortBy === "size_asc") return getCardTotalBytes(a) - getCardTotalBytes(b);
      if (sortBy === "size_desc") return getCardTotalBytes(b) - getCardTotalBytes(a);
      if (sortBy === "files_asc") return Math.max(0, a.fileCount || 0) - Math.max(0, b.fileCount || 0);
      if (sortBy === "files_desc") return Math.max(0, b.fileCount || 0) - Math.max(0, a.fileCount || 0);
      if (sortBy === "time_asc") return parseTimestamp(a.createdAt) - parseTimestamp(b.createdAt);
      return parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt);
    });
    return next;
  }, [cards, getCardTotalBytes, sortBy]);

  const visibleTotal = useMemo(() => sortedCards.length, [sortedCards.length]);
  const selectedCount = selectedJobIDs.length;
  const selectedCards = useMemo(() => {
    if (!selectedJobIDs.length) return [];
    const selectedSet = new Set(selectedJobIDs);
    return sortedCards.filter((card) => selectedSet.has(card.jobID));
  }, [sortedCards, selectedJobIDs]);
  const totalFiles = useMemo(() => sortedCards.reduce((acc, item) => acc + Math.max(0, item.fileCount || 0), 0), [sortedCards]);
  const totalSizeBytes = useMemo(() => sortedCards.reduce((acc, item) => acc + getCardTotalBytes(item), 0), [getCardTotalBytes, sortedCards]);
  const canGoPrevPage = currentPage > 1;
  const canGoNextPage = currentPage < totalPages;

  const toggleJobSelection = useCallback((jobID: number) => {
    setSelectedJobIDs((prev) => {
      if (prev.includes(jobID)) {
        return prev.filter((item) => item !== jobID);
      }
      return [...prev, jobID];
    });
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedJobIDs([]);
      }
      return !prev;
    });
  }, []);

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
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100/50 text-emerald-600">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">我的作品</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">按合集展示视频转图片结果，支持预览、下载与管理。</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => void loadWorks()}
          className="flex w-fit items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-emerald-600 transition-all active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-emerald-500" : ""}`} />
          {loading ? "刷新中" : "刷新列表"}
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-inset ring-slate-200/60 md:flex-row md:items-center md:justify-between">
        <div className="flex divide-x divide-slate-200/60 text-sm">
          <div className="px-5 first:pl-3 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">合集总数</span>
            <span className="text-base font-black text-slate-800">{totalItems}</span>
          </div>
          <div className="px-5 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">文件总数</span>
            <span className="text-base font-black text-slate-800">{totalFiles}</span>
          </div>
          {!isPngPage ? (
            <div className="px-5 pr-3 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">占用容量</span>
              <span className="text-base font-black text-slate-800">{formatBytes(totalSizeBytes)}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isPngPage ? (
            <div className="relative">
              <select
                value={formatFilter}
                onChange={(event) => {
                  handleFormatFilterChange(event.target.value);
                }}
                className="appearance-none rounded-xl bg-slate-50/80 pl-4 pr-10 py-2 text-sm font-semibold text-slate-700 outline-none ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-all"
              >
                <option value="all">全部格式</option>
                <option value="gif">GIF</option>
                <option value="png">PNG</option>
                <option value="jpg" disabled>JPG（待开发）</option>
                <option value="webp" disabled>WEBP（待开发）</option>
                <option value="live" disabled>LIVE（待开发）</option>
                <option value="mp4" disabled>MP4（待开发）</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          ) : null}

          <div className="relative">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="appearance-none rounded-xl bg-slate-50/80 pl-4 pr-10 py-2 text-sm font-semibold text-slate-700 outline-none ring-1 ring-inset ring-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-all"
            >
              <option value="time_desc">时间（最新优先）</option>
              <option value="time_asc">时间（最早优先）</option>
              <option value="size_asc">容量：从小到大</option>
              <option value="size_desc">容量：从大到小</option>
              <option value="files_asc">文件数：从小到大</option>
              <option value="files_desc">文件数：从大到小</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <button
            type="button"
            onClick={toggleSelectionMode}
            disabled={visibleTotal === 0}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              selectionMode ? "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-400" />}
            {selectionMode ? "退出批量" : "批量操作"}
          </button>

          {selectionMode ? (
            <>
              <span className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-600 ring-1 ring-inset ring-emerald-100">已选 {selectedCount}</span>
              <button
                type="button"
                onClick={() => void handleBatchDelete()}
                disabled={batchDeleting || selectedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <Trash2 className="h-4 w-4" /> {batchDeleting ? "删除中" : "批量删除"}
              </button>
            </>
          ) : null}
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
            <div key={`skeleton-${idx}`} className="animate-pulse flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-col gap-1">
                <div className="aspect-[16/10] w-full bg-slate-100" />
                <div className="grid grid-cols-3 gap-1">
                  <div className="aspect-[16/11] bg-slate-100" />
                  <div className="aspect-[16/11] bg-slate-100" />
                  <div className="aspect-[16/11] bg-slate-100" />
                </div>
              </div>
              <div className="px-5 pb-5 pt-4 space-y-4">
                <div className="h-5 w-2/3 rounded-md bg-slate-100" />
                <div className="grid grid-cols-2 gap-3">
                   <div className="h-4 w-full rounded bg-slate-100" />
                   <div className="h-4 w-full rounded bg-slate-100" />
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

      {sortedCards.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedCards.map((item) => {
            const selected = selectedJobIDs.includes(item.jobID);
            const mainFormat = formatBadgeLabel(item.requestedFormat || "");
            const totalBytes = getCardTotalBytes(item);
            return (
              <Link
                key={item.jobID}
                href={`/mine/works/${item.jobID}`}
                className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-inset transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-900/5 ${
                  selectionMode && selected ? "ring-2 ring-emerald-500" : "ring-slate-200/60 hover:ring-emerald-200"
                }`}
                onClick={(event) => {
                  if (!selectionMode) return;
                  event.preventDefault();
                  toggleJobSelection(item.jobID);
                }}
              >
                {selectionMode ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleJobSelection(item.jobID);
                    }}
                    className={`absolute right-4 top-4 z-10 rounded-full p-1.5 transition-all ${
                      selected
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-white/90 text-slate-400 backdrop-blur hover:bg-white hover:text-slate-600 shadow-sm ring-1 ring-inset ring-slate-200/50"
                    }`}
                  >
                    {selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                  </button>
                ) : null}

                <PreviewGrid images={item.previewImages} fileCount={item.fileCount} />

                <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-1 text-base font-bold text-slate-800 group-hover:text-emerald-600 transition-colors" title={item.title}>{item.title}</h3>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-slate-600 uppercase">
                      {mainFormat}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-y-3 gap-x-3 text-xs font-medium text-slate-500 bg-slate-50/50 p-2.5 rounded-xl">
                    <div className="flex items-center gap-2" title="生成时间">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{formatTime(item.createdAt).split(" ")[0]}</span>
                    </div>
                    <div className="flex items-center gap-2" title="文件数量">
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{item.fileCount} 个</span>
                    </div>
                    <div className="flex items-center gap-2" title="文件总大小">
                      <HardDrive className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{formatBytes(totalBytes)}</span>
                    </div>
                    <div className="flex items-center gap-2" title="ZIP 状态">
                      <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{packageStatusText(item.packageStatus)}</span>
                    </div>
                  </div>

                  {item.formatSummary.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 pt-1">
                      {item.formatSummary.slice(0, 3).map((line) => (
                        <span key={line} className="rounded-md bg-emerald-50/50 px-2 py-1 text-[10px] font-semibold text-emerald-600 border border-emerald-100/50">
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

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (!canGoPrevPage) return;
              setCurrentPage((prev) => Math.max(1, prev - 1));
            }}
            disabled={!canGoPrevPage || loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm font-semibold text-slate-600">
            第 {currentPage} / {totalPages} 页 · 共 {totalItems} 个合集
          </span>
          <button
            type="button"
            onClick={() => {
              if (!canGoNextPage) return;
              setCurrentPage((prev) => Math.min(totalPages, prev + 1));
            }}
            disabled={!canGoNextPage || loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      ) : null}
    </div>
  );
}
