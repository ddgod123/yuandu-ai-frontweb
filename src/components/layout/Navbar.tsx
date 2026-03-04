"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AUTH_CHANGE_EVENT,
  buildDefaultAvatar,
  getStoredUser,
  hasValidAccessToken,
} from "@/lib/auth-client";

type UserInfo = {
  name: string;
  avatar: string;
};

export default function Navbar() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState<UserInfo>({
    name: "表情用户",
    avatar: buildDefaultAvatar("表情用户"),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncAuth = () => {
      if (!hasValidAccessToken()) {
        setUser({
          name: "表情用户",
          avatar: buildDefaultAvatar("表情用户"),
        });
        setIsAuthed(false);
        return;
      }
      setUser(getStoredUser());
      setIsAuthed(true);
    };

    syncAuth();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith("access_") || event.key.startsWith("refresh_") || event.key.startsWith("expires_") || event.key.startsWith("user_")) {
        syncAuth();
      }
    };
    const handleAuthChange = () => syncAuth();
    const handleFocus = () => syncAuth();

    window.addEventListener("storage", handleStorage);
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-xl shadow-lg shadow-emerald-200 transition-transform group-hover:scale-110">
              <span className="filter grayscale brightness-200">🗂️</span>
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">表情包档案馆</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {[
              { label: "首页", href: "/" },
              { label: "表情包大全", href: "/categories" },
              { label: "表情包IP", href: "/trending" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isAuthed ? (
            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <div className="relative h-8 w-8 overflow-hidden rounded-full bg-slate-100">
                <Image src={user.avatar} alt={user.name} fill unoptimized className="object-cover" />
              </div>
              <span className="hidden sm:inline">{user.name}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden md:inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="flex h-10 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-transform hover:scale-105 active:scale-95"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
