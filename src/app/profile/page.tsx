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
  user_level?: string;
  subscription_status?: string;
  subscription_plan?: string;
  subscription_started_at?: string;
  subscription_expires_at?: string;
  is_subscriber?: boolean;
};

type RedeemRecord = {
  id: number;
  code_mask?: string;
  granted_plan?: string;
  granted_status?: string;
  granted_starts_at?: string;
  granted_expires_at?: string;
  created_at?: string;
};

type RedeemRecordResponse = {
  items?: RedeemRecord[];
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
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemRecords, setRedeemRecords] = useState<RedeemRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const avatarPreview = useMemo(() => {
    if (avatarURL.trim()) return avatarURL.trim();
    return "https://api.dicebear.com/7.x/adventurer/svg?seed=emoji";
  }, [avatarURL]);

  useEffect(() => {
    const loadRedeemRecords = async () => {
      setRecordsLoading(true);
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/me/redeem-records?page=1&page_size=20`);
        if (!res.ok) {
          setRedeemRecords([]);
          return;
        }
        const data = (await res.json()) as RedeemRecordResponse;
        setRedeemRecords(Array.isArray(data.items) ? data.items : []);
      } catch {
        setRedeemRecords([]);
      } finally {
        setRecordsLoading(false);
      }
    };

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
        await loadRedeemRecords();
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

  const handleRedeem = async () => {
    const code = redeemCode.trim();
    if (!code) {
      setMessage("请输入兑换码");
      return;
    }
    setRedeeming(true);
    setMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/redeem-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { error?: string; message?: string; user?: Profile };
      if (!res.ok) {
        setMessage(data?.error || "兑换失败，请稍后重试");
        return;
      }
      if (data?.user) {
        setProfile(data.user);
      }
      setRedeemCode("");
      setMessage(data?.message || "兑换成功");

      const recordRes = await fetchWithAuthRetry(`${API_BASE}/me/redeem-records?page=1&page_size=20`);
      if (recordRes.ok) {
        const recordData = (await recordRes.json()) as RedeemRecordResponse;
        setRedeemRecords(Array.isArray(recordData.items) ? recordData.items : []);
      }
    } catch {
      setMessage("兑换失败，请稍后重试");
    } finally {
      setRedeeming(false);
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
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
            <h2 className="text-base font-black text-emerald-900">订阅权益</h2>
            <div className="mt-3 grid gap-3 text-sm text-emerald-900 md:grid-cols-2">
              <div>用户等级：{profile?.user_level || "free"}</div>
              <div>订阅状态：{profile?.subscription_status || "inactive"}</div>
              <div>订阅计划：{profile?.subscription_plan || "-"}</div>
              <div>
                到期时间：
                {profile?.subscription_expires_at
                  ? new Date(profile.subscription_expires_at).toLocaleString()
                  : "-"}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                value={redeemCode}
                onChange={(event) => setRedeemCode(event.target.value)}
                placeholder="输入兑换码解锁合集下载"
                className="h-11 flex-1 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                disabled={redeeming}
                onClick={handleRedeem}
                className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {redeeming ? "兑换中..." : "立即兑换"}
              </button>
            </div>
          </div>

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

        <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <h3 className="text-sm font-black text-slate-800">我的兑换记录</h3>
          {recordsLoading ? (
            <div className="mt-3 text-sm text-slate-500">正在加载...</div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2">记录ID</th>
                    <th className="px-3 py-2">兑换码</th>
                    <th className="px-3 py-2">计划</th>
                    <th className="px-3 py-2">生效时间</th>
                    <th className="px-3 py-2">到期时间</th>
                    <th className="px-3 py-2">兑换时间</th>
                  </tr>
                </thead>
                <tbody>
                  {redeemRecords.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{item.id}</td>
                      <td className="px-3 py-2">{item.code_mask || "-"}</td>
                      <td className="px-3 py-2">{item.granted_plan || "-"}</td>
                      <td className="px-3 py-2">
                        {item.granted_starts_at
                          ? new Date(item.granted_starts_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {item.granted_expires_at
                          ? new Date(item.granted_expires_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                  {redeemRecords.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-400" colSpan={6}>
                        暂无兑换记录
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
