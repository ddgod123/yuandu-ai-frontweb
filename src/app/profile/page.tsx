"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  API_BASE,
  clearAuthSession,
  fetchWithAuthRetry,
  logoutSession,
} from "@/lib/auth-client";
import { User, FileText, LogOut, CheckCircle2, AlertCircle, Camera } from "lucide-react";

type Profile = {
  display_name?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
};

type FeishuBindResponse = {
  ok?: boolean;
  already_bound?: boolean;
  resumed_jobs?: number;
  error?: string;
};

type IntegrationProviderSummaryItem = {
  provider?: string;
  provider_label?: string;
  bound_count?: number;
  active?: boolean;
};

type IntegrationAccountItem = {
  id?: number;
  provider?: string;
  provider_label?: string;
  tenant_key?: string;
  open_id_masked?: string;
  union_id_masked?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type IntegrationRecentIngressItem = {
  id?: number;
  provider?: string;
  provider_label?: string;
  channel?: string;
  status?: string;
  video_job_id?: number;
  source_file_name?: string;
  source_video_key?: string;
  source_size_bytes?: number;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
  finished_at?: string;
};

type IntegrationOverviewResponse = {
  accounts?: IntegrationAccountItem[];
  provider_summary?: IntegrationProviderSummaryItem[];
  recent_ingress?: IntegrationRecentIngressItem[];
};

type UploadTokenResponse = {
  token?: string;
  key?: string;
  prefix?: string;
  up_host?: string;
};

// 本版本先不接入飞书与多入口账号统一状态，保留代码与接口结构供后续灰度恢复。
const FEISHU_INTEGRATION_ENABLED = false;
const AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const AVATAR_ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif"]);
const AVATAR_OUTPUT_SIZE = 768;
const AVATAR_RECOMMEND_SIZE = 800;

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImageSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("canvas export failed"));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function detectContentBounds(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height).data;
  const borderStep = Math.max(1, Math.floor(Math.min(width, height) / 80));
  const borderSamples: Array<{ r: number; g: number; b: number; a: number }> = [];

  for (let x = 0; x < width; x += borderStep) {
    const top = (0 * width + x) * 4;
    const bottom = ((height - 1) * width + x) * 4;
    borderSamples.push({
      r: imageData[top],
      g: imageData[top + 1],
      b: imageData[top + 2],
      a: imageData[top + 3],
    });
    borderSamples.push({
      r: imageData[bottom],
      g: imageData[bottom + 1],
      b: imageData[bottom + 2],
      a: imageData[bottom + 3],
    });
  }
  for (let y = 0; y < height; y += borderStep) {
    const left = (y * width + 0) * 4;
    const right = (y * width + (width - 1)) * 4;
    borderSamples.push({
      r: imageData[left],
      g: imageData[left + 1],
      b: imageData[left + 2],
      a: imageData[left + 3],
    });
    borderSamples.push({
      r: imageData[right],
      g: imageData[right + 1],
      b: imageData[right + 2],
      a: imageData[right + 3],
    });
  }

  const opaqueBorder = borderSamples.filter((item) => item.a > 20);
  let bgColor: { r: number; g: number; b: number } | null = null;
  if (opaqueBorder.length >= 12) {
    const avg = opaqueBorder.reduce(
      (acc, cur) => {
        acc.r += cur.r;
        acc.g += cur.g;
        acc.b += cur.b;
        return acc;
      },
      { r: 0, g: 0, b: 0 }
    );
    const mean = {
      r: avg.r / opaqueBorder.length,
      g: avg.g / opaqueBorder.length,
      b: avg.b / opaqueBorder.length,
    };
    const variance =
      opaqueBorder.reduce((acc, cur) => {
        const dr = cur.r - mean.r;
        const dg = cur.g - mean.g;
        const db = cur.b - mean.b;
        return acc + dr * dr + dg * dg + db * db;
      }, 0) / opaqueBorder.length;
    if (variance <= 380) {
      bgColor = mean;
    }
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const alpha = imageData[idx + 3];
      if (alpha <= 12) continue;
      if (bgColor) {
        const dr = imageData[idx] - bgColor.r;
        const dg = imageData[idx + 1] - bgColor.g;
        const db = imageData[idx + 2] - bgColor.b;
        const colorDistance = dr * dr + dg * dg + db * db;
        if (colorDistance <= 700) continue;
      }
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) {
    minX = width;
    minY = height;
    maxX = -1;
    maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = imageData[(y * width + x) * 4 + 3];
        if (alpha <= 2) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function ingressStatusLabel(raw: string) {
  const value = String(raw || "").trim().toLowerCase();
  switch (value) {
    case "queued":
      return "排队中";
    case "processing":
      return "处理中";
    case "waiting_bind":
      return "待绑定";
    case "job_queued":
      return "任务已创建";
    case "done":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return value || "-";
  }
}

function ingressStatusClass(raw: string) {
  const value = String(raw || "").trim().toLowerCase();
  switch (value) {
    case "done":
      return "border-emerald-100 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border-rose-100 bg-rose-50 text-rose-600";
    case "waiting_bind":
      return "border-amber-100 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function formatLocalTime(value?: string) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("zh-CN");
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bio, setBio] = useState("");
  const [bindCode, setBindCode] = useState("");
  const [bindLoading, setBindLoading] = useState(false);
  const [bindMessage, setBindMessage] = useState<string | null>(null);
  const [bindMessageType, setBindMessageType] = useState<"success" | "error">("success");
  const [integrationOverview, setIntegrationOverview] = useState<IntegrationOverviewResponse | null>(null);
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const avatarPreview = useMemo(() => {
    if (avatarURL.trim()) return avatarURL.trim();
    return "https://api.dicebear.com/7.x/adventurer/svg?seed=emoji";
  }, [avatarURL]);

  useEffect(() => {
    if (!FEISHU_INTEGRATION_ENABLED) return;
    const rawCode =
      (searchParams?.get("code") ||
        searchParams?.get("bind_code") ||
        searchParams?.get("feishu_code") ||
        "") as string;
    const normalized = rawCode.trim();
    if (normalized) {
      setBindCode((prev) => (prev.trim() ? prev : normalized));
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/me`);
        if (res.status === 401) {
          clearAuthSession();
          router.replace("/login");
          return;
        }
        const data = (await res.json()) as Profile;
        setProfile(data);
        setDisplayName(data.display_name || "");
        setAvatarURL(data.avatar_url || "");
        setBio(data.bio || "");
      } catch {
        setMessage("加载资料失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const loadIntegrationOverview = useCallback(async () => {
    if (!FEISHU_INTEGRATION_ENABLED) return;
    setIntegrationLoading(true);
    setIntegrationMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/integrations/overview`);
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        const text = (await res.text()) || "加载多入口绑定状态失败";
        throw new Error(text);
      }
      const data = (await res.json()) as IntegrationOverviewResponse;
      setIntegrationOverview(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "加载多入口绑定状态失败";
      setIntegrationMessage(msg);
      setIntegrationOverview(null);
    } finally {
      setIntegrationLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!FEISHU_INTEGRATION_ENABLED) return;
    void loadIntegrationOverview();
  }, [loadIntegrationOverview]);

  const handleFeishuBind = async () => {
    if (!FEISHU_INTEGRATION_ENABLED) return;
    const normalizedCode = bindCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalizedCode) {
      setBindMessageType("error");
      setBindMessage("请输入绑定码");
      return;
    }

    setBindLoading(true);
    setBindMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/integrations/feishu/bind-code/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: normalizedCode }),
      });
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as FeishuBindResponse;
      if (!res.ok) {
        setBindMessageType("error");
        setBindMessage(data?.error || "绑定失败，请检查绑定码后重试");
        return;
      }

      setBindCode(normalizedCode);
      setBindMessageType("success");
      if (data?.already_bound) {
        setBindMessage("当前飞书账号已绑定，可直接发视频给机器人。");
      } else {
        const resumed = typeof data?.resumed_jobs === "number" ? data.resumed_jobs : 0;
        setBindMessage(`绑定成功，已恢复任务 ${resumed} 个。`);
      }
      void loadIntegrationOverview();
    } catch {
      setBindMessageType("error");
      setBindMessage("绑定失败，请稍后重试");
    } finally {
      setBindLoading(false);
    }
  };

  const uploadAvatarFile = async (file: File) => {
    if (!file) return false;
    setAvatarUploading(true);
    setMessage(null);
    try {
      const tokenRes = await fetchWithAuthRetry(`${API_BASE}/video-jobs/upload-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insert_only: true }),
      });
      if (tokenRes.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return false;
      }
      if (!tokenRes.ok) {
        setMessage("获取头像上传凭证失败，请稍后重试");
        return false;
      }
      const tokenData = (await tokenRes.json()) as UploadTokenResponse;
      const cleanName = sanitizeFileName(file.name || "avatar.webp");
      const uploadKey = tokenData.key || `${tokenData.prefix || ""}avatar-${Date.now()}-${cleanName}`;
      const upHost = tokenData.up_host || "https://up.qiniup.com";
      if (!tokenData.token || !uploadKey) {
        setMessage("头像上传凭证无效，请稍后重试");
        return false;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("token", tokenData.token);
      form.append("key", uploadKey);

      const uploadRes = await fetch(upHost, { method: "POST", body: form });
      if (!uploadRes.ok) {
        setMessage("头像上传失败，请稍后重试");
        return false;
      }

      const proxyURL = `${API_BASE}/storage/proxy?key=${encodeURIComponent(uploadKey)}`;
      setAvatarURL(proxyURL);
      setMessage("头像已上传，请点击“保存个人资料”完成更新");
      return true;
    } catch {
      setMessage("头像上传失败，请稍后重试");
      return false;
    } finally {
      setAvatarUploading(false);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = "";
      }
    }
  };

  const processAvatarFile = async (file: File) => {
    if (!file) return;
    const ext = String(file.name.split(".").pop() || "").trim().toLowerCase();
    if (!ext || !AVATAR_ALLOWED_EXT.has(ext)) {
      setMessage("头像格式仅支持 jpg/jpeg/png/gif/webp/bmp/avif");
      return;
    }
    if (Number(file.size || 0) > AVATAR_MAX_SIZE) {
      setMessage("头像文件过大，请上传 5MB 以内图片");
      return;
    }
    try {
      setMessage(null);
      const src = await readFileAsDataURL(file);
      const size = await loadImageSize(src);
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image decode failed"));
        img.src = src;
      });

      const output = AVATAR_OUTPUT_SIZE;
      const w = Math.max(1, img.naturalWidth || size.width || 1);
      const h = Math.max(1, img.naturalHeight || size.height || 1);
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = w;
      sourceCanvas.height = h;
      const sourceCtx = sourceCanvas.getContext("2d");
      if (!sourceCtx) {
        setMessage("头像处理失败，请稍后重试");
        return;
      }
      sourceCtx.clearRect(0, 0, w, h);
      sourceCtx.drawImage(img, 0, 0, w, h);

      let cropX = 0;
      let cropY = 0;
      let cropW = w;
      let cropH = h;
      try {
        const contentBounds = detectContentBounds(sourceCtx, w, h);
        if (contentBounds) {
          cropX = contentBounds.x;
          cropY = contentBounds.y;
          cropW = contentBounds.width;
          cropH = contentBounds.height;
        }
      } catch {
        // 忽略透明区域探测异常，回退到默认居中裁剪
      }

      const side = Math.max(1, Math.min(cropW, cropH));
      const centerX = cropX + cropW / 2;
      const centerY = cropY + cropH / 2;
      const sx = Math.max(0, Math.min(w - side, Math.round(centerX - side / 2)));
      const sy = Math.max(0, Math.min(h - side, Math.round(centerY - side / 2)));

      const canvas = document.createElement("canvas");
      canvas.width = output;
      canvas.height = output;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setMessage("头像处理失败，请稍后重试");
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, output, output);
      ctx.drawImage(sourceCanvas, sx, sy, side, side, 0, 0, output, output);

      let blob = await canvasToBlob(canvas, "image/webp", 0.86);
      if (blob.size > 1024 * 1024) {
        blob = await canvasToBlob(canvas, "image/webp", 0.72);
      }

      const croppedFile = new File([blob], `avatar-${Date.now()}.webp`, { type: blob.type || "image/webp" });
      const uploaded = await uploadAvatarFile(croppedFile);
      if (uploaded && (w < AVATAR_RECOMMEND_SIZE || h < AVATAR_RECOMMEND_SIZE)) {
        setMessage(
          `头像已上传，请点击“保存个人资料”完成更新。为获得更佳展示效果，建议使用 ${AVATAR_RECOMMEND_SIZE}×${AVATAR_RECOMMEND_SIZE} 及以上图片`
        );
      }
    } catch {
      setMessage("头像处理失败，请稍后重试");
    } finally {
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          display_name: displayName.trim(),
          avatar_url: avatarURL.trim(),
          bio: bio.trim(),
        }),
      });
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as Profile & { error?: string };
      if (!res.ok) {
        setMessage(data?.error || "保存失败");
        return;
      }
      setProfile(data);
      setMessage("资料已保存");
    } catch {
      setMessage("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutSession();
    } finally {
      router.replace("/");
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-[2.5rem] border border-slate-100 bg-white p-10 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-emerald-500" />
          <p className="text-sm font-bold text-slate-400 tracking-wider">正在加载资料...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10">
        {/* 背景装饰 */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-50/50 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-blue-50/50 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            <div className="shrink-0 space-y-2">
              <div className="group relative h-32 w-32">
                <div className="relative h-full w-full overflow-hidden rounded-full bg-transparent shadow-xl transition-transform group-hover:scale-105">
                  <Image src={avatarPreview} alt="avatar" fill unoptimized className="rounded-full object-cover" />
                </div>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.avif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void processAvatarFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition-all hover:bg-emerald-500 hover:scale-110 active:scale-95"
                  title="上传头像"
                >
                  <Camera size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-slate-900">个人资料</h1>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600 ring-1 ring-emerald-100">
                  已认证
                </div>
              </div>
              <p className="text-sm font-bold text-slate-400">
                手机号已绑定：<span className="text-slate-600">{profile?.phone || "未绑定"}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-600 transition-all hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 disabled:opacity-60"
            >
              <LogOut size={18} />
              {loggingOut ? "退出中..." : "退出登录"}
            </button>
          </div>

          {/* 本版本暂不接入飞书绑定，后续恢复时开启 FEISHU_INTEGRATION_ENABLED 即可 */}
          {FEISHU_INTEGRATION_ENABLED ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <h2 className="text-base font-black text-slate-900">飞书账号绑定</h2>
                <p className="text-xs font-semibold text-slate-500">
                  在飞书机器人会话里拿到绑定码后，填在这里并确认绑定。
                </p>
                <input
                  type="text"
                  value={bindCode}
                  onChange={(event) => setBindCode(event.target.value)}
                  placeholder="例如：8EBNS3W7"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>
              <button
                type="button"
                disabled={bindLoading}
                onClick={handleFeishuBind}
                className="h-12 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bindLoading ? "绑定中..." : "确认绑定"}
              </button>
            </div>

            {bindMessage && (
              <div
                className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  bindMessageType === "success"
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : "border-rose-100 bg-rose-50 text-rose-600"
                }`}
              >
                {bindMessageType === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{bindMessage}</span>
              </div>
            )}
          </div>
          ) : null}

          {/* 本版本暂不接入多入口账号统一状态，后续恢复时开启 FEISHU_INTEGRATION_ENABLED 即可 */}
          {FEISHU_INTEGRATION_ENABLED ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900">多入口账号统一状态</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">Web / 飞书 / QQ / 企业微信入口统一到当前账号。</p>
              </div>
              <button
                type="button"
                onClick={() => void loadIntegrationOverview()}
                disabled={integrationLoading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {integrationLoading ? "刷新中..." : "刷新"}
              </button>
            </div>

            {integrationMessage ? (
              <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                {integrationMessage}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              {(integrationOverview?.provider_summary || []).map((item) => {
                const active = Boolean(item?.active);
                const label = String(item?.provider_label || item?.provider || "-");
                const count = Number(item?.bound_count || 0);
                return (
                  <div
                    key={String(item?.provider || label)}
                    className={`rounded-xl border px-4 py-3 ${
                      active ? "border-emerald-100 bg-emerald-50/60" : "border-slate-200 bg-slate-50/70"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-500">{label}</div>
                    <div className={`mt-1 text-sm font-black ${active ? "text-emerald-700" : "text-slate-500"}`}>
                      {active ? "已绑定" : "未绑定"}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">绑定记录 {count} 条</div>
                  </div>
                );
              })}
            </div>

            {(integrationOverview?.accounts || []).length > 0 ? (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="text-xs font-bold text-slate-500">已绑定账号</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(integrationOverview?.accounts || []).slice(0, 8).map((item) => (
                    <span
                      key={String(item.id || `${item.provider}-${item.open_id_masked}`)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                      title={`tenant=${item.tenant_key || "-"}`}
                    >
                      <span>{item.provider_label || item.provider || "-"}</span>
                      <span>·</span>
                      <span>{item.open_id_masked || item.union_id_masked || "-"}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="mb-2 text-xs font-bold text-slate-500">最近入口任务</div>
              <div className="space-y-2">
                {(integrationOverview?.recent_ingress || []).slice(0, 6).map((item) => (
                  <div
                    key={String(item.id || `${item.provider}-${item.created_at}`)}
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-slate-700">
                        {item.provider_label || item.provider || "-"} · {item.source_file_name || item.source_video_key || "-"}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500">
                        {formatLocalTime(item.created_at)} {item.video_job_id ? `· 任务 #${item.video_job_id}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${ingressStatusClass(String(item.status || ""))}`}>
                        {ingressStatusLabel(String(item.status || ""))}
                      </span>
                    </div>
                  </div>
                ))}
                {integrationLoading ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">加载中...</div>
                ) : null}
                {!integrationLoading && (integrationOverview?.recent_ingress || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
                    暂无多入口任务记录
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          ) : null}

          <form onSubmit={handleSave} className="mt-12 space-y-8">
            <div className="grid gap-8">
              {/* 昵称 */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <User size={14} />
                  昵称
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="填写您的昵称"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>
            </div>

            {/* 简介 */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <FileText size={14} />
                一句话简介
              </label>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="写点关于你的介绍，让大家更了解你..."
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            {/* 提示消息 */}
            {message && (
              <div className={`animate-in fade-in slide-in-from-top-1 flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-bold ${
                message.includes("成功") || message.includes("已保存")
                  ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                  : "border-rose-100 bg-rose-50 text-rose-500"
              }`}>
                {message.includes("成功") || message.includes("已保存") ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="group relative h-14 w-full overflow-hidden rounded-2xl bg-slate-900 text-base font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:bg-slate-900 disabled:hover:translate-y-0"
            >
              <span className="relative z-10">{saving ? "正在保存修改..." : "保存个人资料"}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
