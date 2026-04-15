import React from "react";
import Link from "next/link";
import { LayoutDashboard, Image as ImageIcon, Library, Settings, Users, ShieldCheck } from "lucide-react";

const Sidebar = () => {
  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
    { icon: ImageIcon, label: "Emojis", href: "/admin/emojis" },
    { icon: Library, label: "Collections", href: "/admin/collections" },
    { icon: ShieldCheck, label: "UGC Reviews", href: "/admin/ugc-reviews" },
    { icon: ImageIcon, label: "XHS Generator", href: "/admin/xhs-generator" },
    { icon: Users, label: "Users", href: "/admin/users" },
    { icon: Settings, label: "Settings", href: "/admin/settings" },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-zinc-50/50 dark:bg-zinc-950/50">
      <div className="flex h-14 items-center border-b px-6">
        <span className="text-lg font-bold tracking-tight">Emoji Admin</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <item.icon className="h-4 w-4" />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
