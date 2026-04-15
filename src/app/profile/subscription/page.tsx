"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API_BASE, clearAuthSession, fetchWithAuthRetry } from "@/lib/auth-client";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Crown,
  History,
  Info,
  ShieldCheck,
  Ticket,
  Users,
  Zap,
} from "lucide-react";

type Profile = {
  display_name?: string;
  avatar_url?: string;
  phone?: string;
  user_level?: string;
  subscription_status?: string;
  subscription_plan?: string;
  subscription_expires_at?: string;
  is_subscriber?: boolean;
};

type RedeemRecord = {
  id: number;
  code_mask?: string;
  granted_plan?: string;
  granted_expires_at?: string;
  created_at?: string;
};

type RedeemRecordResponse = {
  items?: RedeemRecord[];
};

type RedeemValidateResponse = {
  valid: boolean;
  message: string;
  plan?: string;
  duration_days?: number;
  starts_at?: string;
  expires_at?: string;
};

type RedeemSubmitResponse = {
  error?: string;
  message?: string;
  user?: Profile;
  code_mask?: string;
  plan?: string;
  duration_days?: number;
  starts_at?: string;
  expires_at?: string;
};

type LatestRedeemCard = {
  code_mask?: string;
  plan?: string;
  duration_days?: number;
  starts_at?: string;
  expires_at?: string;
};

type StatusMeta = {
  label: string;
  dotClassName: string;
  badgeClassName: string;
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
};

