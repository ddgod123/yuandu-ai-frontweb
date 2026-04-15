"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  API_BASE,
  AUTH_CHANGE_EVENT,
  buildDefaultAvatar,
  ensureAuthSession,
  fetchWithAuthRetry,
  getStoredUser,
} from "@/lib/auth-client";
import { emitBehaviorEvent } from "@/lib/behavior-events";
import { usePathname } from "next/navigation";
import { ChevronDown, Crown, LogIn } from "lucide-react";

type UserInfo = {
  name: string;
  avatar: string;
  isSubscriber: boolean;
  remainingCollectionDownloads: number;
};

type MeResponse = {
  display_name?: string;
  avatar_url?: string;
  is_subscriber?: boolean;
};

type CollectionDownloadEntitlement = {
  remaining_download_times?: number;
};

type CollectionDownloadEntitlementResponse = {
  items?: CollectionDownloadEntitlement[];
};

export default function Navbar() {
  const pathname = usePathname();
  const lastTrackedPathRef = useRef<string>("");
  // 为避免 SSR/CSR 首帧不一致导致 hydration mismatch，首帧统一按未鉴权占位渲染，
  // 鉴权状态在 useEffect 里再同步。
  const [isAuthed, setIsAuthed] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [emojiMenuOpenPath, setEmojiMenuOpenPath] = useState<string | null>(null);
  const [resourceMenuOpenPath, setResourceMenuOpenPath] = useState<string | null>(null);
  const [aiToolsMenuOpenPath, setAIToolsMenuOpenPath] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo>({
    name: "表情用户",
    avatar: buildDefaultAvatar("表情用户"),
    isSubscriber: false,
    remainingCollectionDownloads: 0,
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
          isSubscriber: false,
          remainingCollectionDownloads: 0,
        });
        setIsAuthed(false);
        setAuthReady(true);
        return;
      }

      const fallback = getStoredUser();
      let nextUser: UserInfo = {
        name: fallback.name,
        avatar: fallback.avatar,
        isSubscriber: false,
        remainingCollectionDownloads: 0,
      };

      try {
        const meRes = await fetchWithAuthRetry(`${API_BASE}/me`);
        if (meRes.ok) {
          const me = (await meRes.json()) as MeResponse;
          const displayName = (me?.display_name || "").trim();
          const avatarURL = (me?.avatar_url || "").trim();
          nextUser = {
            ...nextUser,
            name: displayName || fallback.name,
            avatar: avatarURL || fallback.avatar,
            isSubscriber: Boolean(me?.is_subscriber),
          };
        }
      } catch {
        // ignore
      }

      try {
        const entitlementRes = await fetchWithAuthRetry(
          `${API_BASE}/me/collection-download-entitlements?page=1&page_size=200&status=active`
        );
        if (entitlementRes.ok) {
          const entitlementData =
            (await entitlementRes.json()) as CollectionDownloadEntitlementResponse;
          const items = Array.isArray(entitlementData?.items) ? entitlementData.items : [];
          const remaining = items.reduce((sum, item) => {
            const value = Number(item?.remaining_download_times || 0);
            return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
          }, 0);
          nextUser.remainingCollectionDownloads = remaining;
        }
      } catch {
        // ignore
      }

      if (cancelled) return;
      setUser(nextUser);
      setIsAuthed(true);
      setAuthReady(true);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentPath = `${pathname}${window.location.search || ""}`;
    if (lastTrackedPathRef.current === currentPath) return;
    lastTrackedPathRef.current = currentPath;

    let eventName = "";
    if (pathname === "/") eventName = "page_view_home";
    else if (pathname.startsWith("/categories")) eventName = "page_view_categories";
    else if (pathname.startsWith("/trending")) eventName = "page_view_ip";
    else if (pathname.startsWith("/collections/")) eventName = "page_view_collection";
    if (!eventName) return;

    emitBehaviorEvent(eventName, {
      route: currentPath,
    });
  }, [pathname]);

  const navItems = [
    {
      label: "首页",
      href: "/emoji-recommend",
      match: (path: string) => path === "/emoji-recommend" || path.startsWith("/emoji-recommend/"),
    },
    {
      label: "我的",
      href: "/mine",
      match: (path: string) =>
        path === "/mine" ||
        path.startsWith("/mine/favorites/review") ||
        path.startsWith("/mine/favorites/emojis") ||
        path.startsWith("/mine/favorites/collections") ||
        path.startsWith("/mine/my-emojis"),
    },
  ];
  const subscriptionNav = {
    label: "订阅",
    href: "/subscription",
    match: (path: string) =>
      path === "/subscription" ||
      path.startsWith("/subscription/") ||
      path === "/profile/subscription" ||
      path.startsWith("/profile/subscription/"),
  };
  const isEmojiMenuActive =
    pathname === "/categories" ||
    pathname.startsWith("/categories/") ||
    pathname === "/showcase" ||
    pathname.startsWith("/showcase/") ||
    pathname === "/trending" ||
    pathname.startsWith("/trending/");
  const isEmojiMenuOpen = emojiMenuOpenPath !== null && emojiMenuOpenPath === (pathname || "");
  const resourceMenuItems = [
    {
      label: "我的表情包",
      href: "/mine/favorites/uploads",
      match: (path: string) =>
        path === "/mine/favorites/uploads" || path.startsWith("/mine/favorites/uploads/"),
    },
    {
      label: "我的png图片",
      href: "/mine/works?format=png",
      match: (path: string) => path === "/mine/works" || path.startsWith("/mine/works/"),
    },
  ];
  const isResourceMenuActive = resourceMenuItems.some((item) => item.match(pathname || ""));
  const isResourceMenuOpen =
    resourceMenuOpenPath !== null && resourceMenuOpenPath === (pathname || "");
  const aiToolsMenuItems = [
    {
      label: "视频转图片",
      href: "/",
      match: (path: string) => path === "/",
    },
    {
      label: "视频转png",
      href: "/create",
      match: (path: string) => path === "/create" || path.startsWith("/create/"),
    },
  ];
  const isAIToolsMenuActive = aiToolsMenuItems.some((item) => item.match(pathname || ""));
  const isAIToolsMenuOpen =
    aiToolsMenuOpenPath !== null && aiToolsMenuOpenPath === (pathname || "");
  const homeNav = navItems[0];
  const rightNavItems = navItems.slice(1, -1);
  const mineNav = navItems[navItems.length - 1];
  const emojiMenuItems = [
    { label: "表情包大全", href: "/categories" },
    { label: "表情包赏析", href: "/showcase" },
    { label: "表情包IP", href: "/trending" },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/70 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Link href="/emoji-recommend" className="flex items-center gap-3 group">
            <div className="relative h-12 w-12 transition-transform duration-300 group-hover:scale-105">
              <Image 
                src="/logo-v2.png" 
                alt="Logo" 
                fill 
                sizes="48px"
                className="object-contain scale-125"
                priority
              />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">元都表情包</span>
              <span className="mt-1.5 text-[11px] font-bold tracking-[0.15em] text-emerald-600 uppercase leading-none">AI 视觉资产生产平台</span>
            </div>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            <Link
              href={homeNav.href}
              className={`relative rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                homeNav.match(pathname || "")
                  ? "bg-emerald-50/50 text-emerald-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {homeNav.label}
              {homeNav.match(pathname || "") && (
                <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />
              )}
            </Link>
            <div
              className="relative"
              onMouseEnter={() => setEmojiMenuOpenPath(pathname || "")}
              onMouseLeave={() => setEmojiMenuOpenPath(null)}
            >
              <button
                type="button"
                className={`relative flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                  isEmojiMenuActive
                    ? "bg-emerald-50/50 text-emerald-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
                onClick={() =>
                  setEmojiMenuOpenPath((prev) => (prev === (pathname || "") ? null : pathname || ""))
                }
              >
                表情包
                <ChevronDown
                  size={14}
                  className={`transition-transform ${isEmojiMenuOpen ? "rotate-180" : ""}`}
                />
                {isEmojiMenuActive && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />
                )}
              </button>

              {isEmojiMenuOpen ? (
                <div className="absolute left-0 top-full w-40 pt-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {emojiMenuItems.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setEmojiMenuOpenPath(null)}
                        className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                          active
                            ? "bg-emerald-50 text-emerald-600"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                  </div>
                </div>
              ) : null}
            </div>
            <div
              className="relative"
              onMouseEnter={() => setResourceMenuOpenPath(pathname || "")}
              onMouseLeave={() => setResourceMenuOpenPath(null)}
            >
              <button
                type="button"
                className={`relative flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                  isResourceMenuActive
                    ? "bg-emerald-50/50 text-emerald-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
                onClick={() =>
                  setResourceMenuOpenPath((prev) => (prev === (pathname || "") ? null : pathname || ""))
                }
              >
                资源管理
                <ChevronDown
                  size={14}
                  className={`transition-transform ${isResourceMenuOpen ? "rotate-180" : ""}`}
                />
                {isResourceMenuActive && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />
                )}
              </button>
              {isResourceMenuOpen ? (
                <div className="absolute left-0 top-full w-40 pt-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    {resourceMenuItems.map((item) => {
                      const active = item.match(pathname || "");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setResourceMenuOpenPath(null)}
                          className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                            active
                              ? "bg-emerald-50 text-emerald-600"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <div
              className="relative"
              onMouseEnter={() => setAIToolsMenuOpenPath(pathname || "")}
              onMouseLeave={() => setAIToolsMenuOpenPath(null)}
            >
              <button
                type="button"
                className={`relative flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                  isAIToolsMenuActive
                    ? "bg-emerald-50/50 text-emerald-600"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
                onClick={() =>
                  setAIToolsMenuOpenPath((prev) => (prev === (pathname || "") ? null : pathname || ""))
                }
              >
                AI工具
                <ChevronDown
                  size={14}
                  className={`transition-transform ${isAIToolsMenuOpen ? "rotate-180" : ""}`}
                />
                {isAIToolsMenuActive && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />
                )}
              </button>
              {isAIToolsMenuOpen ? (
                <div className="absolute left-0 top-full w-40 pt-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    {aiToolsMenuItems.map((item) => {
                      const active = item.match(pathname || "");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setAIToolsMenuOpenPath(null)}
                          className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                            active
                              ? "bg-emerald-50 text-emerald-600"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            {rightNavItems.map((item) => {
              const isActive = item.match(pathname || "");
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`relative rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                    isActive
                      ? "bg-emerald-50/50 text-emerald-600"
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
            <Link
              href={mineNav.href}
              className={`relative rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                mineNav.match(pathname || "")
                  ? "bg-emerald-50/50 text-emerald-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {mineNav.label}
              {mineNav.match(pathname || "") && (
                <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />
              )}
            </Link>
            <Link
              href={subscriptionNav.href}
              className={`relative rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${
                subscriptionNav.match(pathname || "")
                  ? "bg-emerald-50/50 text-emerald-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {subscriptionNav.label}
              {subscriptionNav.match(pathname || "") && (
                <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500" />
              )}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthed ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="group flex items-center gap-2.5 rounded-full border border-slate-200 bg-white p-1 pr-4 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-500/5"
              >
                <div className="relative h-8 w-8 overflow-hidden rounded-full bg-slate-100 ring-2 ring-white transition-transform group-hover:scale-105">
                  <Image src={user.avatar} alt={user.name} fill unoptimized className="object-cover" />
                </div>
                <div className="hidden min-w-0 flex-col sm:flex">
                  <div className="flex items-center gap-1.5">
                    <span className="max-w-[120px] truncate text-sm font-bold text-slate-700">{user.name}</span>
                    {user.isSubscriber ? (
                      <span
                        title="订阅用户"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-50 text-amber-500 ring-1 ring-amber-200"
                      >
                        <Crown size={11} />
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </div>
          ) : !authReady ? (
            <div className="h-10 w-[132px] animate-pulse rounded-xl border border-slate-100 bg-slate-100/70" />
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
