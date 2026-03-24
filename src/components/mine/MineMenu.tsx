"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/mine/works", label: "我的作品" },
  { href: "/create", label: "视频转图片" },
  { href: "/mine/favorites/emojis", label: "收藏表情包" },
  { href: "/mine/favorites/collections", label: "收藏合集" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MineMenu() {
  const pathname = usePathname();

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {menuItems.map((item) => {
          const active = isActive(pathname || "", item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
