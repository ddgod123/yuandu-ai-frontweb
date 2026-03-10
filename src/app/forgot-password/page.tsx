"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { LockKeyhole, Phone, ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";

const PASSWORD_RULE_HINT = "密码至少 8 位，需包含大写字母、小写字母和数字";

function buildPasswordChecks(password: string) {
  return [
    { label: "至少 8 位", passed: password.length >= 8 },
    { label: "包含大写字母", passed: /[A-Z]/.test(password) },
    { label: "包含小写字母", passed: /[a-z]/.test(password) },
    { label: "包含数字", passed: /\d/.test(password) },
  ];
}

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // 模拟状态（仅用于 UI 演示）
  const [step, setStep] = useState(1); // 1: 验证手机, 2: 重置密码
  const [cooldown, setCooldown] = useState(0);
  
  const passwordChecks = useMemo(() => buildPasswordChecks(newPassword), [newPassword]);
  const confirmTouched = confirmPassword.length > 0;
  const passwordMatched = confirmTouched && newPassword === confirmPassword;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-xl px-4 py-12 lg:py-20">
        {/* 返回登录 */}
        <Link 
          href="/login" 
          className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          返回登录
        </Link>

        <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10">
          {/* 背景装饰 */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-50/50 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-blue-50/50 blur-3xl" />

          <div className="relative">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">找回密码</h2>
              <p className="mt-3 text-sm font-medium text-slate-500">
                通过手机验证码安全重置您的登录密码
              </p>
            </div>

            {/* 步骤条 */}
            <div className="mb-10 flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${step === 1 ? "text-emerald-500" : "text-slate-300"}`}>
                <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${step === 1 ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>1</div>
                <span className="text-xs font-bold">身份验证</span>
              </div>
              <div className="h-px w-8 bg-slate-100" />
              <div className={`flex items-center gap-2 ${step === 2 ? "text-emerald-500" : "text-slate-300"}`}>
                <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${step === 2 ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>2</div>
                <span className="text-xs font-bold">重置密码</span>
              </div>
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {step === 1 ? (
                <>
                  {/* 手机号 */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">手机号</label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="请输入绑定的手机号"
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>
                  </div>

                  {/* 图形验证码 */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">图形验证</label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        value={captchaCode}
                        onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                        placeholder="图形验证码"
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-center text-lg font-bold tracking-[0.3em] text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                      />
                      <div className="flex h-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-400">
                        [ 验证码图片 ]
                      </div>
                    </div>
                  </div>

                  {/* 短信验证码 */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">短信验证</label>
                    <div className="relative flex gap-3">
                      <input
                        type="text"
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value)}
                        placeholder="输入 6 位验证码"
                        className="h-14 flex-1 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                      />
                      <button
                        type="button"
                        className="h-14 min-w-[120px] rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white transition-all hover:bg-emerald-600"
                      >
                        获取验证码
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    下一步
                  </button>
                </>
              ) : (
                <>
                  {/* 新密码 */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">新密码</label>
                      <div className="relative">
                        <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="设置新密码"
                          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">确认新密码</label>
                      <div className="relative">
                        <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="再次输入以确认"
                          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </div>
                      {confirmTouched && (
                        <p className={`text-[11px] font-bold ${passwordMatched ? "text-emerald-500" : "text-rose-500"}`}>
                          {passwordMatched ? "✓ 两次密码输入一致" : "× 两次密码输入不一致"}
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

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="h-14 flex-1 rounded-2xl border border-slate-200 font-bold text-slate-600 transition-all hover:bg-slate-50"
                    >
                      上一步
                    </button>
                    <button
                      type="button"
                      className="h-14 flex-[2] rounded-2xl bg-slate-900 text-base font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      确认重置
                    </button>
                  </div>
                </>
              )}
            </form>

            <div className="mt-10 pt-8 border-t border-slate-100 text-center">
              <p className="text-sm font-medium text-slate-400">
                记起密码了？
                <Link href="/login" className="ml-2 font-bold text-slate-900 hover:text-emerald-600 hover:underline">
                  立即登录
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
