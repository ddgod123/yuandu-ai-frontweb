"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API_BASE, clearAuthSession, fetchWithAuthRetry } from "@/lib/auth-client";
import {
  Crown, 
  Ticket, 
  CheckCircle2, 
  History, 
  Zap, 
  ShieldCheck, 
  Info,
  Calendar,
  AlertCircle,
  Users
} from "lucide-react";

type Profile = {
  display_name?: string;
  avatar_url?: string;
  phone?: string;
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

type RedeemValidateResponse = {
  valid: boolean;
  message: string;
  code_mask?: string;
  plan?: string;
  duration_days?: number;
  starts_at?: string;
  expires_at?: string;
  status?: string;
};

type RedeemSubmitResponse = {
  error?: string;
  message?: string;
  user?: Profile;
  plan?: string;
  starts_at?: string;
  expires_at?: string;
  duration_days?: number;
  code_mask?: string;
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

type CollectionDownloadEntitlement = {
  id: number;
  collection_id: number;
  collection_title?: string;
  granted_download_times?: number;
  used_download_times?: number;
  remaining_download_times?: number;
  status?: string;
  expires_at?: string;
  last_consumed_at?: string;
};

type CollectionDownloadEntitlementResponse = {
  items?: CollectionDownloadEntitlement[];
};

type LatestRedeemCard = {
  code_mask?: string;
  plan?: string;
  duration_days?: number;
  starts_at?: string;
  expires_at?: string;
};

type LatestCollectionRedeemCard = {
  code_mask?: string;
  collection_title?: string;
  granted_download_times?: number;
  remaining_download_times?: number;
  expires_at?: string;
};

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/adventurer/svg?seed=emoji";
const USER_LEVEL_LABELS: Record<string, string> = {
  free: "基础用户",
  subscriber: "订阅会员",
  member: "订阅会员",
  pro: "高级会员",
  enterprise: "企业会员",
};

const PLAN_LABELS: Record<string, string> = {
  none: "未开通",
  subscriber: "订阅会员",
  vip_monthly: "月度会员",
  vip_quarterly: "季度会员",
  vip_yearly: "年度会员",
  trial: "体验版",
  monthly: "月度会员",
  quarterly: "季度会员",
  yearly: "年度会员",
  annual: "年度会员",
  lifetime: "终身会员",
};

type StatusMeta = {
  label: string;
  dotClassName: string;
  badgeClassName: string;
};

const STATUS_META_MAP: Record<string, StatusMeta> = {
  inactive: {
    label: "未开通",
    dotClassName: "bg-slate-300",
    badgeClassName: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  },
  active: {
    label: "生效中",
    dotClassName: "bg-emerald-500 animate-pulse",
    badgeClassName: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  },
  expired: {
    label: "已过期",
    dotClassName: "bg-rose-400",
    badgeClassName: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
  },
  grace: {
    label: "宽限期",
    dotClassName: "bg-amber-400 animate-pulse",
    badgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  },
  cancelled: {
    label: "已取消",
    dotClassName: "bg-slate-400",
    badgeClassName: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  },
  paused: {
    label: "已暂停",
    dotClassName: "bg-slate-400",
    badgeClassName: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  },
};

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString() : "-";
}

function normalizeKey(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getUserLevelLabel(userLevel?: string, isSubscriber = false) {
  const key = normalizeKey(userLevel);
  if (key && USER_LEVEL_LABELS[key]) return USER_LEVEL_LABELS[key];
  if (isSubscriber) return "订阅会员";
  return "基础用户";
}

function getPlanLabel(plan?: string, isSubscriber = false) {
  const key = normalizeKey(plan);
  if (key && PLAN_LABELS[key]) return PLAN_LABELS[key];
  if (!key) return isSubscriber ? "会员计划" : "未开通";
  return plan || "未开通";
}

function getStatusMeta(status?: string, isSubscriber = false): StatusMeta {
  const key = normalizeKey(status);
  if (key && STATUS_META_MAP[key]) return STATUS_META_MAP[key];
  if (!key) return isSubscriber ? STATUS_META_MAP.active : STATUS_META_MAP.inactive;
  return {
    label: status || "未知状态",
    dotClassName: "bg-slate-300",
    badgeClassName: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };
}

function getRemainingDays(expiresAt?: string) {
  if (!expiresAt) return null;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = parsed.getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export default function SubscriptionPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [validation, setValidation] = useState<RedeemValidateResponse | null>(null);
  const [latestRedeem, setLatestRedeem] = useState<LatestRedeemCard | null>(null);
  const [redeemRecords, setRedeemRecords] = useState<RedeemRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [collectionCode, setCollectionCode] = useState("");
  const [collectionValidating, setCollectionValidating] = useState(false);
  const [collectionRedeeming, setCollectionRedeeming] = useState(false);
  const [collectionValidation, setCollectionValidation] = useState<CollectionCodeValidateResponse | null>(null);
  const [latestCollectionRedeem, setLatestCollectionRedeem] = useState<LatestCollectionRedeemCard | null>(null);
  const [collectionEntitlements, setCollectionEntitlements] = useState<CollectionDownloadEntitlement[]>([]);
  const [collectionEntitlementsLoading, setCollectionEntitlementsLoading] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const avatarPreview = useMemo(() => {
    const raw = (profile?.avatar_url || "").trim();
    return raw || DEFAULT_AVATAR;
  }, [profile?.avatar_url]);

  const isSubscriber = Boolean(profile?.is_subscriber);
  const userLevelLabel = useMemo(
    () => getUserLevelLabel(profile?.user_level, isSubscriber),
    [isSubscriber, profile?.user_level]
  );
  const planLabel = useMemo(
    () => getPlanLabel(profile?.subscription_plan, isSubscriber),
    [isSubscriber, profile?.subscription_plan]
  );
  const statusMeta = useMemo(
    () => getStatusMeta(profile?.subscription_status, isSubscriber),
    [isSubscriber, profile?.subscription_status]
  );
  const remainingDays = useMemo(
    () => getRemainingDays(profile?.subscription_expires_at),
    [profile?.subscription_expires_at]
  );

  const loadProfile = useCallback(async () => {
    const res = await fetchWithAuthRetry(`${API_BASE}/me`);
    if (res.status === 401) {
      clearAuthSession();
      router.replace("/login");
      return false;
    }
    if (!res.ok) {
      return false;
    }
    const data = (await res.json()) as Profile;
    setProfile(data);
    return true;
  }, [router]);

  const loadRedeemRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/redeem-records?page=1&page_size=20`);
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
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
  }, [router]);

  const loadCollectionEntitlements = useCallback(async () => {
    setCollectionEntitlementsLoading(true);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/collection-download-entitlements?page=1&page_size=50`);
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setCollectionEntitlements([]);
        return;
      }
      const data = (await res.json()) as CollectionDownloadEntitlementResponse;
      setCollectionEntitlements(Array.isArray(data.items) ? data.items : []);
    } catch {
      setCollectionEntitlements([]);
    } finally {
      setCollectionEntitlementsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await loadProfile();
        if (!loaded) {
          setMessage("加载订阅信息失败，请稍后重试");
          return;
        }
        await loadRedeemRecords();
        await loadCollectionEntitlements();
      } catch {
        setMessage("加载订阅信息失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loadCollectionEntitlements, loadProfile, loadRedeemRecords]);

  const handleValidate = async () => {
    const code = redeemCode.trim();
    if (!code) {
      setMessage("请输入兑换码");
      return;
    }
    setValidating(true);
    setMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/redeem-code/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as RedeemValidateResponse & { error?: string };
      if (!res.ok) {
        setMessage(data?.error || "验证失败，请稍后重试");
        return;
      }
      setValidation(data);
      setMessage(data.message || (data.valid ? "兑换码可用" : "兑换码不可用"));
    } catch {
      setMessage("验证失败，请稍后重试");
    } finally {
      setValidating(false);
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
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as RedeemSubmitResponse;
      if (!res.ok) {
        setMessage(data?.error || "兑换失败，请稍后重试");
        return;
      }
      if (data.user) {
        setProfile(data.user);
      }
      setLatestRedeem({
        code_mask: data.code_mask,
        plan: data.plan,
        duration_days: data.duration_days,
        starts_at: data.starts_at,
        expires_at: data.expires_at,
      });
      setValidation(null);
      setRedeemCode("");
      setMessage(data?.message || "兑换成功");
      await loadProfile();
      await loadRedeemRecords();
    } catch {
      setMessage("兑换失败，请稍后重试");
    } finally {
      setRedeeming(false);
    }
  };

  const handleValidateCollectionCode = async () => {
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
        setCollectionMessage(data?.error || "验证失败，请稍后重试");
        return;
      }
      setCollectionValidation(data);
      setCollectionMessage(data.message || (data.valid ? "兑换码可用" : "兑换码不可用"));
    } catch {
      setCollectionMessage("验证失败，请稍后重试");
    } finally {
      setCollectionValidating(false);
    }
  };

  const handleRedeemCollectionCode = async () => {
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
        setCollectionMessage(data?.error || "兑换失败，请稍后重试");
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
      setCollectionMessage(data?.message || "兑换成功");
      await loadCollectionEntitlements();
    } catch {
      setCollectionMessage("兑换失败，请稍后重试");
    } finally {
      setCollectionRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-[2.5rem] border border-slate-100 bg-white p-10 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-emerald-500" />
          <p className="text-sm font-bold text-slate-400 tracking-wider">正在加载订阅信息...</p>
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
          {/* 头部用户信息 */}
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[1.5rem] bg-slate-100 ring-4 ring-white shadow-lg">
              <div className="relative h-full w-full">
                <Image src={avatarPreview} alt="avatar" fill unoptimized className="object-cover" />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">订阅管理</h1>
              <p className="text-sm font-bold text-slate-400">
                账号：<span className="text-slate-600">{profile?.display_name || "用户"}</span>
                <span className="mx-2 text-slate-200">|</span>
                手机：<span className="text-slate-600">{profile?.phone || "未绑定"}</span>
              </p>
            </div>
            {isSubscriber && (
              <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-amber-600 ring-1 ring-amber-200">
                <Crown size={18} className="fill-amber-500" />
                <span className="text-sm font-black">{userLevelLabel}</span>
              </div>
            )}
          </div>

          {/* 当前订阅状态卡片 */}
          <div className="mt-10 overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-8 md:p-10 shadow-sm relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 transition-transform group-hover:scale-110 group-hover:rotate-12">
              <Zap size={120} className="text-emerald-500" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                  <Zap size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">当前订阅权益</h2>
                  <p className="text-xs font-bold text-emerald-600/60 uppercase tracking-widest">Current Subscription Benefits</p>
                </div>
              </div>
              
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <Users size={14} /> 用户等级
                  </div>
                  <div className="text-xl font-black text-slate-900">{userLevelLabel}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <Crown size={14} /> 订阅计划
                  </div>
                  <div className="text-xl font-black text-slate-900">{planLabel}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <ShieldCheck size={14} /> 订阅状态
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${statusMeta.dotClassName}`} />
                    <div className={`inline-flex items-center rounded-xl px-3 py-1 text-sm font-black ${statusMeta.badgeClassName}`}>
                      {statusMeta.label}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <Calendar size={14} /> 有效期至
                  </div>
                  <div className="space-y-1">
                    <div className="text-xl font-black text-slate-900">{formatTime(profile?.subscription_expires_at).split(' ')[0]}</div>
                    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                      remainingDays === null ? "bg-slate-100 text-slate-400" : remainingDays >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500"
                    }`}>
                      {remainingDays === null
                        ? "暂无有效期信息"
                        : remainingDays >= 0
                          ? `剩余 ${remainingDays} 天`
                          : `已过期 ${Math.abs(remainingDays)} 天`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 兑换专区 */}
          <div className="mt-10 relative group">
            <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-emerald-500/20 to-blue-500/20 blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative rounded-[2.5rem] border border-slate-200 bg-white p-8 md:p-10 shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                      <Ticket size={24} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">兑换专区</h2>
                  </div>
                  <p className="text-sm font-medium text-slate-400 max-w-md">
                    输入您的 16 位兑换码以快速解锁高级合集下载权限或延长您的会员订阅时长。
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row items-stretch">
                <div className="relative flex-1 group/input">
                  <input
                    value={redeemCode}
                    onChange={(event) => {
                      setRedeemCode(event.target.value);
                      setValidation(null);
                    }}
                    placeholder="请输入 16 位兑换码"
                    className="h-16 w-full rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-6 text-lg font-black tracking-[0.2em] text-slate-900 outline-none transition-all placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-8 focus:ring-emerald-500/5"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={validating}
                    onClick={handleValidate}
                    className="h-16 px-8 rounded-2xl border-2 border-slate-100 bg-white text-base font-black text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-200 active:scale-95 disabled:opacity-60"
                  >
                    {validating ? "验证中..." : "验证"}
                  </button>
                  <button
                    type="button"
                    disabled={redeeming}
                    onClick={handleRedeem}
                    className="h-16 px-10 rounded-2xl bg-slate-900 text-base font-black text-white shadow-xl shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-1 active:translate-y-0 disabled:opacity-60"
                  >
                    {redeeming ? "立即兑换" : "立即兑换"}
                  </button>
                </div>
              </div>

              {validation && (
                <div className={`mt-8 animate-in fade-in slide-in-from-top-2 rounded-2xl border-2 p-6 ${
                  validation.valid ? "border-emerald-100 bg-emerald-50/30" : "border-rose-100 bg-rose-50/30"
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    {validation.valid ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-rose-500" />}
                    <span className={`text-base font-black ${validation.valid ? "text-emerald-700" : "text-rose-700"}`}>
                      {validation.message}
                    </span>
                  </div>
                  {validation.valid && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-emerald-100/50">
                      <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600/50">计划类型</div>
                        <div className="text-base font-black text-slate-900">{getPlanLabel(validation.plan, true)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600/50">增加时长</div>
                        <div className="text-base font-black text-emerald-600">+{validation.duration_days || 0} 天</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600/50">生效时间</div>
                        <div className="text-base font-black text-slate-900">{formatTime(validation.starts_at).split(' ')[0]}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600/50">到期时间</div>
                        <div className="text-base font-black text-slate-900">{formatTime(validation.expires_at).split(' ')[0]}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 合集次卡兑换 */}
          <div className="mt-8 rounded-[2.5rem] border border-blue-100 bg-blue-50/30 p-8 md:p-10">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white shadow-md shadow-blue-200">
                <Ticket size={18} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">合集次卡兑换</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-600/60">
                  Collection Download Card
                </p>
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
                onClick={handleValidateCollectionCode}
                className="h-14 rounded-2xl border border-blue-200 bg-white px-6 text-sm font-black text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
              >
                {collectionValidating ? "验证中..." : "验证"}
              </button>
              <button
                type="button"
                disabled={collectionRedeeming}
                onClick={handleRedeemCollectionCode}
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

            <div className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white">
              <div className="border-b border-blue-50 px-5 py-3 text-sm font-black text-slate-700">我的合集次卡权益</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-blue-50/40 text-xs uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="px-5 py-3">合集</th>
                      <th className="px-5 py-3">总次数</th>
                      <th className="px-5 py-3">已用</th>
                      <th className="px-5 py-3">剩余</th>
                      <th className="px-5 py-3">状态</th>
                      <th className="px-5 py-3">过期时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {collectionEntitlements.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-3 font-semibold text-slate-700">
                          {item.collection_title || `合集 #${item.collection_id}`}
                        </td>
                        <td className="px-5 py-3">{item.granted_download_times || 0}</td>
                        <td className="px-5 py-3">{item.used_download_times || 0}</td>
                        <td className="px-5 py-3 font-black text-blue-600">{item.remaining_download_times || 0}</td>
                        <td className="px-5 py-3">{item.status || "-"}</td>
                        <td className="px-5 py-3">{formatTime(item.expires_at)}</td>
                      </tr>
                    ))}
                    {collectionEntitlements.length === 0 && !collectionEntitlementsLoading ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                          暂无合集次卡权益
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 本次兑换结果 */}
          {latestRedeem && (
            <div className="mt-8 animate-in zoom-in-95 rounded-[2.5rem] border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <CheckCircle2 size={120} className="text-indigo-500" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-200">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">本次兑换成功</h2>
                    <p className="text-xs font-bold text-indigo-600/60 uppercase tracking-widest">Successful Redemption</p>
                  </div>
                </div>
                <div className="grid gap-8 sm:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600/40">兑换码</div>
                    <div className="text-xl font-black text-slate-900 tracking-wider">{latestRedeem.code_mask || "-"}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600/40">增加时长</div>
                    <div className="text-xl font-black text-indigo-600">+{latestRedeem.duration_days || 0} 天</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600/40">新有效期至</div>
                    <div className="text-xl font-black text-slate-900">{formatTime(latestRedeem.expires_at).split(' ')[0]}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 权益对比 */}
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-10 transition-all hover:shadow-xl hover:border-slate-300">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-slate-300" />
                    免费用户
                  </h3>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Basic</span>
                </div>
                <ul className="space-y-4">
                  {[
                    "浏览和搜索全部公开合集",
                    "支持下载单张表情图片",
                    "支持点赞、收藏与分享"
                  ].map(item => (
                    <li key={item} className="flex items-center gap-4 text-sm font-bold text-slate-500">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                        <ShieldCheck size={14} />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-[2.5rem] border-2 border-emerald-500 bg-emerald-50/20 p-10 transition-all hover:shadow-2xl hover:shadow-emerald-500/10">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl transition-all group-hover:bg-emerald-500/20" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-emerald-600 flex items-center gap-3">
                    <Crown size={24} className="fill-emerald-500" />
                    订阅会员
                  </h3>
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Premium</span>
                </div>
                <ul className="space-y-4">
                  {[
                    "包含免费用户全部权益",
                    "支持一键下载合集 ZIP 包",
                    "专属极速下载通道，无需等待",
                    "通过兑换码快速开通与续期"
                  ].map(item => (
                    <li key={item} className="flex items-center gap-4 text-sm font-bold text-emerald-800">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                        <CheckCircle2 size={14} />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 兑换记录 */}
          <div className="mt-12 space-y-6">
            <div className="flex items-center justify-between px-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-3 text-2xl font-black text-slate-900">
                  <History size={24} className="text-slate-400" />
                  我的兑换记录
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Redemption History</p>
              </div>
              {recordsLoading && <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />}
            </div>

            <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">兑换码</th>
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">计划类型</th>
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">有效期至</th>
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">兑换时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {redeemRecords.map((item) => (
                      <tr key={item.id} className="group transition-colors hover:bg-slate-50/50">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                              <Ticket size={16} />
                            </div>
                            <span className="text-base font-black text-slate-700 tracking-wider">{item.code_mask || "-"}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600 ring-1 ring-emerald-100">
                            {getPlanLabel(item.granted_plan, true)}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-700">{formatTime(item.granted_expires_at).split(' ')[0]}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Expires At</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-slate-400">{formatTime(item.created_at).split(' ')[0]}</span>
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{formatTime(item.created_at).split(' ')[1]}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {redeemRecords.length === 0 && !recordsLoading && (
                      <tr>
                        <td className="px-8 py-20 text-center" colSpan={4}>
                          <div className="flex flex-col items-center gap-4 opacity-20">
                            <div className="h-20 w-20 flex items-center justify-center rounded-[2rem] bg-slate-100 text-slate-400">
                              <History size={48} />
                            </div>
                            <p className="text-lg font-black tracking-widest text-slate-400">暂无兑换记录</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 底部提示 */}
          {message && !validation && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 flex items-center gap-4 rounded-[2rem] border-2 border-slate-100 bg-slate-50/50 px-6 py-5 text-sm font-black text-slate-600">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm text-slate-400">
                <Info size={18} />
              </div>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
