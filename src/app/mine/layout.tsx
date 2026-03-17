"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MineMenu from "@/components/mine/MineMenu";
import {
  AUTH_CHANGE_EVENT,
  clearAuthSession,
  ensureAuthSession,
  hasStoredAuthState,
} from "@/lib/auth-client";

export default function MineLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const syncAuth = async () => {
      const ok = await ensureAuthSession();
      if (cancelled) return;
      setIsAuthorized(ok);
      setAuthChecked(true);
    };
    void syncAuth();

    const onStorage = () => {
      void syncAuth();
    };
    const onFocus = () => {
      void syncAuth();
    };
    const onAuthChange = () => {
      void syncAuth();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener(AUTH_CHANGE_EVENT, onAuthChange as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(AUTH_CHANGE_EVENT, onAuthChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!isAuthorized) {
      if (hasStoredAuthState()) {
        clearAuthSession();
      }
      router.replace(`/login?next=${encodeURIComponent("/mine")}`);
    }
  }, [authChecked, isAuthorized, router]);

  if (!authChecked || !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center text-sm font-semibold text-slate-400">
          正在验证登录状态...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        <MineMenu />
        {children}
      </div>
    </div>
  );
}
