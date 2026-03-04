"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileMenu from "@/components/profile/ProfileMenu";
import {
  AUTH_CHANGE_EVENT,
  clearAuthSession,
  hasStoredAuthState,
  hasValidAccessToken,
} from "@/lib/auth-client";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(() => hasValidAccessToken());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncAuth = () => {
      setIsAuthorized(hasValidAccessToken());
    };
    syncAuth();

    window.addEventListener("storage", syncAuth);
    window.addEventListener("focus", syncAuth);
    window.addEventListener(AUTH_CHANGE_EVENT, syncAuth as EventListener);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("focus", syncAuth);
      window.removeEventListener(AUTH_CHANGE_EVENT, syncAuth as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isAuthorized) {
      if (hasStoredAuthState()) {
        clearAuthSession();
      }
      router.replace("/login");
    }
  }, [isAuthorized, router]);

  if (!isAuthorized) {
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
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-6">
        <ProfileMenu />
        {children}
      </div>
    </div>
  );
}
