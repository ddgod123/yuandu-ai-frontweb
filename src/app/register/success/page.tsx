"use client";

import Link from "next/link";

export default function RegisterSuccessPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600">
          注册成功
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
          欢迎加入表情包档案馆
        </h1>
        <p className="mt-4 max-w-2xl text-lg font-medium text-slate-500">
          你已经完成注册并自动登录。系统已为你生成默认昵称和头像，稍后可在个人资料里修改。
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-xl bg-slate-900 px-8 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-transform hover:scale-105 active:scale-95"
          >
            进入首页
          </Link>
          <Link
            href="/profile"
            className="flex h-12 items-center justify-center rounded-xl border border-slate-200 px-8 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            完善资料
          </Link>
        </div>
      </div>
    </div>
  );
}
