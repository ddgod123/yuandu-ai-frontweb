"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API_BASE, clearAuthSession, fetchWithAuthRetry } from "@/lib/auth-client";
import { Info, Ticket } from "lucide-react";

type Profile = {
  display_name?: string;
  avatar_url?: string;
  phone?: string;
};

type CollectionCodeValidateResponse = {
  valid: boolean;
  message: string;
  code_mask?: string;
  status?: string;
  collection_id?: number;
  collection_title?: string;
  granted_download_times?: number;
  max_redeem_users?: number;
  used_redeem_users?: number;
  starts_at?: string;
  ends_at?: string;
};

type CollectionCodeRedeemResponse = {
  error?: string;
  message?: string;
  code_mask?: string;
  collection_id?: number;
  collection_title?: string;
  granted_download_times?: number;
  remaining_download_times?: number;
  expires_at?: string;
};

type CollectionDownloadRedemptionRecord = {
  id: number;
  code_id?: number;
  code_mask?: string;
  user_id?: number;
  collection_id: number;
  collection_title?: string;
  granted_download_times?: number;
  expires_at?: string;
  created_at?: string;
};

type CollectionDownloadRedemptionListResponse = {
  items?: CollectionDownloadRedemptionRecord[];
  total?: number;
};

type LatestCollectionRedeemCard = {
  code_mask?: string;
  collection_title?: string;
  granted_download_times?: number;
  remaining_download_times?: number;
  expires_at?: string;
};

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/adventurer/svg?seed=emoji";

function formatTime(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("zh-CN");
}

