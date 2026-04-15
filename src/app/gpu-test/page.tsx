"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  API_BASE,
  clearAuthSession,
  ensureAuthSession,
  fetchWithAuthRetry,
} from "@/lib/auth-client";

type UploadTokenResponse = {
  token: string;
  key?: string;
  prefix?: string;
  up_host?: string;
};

type GPUJob = {
  id: number;
  title?: string;
  model?: string;
  scale?: number;
  status?: string;
  stage?: string;
  progress?: number;
  source_object_key?: string;
  result_object_key?: string;
  created_at?: string;
  updated_at?: string;
  error_message?: string;
};

const MODEL_PRESETS = [
  { value: "realesrgan-x4plus", label: "realesrgan-x4plus（通用照片，推荐）" },
  { value: "realesrgan-x4plus-anime", label: "realesrgan-x4plus-anime（动漫）" },
  { value: "realesr-animevideov3", label: "realesr-animevideov3（更快）" },
];

const STATUS_TEXT: Record<string, string> = {
  queued: "排队中",
  running: "处理中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

function sanitizeFileName(name: string) {
  const base = (name || "image.png")
    .replace(/[^\w.\-\u4e00-\u9fa5]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `image-${Date.now()}.png`;
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

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN");
}

export default function GPUTestPage() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState("");
  const [title, setTitle] = useState("");
  const [model, setModel] = useState("realesrgan-x4plus");
  const [scale, setScale] = useState(4);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdJob, setCreatedJob] = useState<GPUJob | null>(null);

  const syncAuth = useCallback(async () => {
    const ok = await ensureAuthSession();
    if (!ok) {
      clearAuthSession();
      setIsAuthed(false);
      return false;
    }
    setIsAuthed(true);
    return true;
  }, []);

  useEffect(() => {
    void syncAuth();
  }, [syncAuth]);

  useEffect(() => {
    if (!file) {
      setLocalPreview("");
      return;
    }
    const objectURL = URL.createObjectURL(file);
    setLocalPreview(objectURL);
    return () => {
      URL.revokeObjectURL(objectURL);
    };
  }, [file]);

  const uploadToQiniu = useCallback(
    (uploadToken: UploadTokenResponse, uploadKey: string, currentFile: File) =>
      new Promise<void>((resolve, reject) => {
        const form = new FormData();
        form.append("file", currentFile);
        form.append("token", uploadToken.token);
        form.append("key", uploadKey);

        const upHost = uploadToken.up_host || "https://up.qiniup.com";
        const xhr = new XMLHttpRequest();
        xhr.open("POST", upHost, true);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
          setUploadProgress(percent);
        };
        xhr.onerror = () => reject(new Error("上传失败，请检查网络或上传凭证"));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
            return;
          }
          reject(new Error(xhr.responseText || `上传失败（HTTP ${xhr.status}）`));
        };
        xhr.send(form);
      }),
    []
  );

  const handleSubmit = useCallback(async () => {
    setError("");
    setCreatedJob(null);

    if (!file) {
      setError("请先选择一张图片");
      return;
    }
    if (!(await syncAuth())) {
      setError("请先登录后再测试 GPU 任务");
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      const tokenRes = await fetchWithAuthRetry(`${API_BASE}/gpu-tests/upload-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insert_only: true }),
      });
      if (tokenRes.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        throw new Error("登录已失效，请重新登录");
      }
      if (!tokenRes.ok) {
        throw new Error(await parseAPIError(tokenRes, `获取上传凭证失败（HTTP ${tokenRes.status}）`));
      }

      const tokenData = (await tokenRes.json()) as UploadTokenResponse;
      const uploadKey =
        tokenData.key ||
        `${tokenData.prefix || ""}${Date.now()}-${sanitizeFileName(file.name || "image.png")}`;
      if (!uploadKey || !tokenData.token) {
        throw new Error("上传凭证返回异常，缺少 key 或 token");
      }

      await uploadToQiniu(tokenData, uploadKey, file);

      const createRes = await fetchWithAuthRetry(`${API_BASE}/gpu-tests/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          source_object_key: uploadKey,
          source_mime_type: file.type || "image/png",
          source_size_bytes: file.size || 0,
          model: model.trim(),
          scale,
        }),
      });
      if (createRes.status === 401) {
        clearAuthSession();
        setIsAuthed(false);
        throw new Error("登录已失效，请重新登录");
      }
      if (!createRes.ok) {
        throw new Error(await parseAPIError(createRes, `创建任务失败（HTTP ${createRes.status}）`));
      }

      const created = (await createRes.json()) as GPUJob;
      setCreatedJob(created);
      setTitle("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建任务失败");
    } finally {
      setSubmitting(false);
    }
  }, [file, model, scale, syncAuth, title, uploadToQiniu]);

  if (isAuthed === false) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          请先登录后再使用 GPU 测试页面。
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GPU测试</h1>
          <p className="mt-2 text-sm text-slate-500">
            该页面仅用于创建 GPU 图片增强任务。任务结果请到“GPU作品”页面查看。
          </p>
          <p className="mt-1 text-xs text-amber-700">
            提示：realesrgan-x4plus 首次运行通常会加载模型，耗时会明显更长。
          </p>
        </div>
        <Link
          href="/gpu-works"
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
        >
          打开 GPU作品
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">创建图片增强任务</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">选择图片</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                setFile(selected);
                setUploadProgress(0);
                setCreatedJob(null);
              }}
              className="block w-full cursor-pointer rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">任务标题（可选）</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：样张-01 增强测试"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">模型</label>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              >
                {MODEL_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">放大倍数</label>
              <select
                value={String(scale)}
                onChange={(event) => setScale(Number(event.target.value) || 4)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              >
                <option value="2">2x</option>
                <option value="3">3x</option>
                <option value="4">4x</option>
                <option value="6">6x</option>
                <option value="8">8x</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting || !file}
            onClick={() => void handleSubmit()}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
              submitting || !file
                ? "cursor-not-allowed bg-slate-300"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {submitting ? `提交中（上传 ${uploadProgress}%）` : "创建图片增强任务"}
          </button>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        {localPreview ? (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <img src={localPreview} alt="本地预览" className="h-auto w-full object-contain" />
          </div>
        ) : null}
      </section>

      {createdJob ? (
        <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="text-sm font-semibold text-emerald-800">任务已创建</h3>
          <div className="mt-2 space-y-1 text-sm text-emerald-900">
            <p>ID：#{createdJob.id}</p>
            <p>标题：{createdJob.title || `任务 #${createdJob.id}`}</p>
            <p>状态：{STATUS_TEXT[String(createdJob.status || "").toLowerCase()] || createdJob.status || "-"}</p>
            <p>模型：{createdJob.model || "-"} · 倍数：{createdJob.scale || "-"}x</p>
            <p>更新时间：{formatTime(createdJob.updated_at || createdJob.created_at)}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/gpu-works"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
            >
              去 GPU作品 列表
            </Link>
            <Link
              href={`/gpu-works/${createdJob.id}`}
              className="rounded-lg bg-white px-3 py-1.5 text-xs text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
            >
              查看该任务详情
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
