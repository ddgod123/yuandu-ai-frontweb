"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE, clearAuthSession, fetchWithAuthRetry } from "@/lib/auth-client";
import { Info, Zap } from "lucide-react";

type Profile = {
  display_name?: string;
  avatar_url?: string;
  phone?: string;
};

type ComputeAccountSnapshot = {
  user_id?: number;
  available_points?: number;
  frozen_points?: number;
  debt_points?: number;
  total_consumed_points?: number;
  total_recharged_points?: number;
  point_per_cny?: number;
  cost_markup_multiplier?: number;
};

type ComputeLedgerItem = {
  id: number;
  job_id?: number;
  type?: string;
  points?: number;
  remark?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

type ComputeAccountSummaryResponse = {
  account?: ComputeAccountSnapshot;
  ledgers?: ComputeLedgerItem[];
};

type ComputeRedeemValidateResponse = {
  valid: boolean;
  message: string;
  code_mask?: string;
  granted_points?: number;
  duration_days?: number;
};

type ComputeRedeemSubmitResponse = {
  error?: string;
  message?: string;
  code_mask?: string;
  granted_points?: number;
  duration_days?: number;
  starts_at?: string;
  expires_at?: string;
  account?: ComputeAccountSnapshot;
};

type ComputeRedeemRecord = {
  id: number;
  code_mask?: string;
  granted_points?: number;
  granted_starts_at?: string;
  granted_expires_at?: string;
  created_at?: string;
};

type ComputeRedeemRecordResponse = {
  items?: ComputeRedeemRecord[];
};

type LatestComputeRedeemCard = {
  code_mask?: string;
  granted_points?: number;
  duration_days?: number;
  starts_at?: string;
  expires_at?: string;
  available_points?: number;
};

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/adventurer/svg?seed=emoji";

function normalizeKey(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function formatTime(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("zh-CN");
}

function pointHoldStatusLabel(value?: string) {
  const key = normalizeKey(value);
  switch (key) {
    case "settled":
      return "已结算";
    case "held":
      return "预冻结";
    case "released":
      return "已释放";
    case "cancelled":
      return "已取消";
    case "failed":
      return "失败";
    default:
      return value || "-";
  }
}

function getComputeLedgerTypeLabel(type?: string) {
  const key = normalizeKey(type);
  switch (key) {
    case "reserve":
      return "任务预扣";
    case "release":
      return "任务退回";
    case "settle":
      return "任务结算";
    case "adjust":
      return "兑换/调整";
    case "init_grant":
      return "初始赠送";
    default:
      return type || "-";
  }
}

export default function ComputeManagePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [computeAccount, setComputeAccount] = useState<ComputeAccountSnapshot | null>(null);
  const [computeLedgers, setComputeLedgers] = useState<ComputeLedgerItem[]>([]);
  const [computeRedeemRecords, setComputeRedeemRecords] = useState<ComputeRedeemRecord[]>([]);
  const [computeRedeemCode, setComputeRedeemCode] = useState("");
  const [computeValidating, setComputeValidating] = useState(false);
  const [computeRedeeming, setComputeRedeeming] = useState(false);
  const [computeValidation, setComputeValidation] = useState<ComputeRedeemValidateResponse | null>(null);
  const [latestComputeRedeem, setLatestComputeRedeem] = useState<LatestComputeRedeemCard | null>(null);
  const [computeRecordsLoading, setComputeRecordsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [computeMessage, setComputeMessage] = useState<string | null>(null);

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

  const loadComputeAccount = useCallback(async () => {
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/compute-account?limit=30`);
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setComputeAccount(null);
        setComputeLedgers([]);
        return;
      }
      const data = (await res.json()) as ComputeAccountSummaryResponse;
      setComputeAccount(data.account || null);
      setComputeLedgers(Array.isArray(data.ledgers) ? data.ledgers : []);
    } catch {
      setComputeAccount(null);
      setComputeLedgers([]);
    }
  }, [router]);

  const loadComputeRedeemRecords = useCallback(async () => {
    setComputeRecordsLoading(true);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/compute-redeem-records?page=1&page_size=20`);
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setComputeRedeemRecords([]);
        return;
      }
      const data = (await res.json()) as ComputeRedeemRecordResponse;
      setComputeRedeemRecords(Array.isArray(data.items) ? data.items : []);
    } catch {
      setComputeRedeemRecords([]);
    } finally {
      setComputeRecordsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const load = async () => {
      try {
        const ok = await loadProfile();
        if (!ok) {
          setComputeMessage("加载算力信息失败，请稍后重试");
          return;
        }
        await loadComputeAccount();
        await loadComputeRedeemRecords();
      } catch {
        setComputeMessage("加载算力信息失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadComputeAccount, loadComputeRedeemRecords, loadProfile]);

  const handleValidateComputeCode = useCallback(async () => {
    const code = computeRedeemCode.trim();
    if (!code) {
      setComputeMessage("请输入算力兑换码");
      return;
    }

    setComputeValidating(true);
    setComputeMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/compute-redeem-code/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as ComputeRedeemValidateResponse & { error?: string };
      if (!res.ok) {
        setComputeMessage(data.error || "验证失败，请稍后重试");
        return;
      }
      setComputeValidation(data);
      setComputeMessage(data.message || (data.valid ? "兑换码可用" : "兑换码不可用"));
    } catch {
      setComputeMessage("验证失败，请稍后重试");
    } finally {
      setComputeValidating(false);
    }
  }, [computeRedeemCode, router]);

  const handleRedeemComputeCode = useCallback(async () => {
    const code = computeRedeemCode.trim();
    if (!code) {
      setComputeMessage("请输入算力兑换码");
      return;
    }

    setComputeRedeeming(true);
    setComputeMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/compute-redeem-code/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.status === 401) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      const data = (await res.json()) as ComputeRedeemSubmitResponse;
      if (!res.ok) {
        setComputeMessage(data.error || "兑换失败，请稍后重试");
        return;
      }

      setLatestComputeRedeem({
        code_mask: data.code_mask,
        granted_points: data.granted_points,
        duration_days: data.duration_days,
        starts_at: data.starts_at,
        expires_at: data.expires_at,
        available_points: data.account?.available_points,
      });
      setComputeValidation(null);
      setComputeRedeemCode("");
      setComputeMessage(data.message || "兑换成功");
      if (data.account) setComputeAccount(data.account);

      await loadComputeAccount();
      await loadComputeRedeemRecords();
    } catch {
      setComputeMessage("兑换失败，请稍后重试");
    } finally {
      setComputeRedeeming(false);
    }
  }, [computeRedeemCode, loadComputeAccount, loadComputeRedeemRecords, router]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-[2.5rem] border border-slate-100 bg-white p-10 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-t-violet-500" />
          <p className="text-sm font-bold tracking-wider text-slate-400">正在加载算力信息...</p>
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
            <h1 className="text-3xl font-black tracking-tight text-slate-900">算力管理</h1>
            <p className="mt-1 text-sm font-bold text-slate-400">
              账号：<span className="text-slate-600">{profile?.display_name || "用户"}</span>
              <span className="mx-2 text-slate-200">|</span>
              手机：<span className="text-slate-600">{profile?.phone || "未绑定"}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 rounded-3xl border border-violet-100 bg-violet-50/40 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-violet-500/70">可用算力</div>
            <div className="mt-2 text-2xl font-black text-violet-700">{computeAccount?.available_points ?? 0}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-violet-500/70">冻结算力</div>
            <div className="mt-2 text-2xl font-black text-slate-800">{computeAccount?.frozen_points ?? 0}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-violet-500/70">累计消耗</div>
            <div className="mt-2 text-2xl font-black text-slate-800">{computeAccount?.total_consumed_points ?? 0}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-violet-500/70">计费倍率</div>
            <div className="mt-2 text-2xl font-black text-slate-800">{computeAccount?.cost_markup_multiplier || 2}x</div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-violet-100 bg-violet-50/20 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-md shadow-violet-200">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">算力点兑换</h2>
              <p className="text-xs font-bold text-violet-500/70">使用兑换码增加算力点</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={computeRedeemCode}
              onChange={(event) => {
                setComputeRedeemCode(event.target.value);
                setComputeValidation(null);
              }}
              placeholder="输入算力兑换码"
              className="h-14 flex-1 rounded-2xl border border-violet-100 bg-white px-5 text-base font-bold tracking-wider text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
            />
            <button
              type="button"
              disabled={computeValidating}
              onClick={() => void handleValidateComputeCode()}
              className="h-14 rounded-2xl border border-violet-200 bg-white px-6 text-sm font-black text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
            >
              {computeValidating ? "验证中..." : "验证"}
            </button>
            <button
              type="button"
              disabled={computeRedeeming}
              onClick={() => void handleRedeemComputeCode()}
              className="h-14 rounded-2xl bg-violet-600 px-8 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-500 disabled:opacity-60"
            >
              {computeRedeeming ? "兑换中..." : "立即兑换"}
            </button>
          </div>

          {computeValidation ? (
            <div
              className={`mt-4 rounded-2xl border px-5 py-4 text-sm ${
                computeValidation.valid ? "border-emerald-100 bg-emerald-50/50 text-emerald-700" : "border-rose-100 bg-rose-50/50 text-rose-700"
              }`}
            >
              <div className="font-black">{computeValidation.message}</div>
              {computeValidation.valid ? (
                <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <div>到账算力：{computeValidation.granted_points || 0}</div>
                  <div>兑换码：{computeValidation.code_mask || "-"}</div>
                  <div>
                    有效期：
                    {computeValidation.duration_days && computeValidation.duration_days > 0 ? `${computeValidation.duration_days} 天` : "不限制"}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {computeMessage ? (
            <div className="mt-4 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-bold text-violet-700">
              {computeMessage}
            </div>
          ) : null}

          {latestComputeRedeem ? (
            <div className="mt-4 rounded-2xl border border-violet-100 bg-white px-5 py-4 text-sm text-slate-700">
              <div className="font-black text-violet-700">本次算力兑换成功</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div>兑换码：{latestComputeRedeem.code_mask || "-"}</div>
                <div>本次到账：{latestComputeRedeem.granted_points || 0}</div>
                <div>当前可用：{latestComputeRedeem.available_points ?? computeAccount?.available_points ?? 0}</div>
                <div>生效时间：{formatTime(latestComputeRedeem.starts_at)}</div>
                <div className="sm:col-span-2">
                  到期时间：{latestComputeRedeem.expires_at ? formatTime(latestComputeRedeem.expires_at) : "不限制"}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-violet-100 bg-white">
          <div className="flex items-center justify-between border-b border-violet-50 px-5 py-3 text-sm font-black text-slate-700">
            <span>我的算力兑换记录</span>
            {computeRecordsLoading ? <span className="text-xs font-semibold text-slate-400">加载中...</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-violet-50/40 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-3">兑换码</th>
                  <th className="px-5 py-3">到账算力</th>
                  <th className="px-5 py-3">生效时间</th>
                  <th className="px-5 py-3">到期时间</th>
                  <th className="px-5 py-3">兑换时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-50">
                {computeRedeemRecords.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3 font-semibold text-slate-700">{item.code_mask || "-"}</td>
                    <td className="px-5 py-3 font-black text-violet-600">{item.granted_points || 0}</td>
                    <td className="px-5 py-3">{formatTime(item.granted_starts_at)}</td>
                    <td className="px-5 py-3">{item.granted_expires_at ? formatTime(item.granted_expires_at) : "不限制"}</td>
                    <td className="px-5 py-3">{formatTime(item.created_at)}</td>
                  </tr>
                ))}
                {computeRedeemRecords.length === 0 && !computeRecordsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      暂无算力兑换记录
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-violet-100 bg-white">
          <div className="border-b border-violet-50 px-5 py-3 text-sm font-black text-slate-700">最近算力流水（含任务消耗）</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-violet-50/40 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-3">类型</th>
                  <th className="px-5 py-3">点数变动</th>
                  <th className="px-5 py-3">任务</th>
                  <th className="px-5 py-3">说明</th>
                  <th className="px-5 py-3">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-50">
                {computeLedgers.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">{getComputeLedgerTypeLabel(item.type)}</td>
                    <td className={`px-5 py-3 font-black ${Number(item.points || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {Number(item.points || 0) >= 0 ? "+" : ""}
                      {item.points || 0}
                    </td>
                    <td className="px-5 py-3">
                      {item.job_id ? (
                        <div className="space-y-0.5">
                          <Link href={`/mine/works/${item.job_id}`} className="font-semibold text-violet-700 hover:text-violet-600">
                            任务 #{item.job_id}
                          </Link>
                          <div className="text-xs text-slate-400">
                            {pointHoldStatusLabel(String(item.metadata?.hold_status || item.remark || "").trim())}
                          </div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-5 py-3">{item.remark || "-"}</td>
                    <td className="px-5 py-3">{formatTime(item.created_at)}</td>
                  </tr>
                ))}
                {computeLedgers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      暂无算力流水
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {computeMessage && !computeValidation ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-3 text-sm font-bold text-violet-700">
            <Info size={16} />
            {computeMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