export default function CardManagePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [collectionCode, setCollectionCode] = useState("");
  const [collectionValidating, setCollectionValidating] = useState(false);
  const [collectionRedeeming, setCollectionRedeeming] = useState(false);
  const [collectionValidation, setCollectionValidation] = useState<CollectionCodeValidateResponse | null>(null);
  const [latestCollectionRedeem, setLatestCollectionRedeem] = useState<LatestCollectionRedeemCard | null>(null);
  const [collectionRedeemRecords, setCollectionRedeemRecords] = useState<CollectionDownloadRedemptionRecord[]>([]);
  const [collectionRedeemRecordsLoading, setCollectionRedeemRecordsLoading] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const avatarPreview = useMemo(() => {
    const raw = (profile?.avatar_url || "").trim();
    return raw || DEFAULT_AVATAR;
  }, [profile?.avatar_url]);

  const loadProfile = useCallback(async () => {
    const res = await fetchWithAuthRetry(`${API_BASE}/me`);
    if (res.status === 401) {
      clearAuthSession();
      router.replace("/login");
      return false;
    }
    if (!res.ok) return false;
    const data = (await res.json()) as Profile;
    setProfile(data);
    return true;
  }, [router]);

  const loadCollectionRedeemRecords = useCallback(async () => {
    setCollectionRedeemRecordsLoading(true);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/collection-download-redeem-records?page=1&page_size=50`);
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setCollectionRedeemRecords([]);
        return;
      }
      const data = (await res.json()) as CollectionDownloadRedemptionListResponse;
      setCollectionRedeemRecords(Array.isArray(data.items) ? data.items : []);
    } catch {
      setCollectionRedeemRecords([]);
    } finally {
      setCollectionRedeemRecordsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const load = async () => {
      try {
        const ok = await loadProfile();
        if (!ok) {
          setCollectionMessage("加载次卡信息失败，请稍后重试");
          return;
        }
        await loadCollectionRedeemRecords();
      } catch {
        setCollectionMessage("加载次卡信息失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadCollectionRedeemRecords, loadProfile]);

  const handleValidateCollectionCode = useCallback(async () => {
    const code = collectionCode.trim();
    if (!code) {
      setCollectionMessage("请输入合集次卡兑换码");
      return;
    }

    setCollectionValidating(true);
    setCollectionMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/collection-download-code/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as CollectionCodeValidateResponse & { error?: string };
      if (!res.ok) {
        setCollectionMessage(data.error || "验证失败，请稍后重试");
        return;
      }
      setCollectionValidation(data);
      setCollectionMessage(data.message || (data.valid ? "兑换码可用" : "兑换码不可用"));
    } catch {
      setCollectionMessage("验证失败，请稍后重试");
    } finally {
      setCollectionValidating(false);
    }
  }, [collectionCode, router]);

  const handleRedeemCollectionCode = useCallback(async () => {
    const code = collectionCode.trim();
    if (!code) {
      setCollectionMessage("请输入合集次卡兑换码");
      return;
    }

    setCollectionRedeeming(true);
    setCollectionMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/collection-download-code/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as CollectionCodeRedeemResponse;
      if (!res.ok) {
        setCollectionMessage(data.error || "兑换失败，请稍后重试");
        return;
      }

      setLatestCollectionRedeem({
        code_mask: data.code_mask,
        collection_title: data.collection_title,
        granted_download_times: data.granted_download_times,
        remaining_download_times: data.remaining_download_times,
        expires_at: data.expires_at,
      });
      setCollectionValidation(null);
      setCollectionCode("");
      setCollectionMessage(data.message || "兑换成功");
      await loadCollectionRedeemRecords();
    } catch {
      setCollectionMessage("兑换失败，请稍后重试");
    } finally {
      setCollectionRedeeming(false);
    }
  }, [collectionCode, loadCollectionRedeemRecords, router]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-[2.5rem] border border-slate-100 bg-white p-10 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-blue-500" />
          <p className="text-sm font-bold tracking-wider text-slate-400">正在加载次卡信息...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 sm:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[1.5rem] bg-slate-100 ring-4 ring-white shadow-lg">
            <div className="relative h-full w-full">
              <Image src={avatarPreview} alt="avatar" fill unoptimized className="object-cover" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">次卡管理</h1>
            <p className="mt-1 text-sm font-bold text-slate-400">
              账号：<span className="text-slate-600">{profile?.display_name || "用户"}</span>
              <span className="mx-2 text-slate-200">|</span>
              手机：<span className="text-slate-600">{profile?.phone || "未绑定"}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-blue-100 bg-blue-50/30 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-md shadow-blue-200">
              <Ticket size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">合集次卡兑换</h2>
              <p className="text-xs font-bold text-blue-500/70">使用兑换码获取指定合集下载次数</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={collectionCode}
              onChange={(event) => {
                setCollectionCode(event.target.value);
                setCollectionValidation(null);
              }}
              placeholder="输入合集次卡兑换码"
              className="h-14 flex-1 rounded-2xl border border-blue-100 bg-white px-5 text-base font-bold tracking-wider text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
            />
            <button
              type="button"
              disabled={collectionValidating}
              onClick={() => void handleValidateCollectionCode()}
              className="h-14 rounded-2xl border border-blue-200 bg-white px-6 text-sm font-black text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
            >
              {collectionValidating ? "验证中..." : "验证"}
            </button>
            <button
              type="button"
              disabled={collectionRedeeming}
              onClick={() => void handleRedeemCollectionCode()}
              className="h-14 rounded-2xl bg-blue-600 px-8 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500 disabled:opacity-60"
            >
              {collectionRedeeming ? "兑换中..." : "立即兑换"}
            </button>
          </div>

          {collectionValidation ? (
            <div
              className={`mt-4 rounded-2xl border px-5 py-4 text-sm ${
                collectionValidation.valid ? "border-emerald-100 bg-emerald-50/50 text-emerald-700" : "border-rose-100 bg-rose-50/50 text-rose-700"
              }`}
            >
              <div className="font-black">{collectionValidation.message}</div>
              {collectionValidation.valid ? (
                <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <div>合集：{collectionValidation.collection_title || `#${collectionValidation.collection_id || "-"}`}</div>
                  <div>到账次数：{collectionValidation.granted_download_times || 0}</div>
                  <div>
                    可兑换用户：{collectionValidation.used_redeem_users || 0}/{collectionValidation.max_redeem_users || 0}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {collectionMessage ? (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold text-blue-700">
              {collectionMessage}
            </div>
          ) : null}

          {latestCollectionRedeem ? (
            <div className="mt-4 rounded-2xl border border-indigo-100 bg-white px-5 py-4 text-sm text-slate-700">
              <div className="font-black text-indigo-700">本次次卡兑换成功</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div>合集：{latestCollectionRedeem.collection_title || "-"}</div>
                <div>本次到账：{latestCollectionRedeem.granted_download_times || 0}</div>
                <div>剩余次数：{latestCollectionRedeem.remaining_download_times || 0}</div>
                <div>兑换码：{latestCollectionRedeem.code_mask || "-"}</div>
                <div className="sm:col-span-2">过期时间：{formatTime(latestCollectionRedeem.expires_at)}</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-blue-100 bg-white">
          <div className="flex items-center justify-between border-b border-blue-50 px-5 py-3 text-sm font-black text-slate-700">
            <span>我的次卡兑换流水</span>
            {collectionRedeemRecordsLoading ? <span className="text-xs font-semibold text-slate-400">加载中...</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-blue-50/40 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-3">兑换时间</th>
                  <th className="px-5 py-3">兑换码</th>
                  <th className="px-5 py-3">合集</th>
                  <th className="px-5 py-3">到账次数</th>
                  <th className="px-5 py-3">过期时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {collectionRedeemRecords.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">{formatTime(item.created_at)}</td>
                    <td className="px-5 py-3 font-semibold tracking-wider text-slate-700">{item.code_mask || "-"}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{item.collection_title || `合集 #${item.collection_id}`}</td>
                    <td className="px-5 py-3 font-black text-blue-600">{item.granted_download_times || 0}</td>
                    <td className="px-5 py-3">{formatTime(item.expires_at)}</td>
                  </tr>
                ))}
                {collectionRedeemRecords.length === 0 && !collectionRedeemRecordsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      暂无次卡兑换流水
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {collectionMessage && !collectionValidation ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm font-bold text-blue-700">
            <Info size={16} />
            {collectionMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
