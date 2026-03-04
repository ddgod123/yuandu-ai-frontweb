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

type Profile = {
  display_name?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  website_url?: string;
  location?: string;
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
  const [websiteURL, setWebsiteURL] = useState("");
  const [location, setLocation] = useState("");
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
        setWebsiteURL(data.website_url || "");
        setLocation(data.location || "");
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
          website_url: websiteURL.trim(),
          location: location.trim(),
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
      <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center text-slate-400 font-semibold shadow-sm">
        正在加载资料...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="rounded-3xl border border-slate-100 bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="h-28 w-28 overflow-hidden rounded-[2rem] bg-slate-100 ring-2 ring-white shadow-lg">
            <div className="relative h-full w-full">
              <Image src={avatarPreview} alt="avatar" fill unoptimized className="object-cover" />
            </div>
          </div>
          <div className="flex-1 md:ml-6">
            <h1 className="text-3xl font-black text-slate-900">个人资料</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              手机号已绑定：{profile?.phone || "未绑定"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {loggingOut ? "退出中..." : "退出登录"}
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-10 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">昵称</label>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="填写昵称"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">头像链接</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={avatarURL}
                  onChange={(event) => setAvatarURL(event.target.value)}
                  placeholder="可填写图片 URL"
                  className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setAvatarURL(buildRandomAvatar())}
                  className="h-12 w-32 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  随机头像
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">一句话简介</label>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="写点关于你的介绍"
              className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">个人网站</label>
              <input
                type="text"
                value={websiteURL}
                onChange={(event) => setWebsiteURL(event.target.value)}
                placeholder="https://"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">所在地</label>
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="城市或地区"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {message ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存资料"}
          </button>
        </form>
      </div>
    </div>
  );
}
