"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AUTH_CHANGE_EVENT,
  buildDefaultAvatar,
  ensureAuthSession,
  getStoredUser,
} from "@/lib/auth-client";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";

type UserInfo = {
  name: string;
  avatar: string;
};

export default function Navbar() {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);
  const [user, setUser] = useState<UserInfo>({
    name: "表情用户",
    avatar: buildDefaultAvatar("表情用户"),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const syncAuth = async () => {
      const ok = await ensureAuthSession();
      if (cancelled) return;
      if (!ok) {
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

    void syncAuth();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith("access_") || event.key.startsWith("refresh_") || event.key.startsWith("expires_") || event.key.startsWith("user_")) {
        void syncAuth();
      }
    };
    const handleAuthChange = () => {
      void syncAuth();
    };
    const handleFocus = () => {
      void syncAuth();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener);
    window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/70 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="relative h-12 w-12 transition-all group-hover:scale-110">
              <Image 
                src="/logo-v2.png" 
                alt="Logo" 
                fill 
                className="object-contain scale-125"
                priority
              />
            </div>
            <div className="flex items-center">
              <span className="text-2xl font-black tracking-tighter text-slate-900 leading-none">表情包<span className="text-emerald-500">档案馆</span></span>
            </div>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {[
              { label: "首页", href: "/" },
              { label: "表情包大全", href: "/categories" },
              { label: "表情包IP", href: "/trending" },
              { label: "创作表情包", href: "/create" },
              { label: "我的", href: "/mine" },
            ].map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`relative rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                    isActive 
                      ? "text-emerald-600 bg-emerald-50/50" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthed ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-1 pr-4 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-emerald-100 hover:shadow-md hover:shadow-emerald-500/5"
              >
                <div className="relative h-8 w-8 overflow-hidden rounded-xl bg-slate-100 ring-2 ring-white transition-transform group-hover:scale-105">
                  <Image src={user.avatar} alt={user.name} fill unoptimized className="object-cover" />
                </div>
                <span className="hidden max-w-[100px] truncate sm:inline">{user.name}</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900"
              >
                <LogIn size={18} />
                <span>登录</span>
              </Link>
              <Link
                href="/register"
                className="flex h-10 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-emerald-500 hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                注册
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
