"use client";

import { useEffect } from "react";
import { emitBehaviorEvent } from "@/lib/behavior-events";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    emitBehaviorEvent("front_global_error_boundary", {
      success: false,
      error_code: error?.name || "global_runtime_error",
      metadata: {
        message: error?.message || "",
        digest: error?.digest || "",
      },
    });
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-5 text-sm font-semibold text-rose-600">
            系统异常，请刷新后重试
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:border-slate-300"
            >
              重试
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-emerald-600"
            >
              刷新页面
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

