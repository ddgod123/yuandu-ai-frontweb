"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  queued_at?: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
  assets?: GPUAsset[];
};

const STATUS_TEXT: Record<string, string> = {
  queued: "排队中",
  running: "处理中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const STAGE_TEXT: Record<string, string> = {
  queued: "已排队",
  running: "处理中",
  uploading: "上传中",
  callback: "回调写入中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

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

function pickAsset(job: GPUJob | null, role: "source" | "result") {
  if (!job || !Array.isArray(job.assets)) return undefined;
  return job.assets.find((item) => item.asset_role === role);
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

export default function GPUWorkDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const jobID = Number(params?.id || 0);

  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<GPUJob | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);

  const sourceAsset = useMemo(() => pickAsset(job, "source"), [job]);
  const resultAsset = useMemo(() => pickAsset(job, "result"), [job]);
  const sourceURL = job?.source_object_url || sourceAsset?.object_url || "";
  const resultURL = job?.result_object_url || resultAsset?.object_url || "";

  const fetchDetail = useCallback(async () => {
    if (!Number.isFinite(jobID) || jobID <= 0) {
      setError("任务 ID 非法");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const ok = await ensureAuthSession();
      if (!ok) {
        clearAuthSession();
        setIsAuthed(false);
        return;
      }
      setIsAuthed(true);

      const res = await fetchWithAuthRetry(`${API_BASE}/gpu-tests/jobs/${jobID}`);
      if (res.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        return;
      }
      if (!res.ok) {
        throw new Error(await parseAPIError(res, `读取详情失败（HTTP ${res.status}）`));
      }
      setJob((await res.json()) as GPUJob);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "读取详情失败");
    } finally {
      setLoading(false);
    }
  }, [jobID]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleDelete = useCallback(async () => {
    if (!job) return;
    const confirmed = window.confirm(
      `确认删除“${job.title || `任务 #${job.id}`}”？\n\n将同时删除数据库记录和七牛云原图/增强图。`
    );
    if (!confirmed) return;

    setDeleting(true);
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
      router.replace("/gpu-works");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }, [job, router]);

  if (isAuthed === false) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          请先登录后查看 GPU 作品详情。
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/gpu-works"
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
          >
            返回 GPU作品
          </Link>
          <button
            type="button"
            onClick={() => void fetchDetail()}
            disabled={loading}
            className={`rounded-lg px-3 py-2 text-sm ${
              loading ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {loading ? "刷新中..." : "刷新详情"}
          </button>
        </div>
        <button
          type="button"
          disabled={deleting || !job}
          onClick={() => void handleDelete()}
          className={`rounded-lg px-3 py-2 text-sm ${
            deleting || !job
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-red-50 text-red-600 hover:bg-red-100"
          }`}
        >
          {deleting ? "删除中..." : "删除任务"}
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!job ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-500">
          {loading ? "正在加载详情..." : "未读取到任务详情。"}
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h1 className="text-xl font-bold text-slate-900">GPU作品详情：#{job.id}</h1>
            <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p>标题：{job.title || "-"}</p>
              <p>状态：{STATUS_TEXT[String(job.status || "").toLowerCase()] || job.status || "-"}</p>
              <p>阶段：{STAGE_TEXT[String(job.stage || "").toLowerCase()] || job.stage || "-"}</p>
              <p>进度：{Math.max(0, Math.min(100, Number(job.progress || 0)))}%</p>
              <p>模型：{job.model || "-"}</p>
              <p>放大倍数：{job.scale || "-"}x</p>
              <p>创建时间：{formatTime(job.created_at)}</p>
              <p>更新时间：{formatTime(job.updated_at)}</p>
              <p className="md:col-span-2">源图Key：{job.source_object_key || "-"}</p>
              <p className="md:col-span-2">结果Key：{job.result_object_key || "-"}</p>
              {job.error_message ? (
                <p className="md:col-span-2 rounded-lg bg-red-50 px-2 py-1 text-red-600">
                  失败原因：{job.error_message}
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">原图</h2>
                <span className="text-xs text-slate-500">{formatBytes(sourceAsset?.size_bytes)}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {sourceURL ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: sourceURL, title: "原图" })}
                    className="block w-full"
                  >
                    <img src={sourceURL} alt="source" className="h-[320px] w-full object-contain" />
                  </button>
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">暂无原图</div>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">点击图片可查看大图</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">增强图</h2>
                <span className="text-xs text-slate-500">{formatBytes(resultAsset?.size_bytes)}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {resultURL ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: resultURL, title: "增强图" })}
                    className="block w-full"
                  >
                    <img src={resultURL} alt="result" className="h-[320px] w-full object-contain" />
                  </button>
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">等待结果</div>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">点击图片可查看大图</p>
            </div>
          </section>

          {Array.isArray(job.assets) && job.assets.length > 0 ? (
            <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">角色</th>
                    <th className="px-3 py-2">对象 Key</th>
                    <th className="px-3 py-2">尺寸</th>
                    <th className="px-3 py-2">体积</th>
                  </tr>
                </thead>
                <tbody>
                  {job.assets.map((asset) => (
                    <tr key={asset.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{asset.asset_role}</td>
                      <td className="max-w-[480px] truncate px-3 py-2">{asset.object_key || "-"}</td>
                      <td className="px-3 py-2">
                        {asset.width && asset.height ? `${asset.width} × ${asset.height}` : "-"}
                      </td>
                      <td className="px-3 py-2">{formatBytes(asset.size_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      )}

      {lightbox ? (
        <div className="fixed inset-0 z-[120] bg-black/85 p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="关闭预览"
            onClick={() => setLightbox(null)}
          />
          <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl items-center justify-center">
            <div className="max-h-full max-w-full">
              <div className="mb-2 flex items-center justify-between text-sm text-white">
                <span>{lightbox.title}</span>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="rounded bg-white/20 px-2 py-1 text-xs hover:bg-white/30"
                >
                  关闭
                </button>
              </div>
              <img src={lightbox.url} alt={lightbox.title} className="max-h-[85vh] max-w-[95vw] object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

