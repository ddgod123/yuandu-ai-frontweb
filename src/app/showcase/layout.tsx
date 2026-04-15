import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "表情包赏析 · 元都AI",
  description: "精选表情包赏析页面，仅展示不提供下载。",
};

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}

