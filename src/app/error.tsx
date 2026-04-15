"use client";

import { useEffect } from "react";
import { emitBehaviorEvent } from "@/lib/behavior-events";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    emitBehaviorEvent("front_error_boundary", {
      success: false,
      error_code: error?.name || "runtime_error",
      metadata: {
        message: error?.message || "",
        digest: error?.digest || "",
      },
    });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[55vh] w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-5 text-sm font-semibold text-rose-600">
        页面出现异常，请稍后重试
      </div>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-emerald-600"
      >
        重新加载
      </button>
    </main>
  );
}

