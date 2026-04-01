import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "元都AI · 视频转图片",
  description: "把视频中的高价值瞬间自动转化为可下载、可传播、可复用的图片内容资产。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-slate-50 text-slate-900">
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
