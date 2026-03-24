"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { API_BASE, getOrCreateDeviceID, saveAuthSession, type AuthSessionPayload } from "@/lib/auth-client";

type AuthResponse = {
  user?: { display_name?: string; phone?: string; avatar_url?: string };
  tokens?: AuthSessionPayload["tokens"];
  error?: string;
};

function formatAuthErrorMessage(status: number, rawError: string | undefined, fallback: string) {
  const normalized = (rawError || "").trim().toLowerCase();
  if (status === 429 || normalized.includes("too many requests")) {
    return "操作太频繁，请稍后再试";
  }
  if (normalized === "invalid credentials") {
    return "手机号或密码错误";
  }
  if (normalized === "user disabled") {
    return "账号状态异常，暂时无法登录";
  }
  if (normalized === "phone required") {
    return "请输入手机号";
  }
  if (normalized === "password required") {
    return "请输入登录密码";
  }
  return rawError || fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState("/");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = (new URLSearchParams(window.location.search).get("next") || "").trim();
    setNextPath(raw.startsWith("/") ? raw : "/");
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPhone = phone.trim();
    const trimmedPassword = password.trim();
    if (!trimmedPhone || !trimmedPassword) {
      setMessage("请输入手机号和密码");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const deviceID = getOrCreateDeviceID();
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmedPhone, password: trimmedPassword, device_id: deviceID }),
      });
      const data = (await res.json().catch(() => ({}))) as AuthResponse;
      if (!res.ok) {
        setMessage(formatAuthErrorMessage(res.status, data?.error, "登录失败"));
        return;
      }
      if (data?.tokens?.access_token) {
        saveAuthSession(data);
        router.replace(nextPath);
        return;
      }
      setMessage("登录失败，请稍后重试");
    } catch {
      setMessage("登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          {/* 左侧文案区 */}
          <div className="relative space-y-8">
            {/* 背景装饰 */}
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-50/50 blur-3xl" />
            
            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 ring-1 ring-emerald-100">
                <Sparkles size={14} className="animate-pulse" />
                登录档案馆
              </div>
              <h1 className="text-5xl font-black tracking-tight text-slate-900 md:text-6xl">
                一键登录，<br />
                <span className="text-emerald-500">立即开启</span>表情下载
              </h1>
              <p className="max-w-md text-lg font-medium leading-relaxed text-slate-500">
                使用手机号 + 登录密码即可登录。登录后可下载表情包合集与单张表情，记录你的每一份情绪。
              </p>
              
              <div className="grid gap-4 pt-4 sm:grid-cols-2">
                {[
                  { title: "免打扰登录", desc: "快速安全接入" },
                  { title: "下载更稳定", desc: "专属加速通道" },
                  { title: "权益清晰可见", desc: "订阅与次卡一目了然" },
                  { title: "收藏同步", desc: "多端数据互通" }
                ].map((item) => (
                  <div key={item.title} className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-emerald-100 hover:shadow-md hover:shadow-emerald-500/5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{item.title}</div>
                      <div className="text-[11px] font-medium text-slate-400">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧登录卡片 */}
          <div className="relative">
            {/* 卡片背景装饰 */}
            <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-blue-50/50 blur-3xl" />
            
            <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10">
              <div className="mb-10">
                <h2 className="text-3xl font-black tracking-tight text-slate-900">手机号登录</h2>
                <p className="mt-3 text-sm font-medium text-slate-500">欢迎回来，请输入您的账号信息</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">手机号</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="请输入手机号"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">登录密码</label>
                  <div className="relative">
                    <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="请输入登录密码"
                      autoComplete="current-password"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                {message && (
                  <div className="animate-in fade-in slide-in-from-top-1 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-500">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative h-14 w-full overflow-hidden rounded-2xl bg-slate-900 text-base font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:bg-slate-900 disabled:hover:translate-y-0"
                >
                  <span className="relative z-10">{loading ? "正在验证..." : "立即登录"}</span>
                </button>
              </form>

              <div className="mt-10 pt-8 border-t border-slate-100">
                <p className="text-center text-sm font-medium text-slate-400">
                  还没有账号？
                  <Link href="/register" className="ml-2 font-bold text-slate-900 hover:text-emerald-600 hover:underline">
                    立即注册
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
