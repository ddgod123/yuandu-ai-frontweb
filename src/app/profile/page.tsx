"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  API_BASE,
  clearAuthSession,
  fetchWithAuthRetry,
  logoutSession,
} from "@/lib/auth-client";
import { User, FileText, LogOut, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

type Profile = {
  display_name?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
};

function buildRandomAvatar() {
  const seed = Math.random().toString(36).slice(2, 10);
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const avatarPreview = useMemo(() => {
    if (avatarURL.trim()) return avatarURL.trim();
    return "https://api.dicebear.com/7.x/adventurer/svg?seed=emoji";
  }, [avatarURL]);

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
            <div className="group relative h-32 w-32 shrink-0">
              <div className="h-full w-full overflow-hidden rounded-[2.5rem] bg-slate-100 ring-4 ring-white shadow-xl transition-transform group-hover:scale-105">
                <Image src={avatarPreview} alt="avatar" fill unoptimized className="object-cover" />
              </div>
              <button
                onClick={() => setAvatarURL(buildRandomAvatar())}
                className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition-all hover:bg-emerald-500 hover:scale-110 active:scale-95"
                title="随机头像"
              >
                <RefreshCw size={18} />
              </button>
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
