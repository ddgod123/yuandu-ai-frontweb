"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Phone } from "lucide-react";
import { API_BASE, getOrCreateDeviceID, saveAuthSession, type AuthSessionPayload } from "@/lib/auth-client";

type AuthResponse = {
  user?: { display_name?: string; phone?: string; avatar_url?: string };
  tokens?: AuthSessionPayload["tokens"];
  error?: string;
};

type CaptchaResponse = {
  captcha_token?: string;
  captcha_svg?: string;
  captcha_length?: number;
  expires_in?: number;
  error?: string;
};

const PASSWORD_RULE_HINT = "密码至少 8 位，需包含大写字母、小写字母和数字";
const DEFAULT_CAPTCHA_LENGTH = 4;

function formatAuthErrorMessage(status: number, rawError: string | undefined, fallback: string) {
  const normalized = (rawError || "").trim().toLowerCase();
  if (status === 429 || normalized.includes("too many requests")) {
    return "操作太频繁，请稍后再试";
  }
  if (normalized === "captcha invalid") {
    return "图形验证码错误，请重试";
  }
  if (normalized === "invalid verification code" || normalized === "verification code invalid") {
    return "短信验证码错误或已过期";
  }
  if (normalized === "password too weak" || normalized === "password too short") {
    return PASSWORD_RULE_HINT;
  }
  if (normalized === "phone required") {
    return "请输入手机号";
  }
  if (normalized === "code required") {
    return "请输入短信验证码";
  }
  if (normalized === "该手机号已注册，请直接登录") {
    return "该手机号已注册，请直接登录";
  }
  return rawError || fallback;
}

function isCaptchaInvalidError(rawError: string | undefined) {
  return (rawError || "").trim().toLowerCase() === "captcha invalid";
}

function isStrongPassword(password: string) {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  return true;
}

function buildPasswordChecks(password: string) {
  return [
    { label: "至少 8 位", passed: password.length >= 8 },
    { label: "包含大写字母", passed: /[A-Z]/.test(password) },
    { label: "包含小写字母", passed: /[a-z]/.test(password) },
    { label: "包含数字", passed: /\d/.test(password) },
  ];
}

