"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  clearAuthSession,
  ensureAuthSession,
  fetchWithAuthRetry,
} from "@/lib/auth-client";

type GPUAsset = {
  id: number;
  asset_role: "source" | "result" | string;
  object_key: string;
  object_url?: string;
  mime_type?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
};

type GPUJob = {
  id: number;
  title?: string;
  provider?: string;
  model?: string;
  scale?: number;
  status?: string;
  stage?: string;
  progress?: number;
  error_message?: string;
  source_object_key?: string;
  source_object_url?: string;
  result_object_key?: string;
  result_object_url?: string;
  created_at?: string;
  updated_at?: string;
  assets?: GPUAsset[];
};

type GPUJobListResponse = {
  items?: GPUJob[];
  page?: number;
  page_size?: number;
  total?: number;
  has_more?: boolean;
};

type BatchDeleteGPUJobsResponse = {
  ok?: boolean;
  deleted_ids?: number[];
  not_found_ids?: number[];
  failed_ids?: Record<string, string>;
};

const STATUS_TEXT: Record<string, string> = {
  queued: "排队中",
  running: "处理中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const PAGE_SIZE = 12;

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN");
}

function formatBytes(value?: number) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024) return `${Math.round(size)} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function pickPreview(job?: GPUJob | null) {
  if (!job) return "";
  if (job.result_object_url) return job.result_object_url;
  if (job.source_object_url) return job.source_object_url;
  const assets = Array.isArray(job.assets) ? job.assets : [];
  const resultURL = assets.find((item) => item.asset_role === "result")?.object_url;
  if (resultURL) return resultURL;
  return assets.find((item) => item.asset_role === "source")?.object_url || "";
}

function pickAsset(job: GPUJob, role: "source" | "result") {
  return (Array.isArray(job.assets) ? job.assets : []).find((item) => item.asset_role === role);
}

async function parseAPIError(response: Response, fallback: string) {
  const raw = (await response.text()).trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    return parsed.message || parsed.error || fallback;
  } catch {
    return raw;
  }
}

export default function GPUWorksPage() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<GPUJob[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [deletingID, setDeletingID] = useState<number | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const totalPages = useMemo(() => {
    if (!Number.isFinite(total) || total <= 0) return 1;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  const fetchJobs = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError("");
    try {
      const ok = await ensureAuthSession();
      if (!ok) {
        clearAuthSession();
        setIsAuthed(false);
        setJobs([]);
        return;
      }
      setIsAuthed(true);

      const res = await fetchWithAuthRetry(
        `${API_BASE}/gpu-tests/jobs?page=${targetPage}&page_size=${PAGE_SIZE}`
      );
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        setJobs([]);
        return;
      }
      if (!res.ok) {
        throw new Error(await parseAPIError(res, `读取作品失败（HTTP ${res.status}）`));
      }

      const data = (await res.json()) as GPUJobListResponse;
      setJobs(Array.isArray(data?.items) ? data.items : []);
      setPage(Number(data?.page || targetPage || 1));
      setTotal(Math.max(0, Number(data?.total || 0)));
      setHasMore(Boolean(data?.has_more));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "读取作品失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs(1);
  }, [fetchJobs]);

  useEffect(() => {
    setSelectedIDs((prev) => prev.filter((id) => jobs.some((job) => job.id === id)));
  }, [jobs]);

  const isSelected = useCallback((id: number) => selectedIDs.includes(id), [selectedIDs]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIDs((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  }, []);

  const handleDelete = useCallback(
    async (job: GPUJob) => {
      const title = (job.title || `任务 #${job.id}`).trim() || `任务 #${job.id}`;
      const confirmed = window.confirm(
        `确认删除“${title}”？\n\n将同时删除：\n1）该任务数据库记录\n2）该任务在七牛云的原图与增强图`
      );
      if (!confirmed) return;

      setDeletingID(job.id);
      setError("");
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/gpu-tests/jobs/${job.id}`, {
          method: "DELETE",
        });
        if (res.status === 401) {
          clearAuthSession();
          setIsAuthed(false);
          return;
        }
        if (!res.ok) {
          throw new Error(await parseAPIError(res, `删除失败（HTTP ${res.status}）`));
        }

        const nextTotal = Math.max(0, total - 1);
        const shouldBackPage = jobs.length <= 1 && page > 1;
        const nextPage = shouldBackPage ? page - 1 : page;
        setTotal(nextTotal);
        await fetchJobs(nextPage);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "删除失败");
      } finally {
        setDeletingID(null);
      }
    },
    [fetchJobs, jobs.length, page, total]
  );

  const handleBatchDelete = useCallback(async () => {
    if (selectedIDs.length === 0) return;
    const confirmed = window.confirm(
      `确认批量删除已选中的 ${selectedIDs.length} 个任务？\n\n将同时删除数据库记录和七牛云原图/增强图。`
    );
    if (!confirmed) return;

    setBatchDeleting(true);
    setError("");
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/gpu-tests/jobs/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIDs }),
      });
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        return;
      }
      if (!res.ok) {
        throw new Error(await parseAPIError(res, `批量删除失败（HTTP ${res.status}）`));
      }
      const data = (await res.json()) as BatchDeleteGPUJobsResponse;
      const deletedCount = Array.isArray(data.deleted_ids) ? data.deleted_ids.length : 0;
      const notFoundCount = Array.isArray(data.not_found_ids) ? data.not_found_ids.length : 0;
      const failedCount = data.failed_ids ? Object.keys(data.failed_ids).length : 0;

      if (failedCount > 0) {
        setError(`批量删除完成：成功 ${deletedCount}，不存在 ${notFoundCount}，失败 ${failedCount}`);
      }

      setSelectedIDs([]);
      const removedCount = deletedCount + notFoundCount;
      const shouldBackPage = jobs.length <= removedCount && page > 1;
      const nextPage = shouldBackPage ? page - 1 : page;
      await fetchJobs(nextPage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "批量删除失败");
    } finally {
      setBatchDeleting(false);
    }
  }, [fetchJobs, jobs.length, page, selectedIDs]);

  if (isAuthed === false) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          请先登录后查看 GPU 作品。
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GPU作品</h1>
          <p className="mt-1 text-sm text-slate-500">展示 GPU 图片增强任务的原图、增强图与任务状态。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/gpu-test"
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
          >
            去 GPU测试
          </Link>
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchJobs(page)}
            className={`rounded-lg px-3 py-2 text-sm ${
              loading ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {loading ? "刷新中..." : "刷新列表"}
          </button>
          <button
            type="button"
            disabled={batchDeleting}
            onClick={() => {
              setBatchMode((prev) => {
                const next = !prev;
                if (!next) setSelectedIDs([]);
                return next;
              });
            }}
            className={`rounded-lg px-3 py-2 text-sm ${
              batchDeleting
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : batchMode
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {batchMode ? "取消批量" : "批量操作"}
          </button>
          {batchMode ? (
            <button
              type="button"
              disabled={batchDeleting || selectedIDs.length === 0}
              onClick={() => void handleBatchDelete()}
              className={`rounded-lg px-3 py-2 text-sm ${
                batchDeleting || selectedIDs.length === 0
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {batchDeleting ? "批量删除中..." : `批量删除（${selectedIDs.length}）`}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-500">
          {loading ? "正在加载作品..." : "暂无 GPU 作品，请先到 GPU测试 页面创建任务。"}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => {
            const previewURL = pickPreview(job);
            const sourceAsset = pickAsset(job, "source");
            const resultAsset = pickAsset(job, "result");
            const statusKey = String(job.status || "").toLowerCase();
            const selected = isSelected(job.id);
            return (
              <article
                key={job.id}
                className={`overflow-hidden rounded-2xl border bg-white ${
                  selected ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"
                }`}
              >
                <Link href={`/gpu-works/${job.id}`} className="block">
                  <div className="flex aspect-[16/10] items-center justify-center bg-slate-100">
                    {previewURL ? (
                      <img src={previewURL} alt={`gpu-work-${job.id}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-sm text-slate-400">暂无预览</div>
                    )}
                  </div>
                </Link>
                <div className="space-y-2 p-4">
                  <div className="line-clamp-1 text-sm font-semibold text-slate-900">
                    {job.title || `任务 #${job.id}`}
                  </div>
                  <div className="text-xs text-slate-500">
                    状态：{STATUS_TEXT[statusKey] || statusKey || "-"} · 进度：
                    {Math.max(0, Math.min(100, Number(job.progress || 0)))}%
                  </div>
                  <div className="text-xs text-slate-500">
                    模型：{job.model || "-"} · 倍数：{job.scale || "-"}x
                  </div>
                  <div className="text-xs text-slate-500">
                    原图：{formatBytes(sourceAsset?.size_bytes)} · 结果：{formatBytes(resultAsset?.size_bytes)}
                  </div>
                  <div className="text-xs text-slate-400">更新时间：{formatTime(job.updated_at || job.created_at)}</div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link
                      href={`/gpu-works/${job.id}`}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
                    >
                      查看详情
                    </Link>
                    {batchMode ? (
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-200">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(job.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        选择
                      </label>
                    ) : (
                      <button
                        type="button"
                        disabled={deletingID === job.id}
                        onClick={() => void handleDelete(job)}
                        className={`rounded-lg px-3 py-1.5 text-xs ${
                          deletingID === job.id
                            ? "cursor-not-allowed bg-slate-100 text-slate-400"
                            : "bg-red-50 text-red-600 hover:bg-red-100"
                        }`}
                      >
                        {deletingID === job.id ? "删除中..." : "删除任务"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => void fetchJobs(page - 1)}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            loading || page <= 1
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          上一页
        </button>
        <div className="text-sm text-slate-600">
          第 {page} / {totalPages} 页 · 共 {total} 条
        </div>
        <button
          type="button"
          disabled={loading || !hasMore}
          onClick={() => void fetchJobs(page + 1)}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            loading || !hasMore
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          下一页
        </button>
      </div>
    </main>
  );
}