function normalizeKey(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function formatTime(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("zh-CN");
}

function formatDate(value?: string) {
  const text = formatTime(value);
  if (text === "-") return "-";
  return text.split(" ")[0] || text;
}

function getRemainingDays(expiresAt?: string) {
  if (!expiresAt) return null;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = parsed.getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
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
    if (!res.ok) return false;
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

  useEffect(() => {
    const load = async () => {
      try {
        const ok = await loadProfile();
        if (!ok) {
          setMessage("加载订阅信息失败，请稍后重试");
          return;
        }
        await loadRedeemRecords();
      } catch {
        setMessage("加载订阅信息失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadProfile, loadRedeemRecords]);

  const handleValidate = useCallback(async () => {
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
        setMessage(data.error || "验证失败，请稍后重试");
        return;
      }
      setValidation(data);
      setMessage(data.message || (data.valid ? "兑换码可用" : "兑换码不可用"));
    } catch {
      setMessage("验证失败，请稍后重试");
    } finally {
      setValidating(false);
    }
  }, [redeemCode, router]);

  const handleRedeem = useCallback(async () => {
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
        setMessage(data.error || "兑换失败，请稍后重试");
        return;
      }

      if (data.user) setProfile(data.user);
      setLatestRedeem({
        code_mask: data.code_mask,
        plan: data.plan,
        duration_days: data.duration_days,
        starts_at: data.starts_at,
        expires_at: data.expires_at,
      });
      setValidation(null);
      setRedeemCode("");
      setMessage(data.message || "兑换成功");

      await loadProfile();
      await loadRedeemRecords();
    } catch {
      setMessage("兑换失败，请稍后重试");
    } finally {
      setRedeeming(false);
    }
  }, [loadProfile, loadRedeemRecords, redeemCode, router]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-[2.5rem] border border-slate-100 bg-white p-10 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-emerald-500" />
          <p className="text-sm font-bold tracking-wider text-slate-400">正在加载订阅信息...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-50/50 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-blue-50/50 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-transparent shadow-lg">
              <div className="relative h-full w-full">
                <Image src={avatarPreview} alt="avatar" fill unoptimized className="rounded-full object-cover" />
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
            {isSubscriber ? (
              <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-amber-600 ring-1 ring-amber-200">
                <Crown size={18} className="fill-amber-500" />
                <span className="text-sm font-black">{userLevelLabel}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-10 overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-8 md:p-10">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                <Zap size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">当前订阅权益</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600/60">当前订阅信息</p>
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
                  <div className="text-xl font-black text-slate-900">{formatDate(profile?.subscription_expires_at)}</div>
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                      remainingDays === null
                        ? "bg-slate-100 text-slate-400"
                        : remainingDays >= 0
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-rose-100 text-rose-500"
                    }`}
                  >
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

          <div className="mt-10 rounded-[2.5rem] border border-slate-200 bg-white p-8 md:p-10 shadow-sm">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                <Ticket size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">订阅兑换码</h2>
                <p className="text-sm font-medium text-slate-400">输入订阅兑换码可开通或续期会员</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row items-stretch">
              <input
                value={redeemCode}
                onChange={(event) => {
                  setRedeemCode(event.target.value);
                  setValidation(null);
                }}
                placeholder="请输入 16 位兑换码"
                className="h-16 w-full flex-1 rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-6 text-lg font-black tracking-[0.2em] text-slate-900 outline-none transition-all placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:ring-8 focus:ring-emerald-500/5"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={validating}
                  onClick={() => void handleValidate()}
                  className="h-16 rounded-2xl border-2 border-slate-100 bg-white px-8 text-base font-black text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-60"
                >
                  {validating ? "验证中..." : "验证"}
                </button>
                <button
                  type="button"
                  disabled={redeeming}
                  onClick={() => void handleRedeem()}
                  className="h-16 rounded-2xl bg-slate-900 px-10 text-base font-black text-white shadow-xl shadow-slate-200 transition-all hover:bg-emerald-500 disabled:opacity-60"
                >
                  {redeeming ? "兑换中..." : "立即兑换"}
                </button>
              </div>
            </div>

            {validation ? (
              <div
                className={`mt-8 rounded-2xl border-2 p-6 ${
                  validation.valid ? "border-emerald-100 bg-emerald-50/30" : "border-rose-100 bg-rose-50/30"
                }`}
              >
                <div className="mb-4 flex items-center gap-3">
                  {validation.valid ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-rose-500" />}
                  <span className={`text-base font-black ${validation.valid ? "text-emerald-700" : "text-rose-700"}`}>
                    {validation.message}
                  </span>
                </div>
                {validation.valid ? (
                  <div className="grid grid-cols-2 gap-6 border-t border-emerald-100/50 pt-6 md:grid-cols-4">
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
                      <div className="text-base font-black text-slate-900">{formatDate(validation.starts_at)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600/50">到期时间</div>
                      <div className="text-base font-black text-slate-900">{formatDate(validation.expires_at)}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {latestRedeem ? (
            <div className="mt-8 rounded-[2.5rem] border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-8 md:p-10">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-200">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">本次兑换成功</h2>
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-600/60">兑换结果</p>
                </div>
              </div>
              <div className="grid gap-8 sm:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600/40">兑换码</div>
                  <div className="text-xl font-black tracking-wider text-slate-900">{latestRedeem.code_mask || "-"}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600/40">增加时长</div>
                  <div className="text-xl font-black text-indigo-600">+{latestRedeem.duration_days || 0} 天</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-indigo-600/40">新有效期至</div>
                  <div className="text-xl font-black text-slate-900">{formatDate(latestRedeem.expires_at)}</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-12 space-y-6">
            <div className="flex items-center justify-between px-4">
              <div className="space-y-1">
                <h3 className="flex items-center gap-3 text-2xl font-black text-slate-900">
                  <History size={24} className="text-slate-400" />
                  我的兑换记录
                </h3>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">订阅兑换记录</p>
              </div>
              {recordsLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" /> : null}
            </div>

            <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">兑换码</th>
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">计划类型</th>
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">有效期至</th>
                      <th className="px-8 py-5 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">兑换时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {redeemRecords.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-slate-50/50">
                        <td className="px-8 py-6 text-base font-black tracking-wider text-slate-700">{item.code_mask || "-"}</td>
                        <td className="px-8 py-6">
                          <span className="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600 ring-1 ring-emerald-100">
                            {getPlanLabel(item.granted_plan, true)}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-sm font-black text-slate-700">{formatDate(item.granted_expires_at)}</td>
                        <td className="px-8 py-6 text-right text-sm font-bold text-slate-400">{formatTime(item.created_at)}</td>
                      </tr>
                    ))}

                    {redeemRecords.length === 0 && !recordsLoading ? (
                      <tr>
                        <td className="px-8 py-16 text-center text-slate-400" colSpan={4}>
                          暂无订阅兑换记录
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {message && !validation ? (
            <div className="mt-8 flex items-center gap-4 rounded-[2rem] border-2 border-slate-100 bg-slate-50/50 px-6 py-5 text-sm font-black text-slate-600">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                <Info size={18} />
              </div>
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