export default function RegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaSVG, setCaptchaSVG] = useState("");
  const [captchaLength, setCaptchaLength] = useState(DEFAULT_CAPTCHA_LENGTH);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const initializedCaptchaRef = useRef(false);
  const passwordChecks = useMemo(() => buildPasswordChecks(password), [password]);
  const confirmTouched = confirmPassword.length > 0;
  const passwordMatched = confirmTouched && password === confirmPassword;
  const normalizedCaptchaCode = captchaCode.trim().toUpperCase();
  const isCaptchaLengthValid = normalizedCaptchaCode.length === captchaLength;
  const canRequestSMSCode =
    !sending &&
    cooldown <= 0 &&
    !captchaLoading &&
    phone.trim().length > 0 &&
    captchaToken.length > 0 &&
    isCaptchaLengthValid;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (initializedCaptchaRef.current) return;
    initializedCaptchaRef.current = true;
    void loadCaptcha({ silentRateLimit: true });
  }, []);

  const loadCaptcha = async (options?: { silentRateLimit?: boolean }) => {
    setCaptchaLoading(true);
    try {
      const deviceID = getOrCreateDeviceID();
      const res = await fetch(`${API_BASE}/auth/captcha?device_id=${encodeURIComponent(deviceID)}`);
      let data: CaptchaResponse = {};
      try {
        data = (await res.json()) as CaptchaResponse;
      } catch {
        data = {};
      }
      if (!res.ok) {
        if (!(options?.silentRateLimit && res.status === 429)) {
          setMessage(formatAuthErrorMessage(res.status, data?.error, "验证码加载失败"));
        }
        return;
      }
      setCaptchaToken(data.captcha_token || "");
      setCaptchaSVG(data.captcha_svg || "");
      setCaptchaLength(
        typeof data.captcha_length === "number" && data.captcha_length >= 4 && data.captcha_length <= 6
          ? data.captcha_length
          : DEFAULT_CAPTCHA_LENGTH
      );
      setCaptchaCode("");
    } catch {
      setMessage("验证码加载失败，请刷新页面重试");
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleSendCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      setMessage("请输入手机号");
      return;
    }
    if (!captchaToken) {
      setMessage("图形验证码已失效，请重新获取");
      void loadCaptcha();
      return;
    }
    if (!captchaCode.trim()) {
      setMessage("请先输入图形验证码");
      return;
    }
    if (!isCaptchaLengthValid) {
      setMessage(`图形验证码需输入 ${captchaLength} 位`);
      return;
    }
    setSending(true);
    setMessage(null);
    setHint(null);
    try {
      const deviceID = getOrCreateDeviceID();
      const res = await fetch(`${API_BASE}/auth/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: trimmed,
          device_id: deviceID,
          captcha_token: captchaToken,
          captcha_code: captchaCode.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; mock?: boolean; code?: string };
      if (!res.ok) {
        setMessage(formatAuthErrorMessage(res.status, data?.error, "验证码发送失败"));
        if (isCaptchaInvalidError(data?.error)) {
          void loadCaptcha();
        }
        return;
      }
      setCooldown(60);
      if (data?.mock && data?.code) {
        setHint(`测试验证码：${data.code}`);
      } else {
        setHint("验证码已发送，请注意查收");
      }
      setCaptchaToken("");
      setCaptchaCode("");
    } catch {
      setMessage("验证码发送失败，请稍后重试");
    } finally {
      setSending(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPhone = phone.trim();
    const trimmedCode = code.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();
    if (!trimmedPhone || !trimmedCode || !trimmedPassword) {
      setMessage("请输入手机号、验证码和登录密码");
      return;
    }
    if (!isStrongPassword(trimmedPassword)) {
      setMessage(PASSWORD_RULE_HINT);
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      setMessage("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const deviceID = getOrCreateDeviceID();
      const res = await fetch(`${API_BASE}/auth/register-phone`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: trimmedPhone,
          code: trimmedCode,
          password: trimmedPassword,
          device_id: deviceID,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as AuthResponse;
      if (!res.ok) {
        setMessage(formatAuthErrorMessage(res.status, data?.error, "注册失败"));
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
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-xl px-4 py-12 lg:py-20">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10">
          {/* 背景装饰 */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-50/50 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-blue-50/50 blur-3xl" />

          <div className="relative">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-black tracking-tight text-slate-900">加入档案馆</h2>
              <p className="mt-3 text-sm font-medium text-slate-500">
                开启你的表情包收藏之旅，记录每一份情绪
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-6">
              {/* 手机号 */}
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

              {/* 图形验证码 */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">安全验证</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={captchaCode}
                      onChange={(event) => setCaptchaCode(event.target.value.replace(/\s+/g, "").toUpperCase())}
                      placeholder="图形验证码"
                      maxLength={captchaLength}
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-center text-lg font-bold tracking-[0.3em] text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void loadCaptcha()}
                      disabled={captchaLoading}
                      className="group relative h-14 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-60"
                    >
                      {captchaSVG ? (
                        <div
                          className="h-full w-full transition-transform group-hover:scale-105"
                          dangerouslySetInnerHTML={{ __html: captchaSVG }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">加载中...</div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadCaptcha()}
                      disabled={captchaLoading}
                      className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition-all hover:bg-slate-50 hover:text-emerald-500 active:scale-95"
                      title="换一张"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                    </button>
                  </div>
                </div>
                <p className="text-[11px] font-bold text-slate-400">
                  {isCaptchaLengthValid
                    ? <span className="text-emerald-500">✓ 已输入 {captchaLength} 位验证码</span>
                    : `○ 请输入 ${captchaLength} 位图形验证码`}
                </p>
              </div>

              {/* 短信验证码 */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">短信验证</label>
                <div className="relative flex gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="输入 6 位验证码"
                    className="h-14 flex-1 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={!canRequestSMSCode}
                    className="h-14 min-w-[120px] rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white transition-all hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {cooldown > 0 ? `${cooldown}s` : sending ? "发送中..." : "获取验证码"}
                  </button>
                </div>
              </div>

              {/* 密码设置 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">设置密码</label>
                  <div className="relative">
                    <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="设置您的登录密码"
                      autoComplete="new-password"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">确认密码</label>
                  <div className="relative">
                    <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="请再次输入密码以确认"
                      autoComplete="new-password"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                  {confirmTouched && (
                    <p className={`text-[11px] font-bold ${passwordMatched ? "text-emerald-500" : "text-rose-500"}`}>
                      {passwordMatched ? "✓ 两次密码输入一致" : "× 两次密码输入不一致，请检查"}
                    </p>
                  )}
                </div>
              </div>

              {/* 密码强度提示 */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {passwordChecks.map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2 text-[11px] font-bold ${
                        item.passed ? "text-emerald-500" : "text-slate-400"
                      }`}
                    >
                      <div className={`h-1.5 w-1.5 rounded-full ${item.passed ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* 错误/提示信息 */}
              {message && (
                <div className="animate-in fade-in slide-in-from-top-1 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-500">
                  {message}
                </div>
              )}
              {hint && (
                <div className="animate-in fade-in slide-in-from-top-1 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-600">
                  {hint}
                </div>
              )}

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="group relative h-14 w-full overflow-hidden rounded-2xl bg-slate-900 text-base font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:bg-slate-900 disabled:hover:translate-y-0"
              >
                <span className="relative z-10">{loading ? "正在创建账号..." : "立即注册"}</span>
              </button>
            </form>

            <p className="mt-8 text-center text-sm font-medium text-slate-400">
              已有账号？
              <Link href="/login" className="ml-2 font-bold text-slate-900 hover:text-emerald-600 hover:underline">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
