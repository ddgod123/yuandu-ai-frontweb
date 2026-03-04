"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Phone, UserPlus } from "lucide-react";
import { API_BASE, saveAuthSession, type AuthSessionPayload } from "@/lib/auth-client";

type AuthResponse = {
  user?: { display_name?: string; phone?: string; avatar_url?: string };
  tokens?: AuthSessionPayload["tokens"];
  error?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      setMessage("请输入手机号");
      return;
    }
    setSending(true);
    setMessage(null);
    setHint(null);
    try {
      const res = await fetch(`${API_BASE}/auth/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "验证码发送失败");
        return;
      }
      setCooldown(60);
      if (data?.mock && data?.code) {
        setHint(`测试验证码：${data.code}`);
      } else {
        setHint("验证码已发送，请注意查收");
      }
    } catch {
      setMessage("验证码发送失败，请稍后重试");
    } finally {
      setSending(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed || !code.trim()) {
      setMessage("请输入手机号和验证码");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/register-phone`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: trimmed,
          code: code.trim(),
        }),
      });
      const data = (await res.json()) as AuthResponse;
      if (!res.ok) {
        setMessage(data?.error || "注册失败");
        return;
      }
      if (data?.tokens?.access_token) {
        saveAuthSession(data);
        router.replace("/register/success");
        return;
      }
      setMessage("注册失败，请稍后重试");
    } catch {
      setMessage("注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">
              <UserPlus size={14} />
              注册新账号
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              快速注册，马上开始下载
            </h1>
            <p className="text-lg font-medium leading-relaxed text-slate-500">
              注册后可以收藏喜欢的合集、下载单张表情，并解锁更多专属功能。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {["手机验证码注册", "支持收藏/同步", "下载权限更清晰", "活动优先体验"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <BadgeCheck size={16} className="text-slate-900" />
                  <span className="text-sm font-semibold text-slate-600">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900">手机号注册</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">手机验证即可注册，系统会自动生成昵称</p>

            <form onSubmit={handleRegister} className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">手机号</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="请输入手机号"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">验证码</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="输入验证码"
                    className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sending || cooldown > 0}
                    className="h-12 w-32 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {cooldown > 0 ? `${cooldown}s` : sending ? "发送中" : "获取验证码"}
                  </button>
                </div>
              </div>

              {message ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
                  {message}
                </div>
              ) : null}

              {hint ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {hint}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60"
              >
                {loading ? "注册中..." : "注册"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm font-medium text-slate-500">
              已有账号？
              <Link href="/login" className="ml-1 font-bold text-emerald-600 hover:underline">
                去登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
