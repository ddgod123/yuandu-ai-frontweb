"use client";

import Link from "next/link";
import { Bookmark, Download, Heart, Layers, Sparkles } from "lucide-react";
import SmartImage from "@/components/common/SmartImage";

type Item = {
  id: number;
  title: string;
  cover?: string;
  coverKey?: string;
  file_count?: number;
  favorite_count?: number;
  like_count?: number;
  download_count?: number;
};

export default function LatestGrid({
  items,
  fallbackCover,
}: {
  items: Item[];
  fallbackCover: string;
}) {
  const normalizeCount = (value?: number) =>
    Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((item) => (
        <Link
          href={`/collections/${item.id}`}
          key={item.id}
          className="group relative flex flex-col transition-all duration-500 hover:-translate-y-1.5"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-slate-50 ring-1 ring-inset ring-slate-100/50 transition-all duration-500 group-hover:shadow-[0_20px_40px_-15px_rgba(15,23,42,0.1)] group-hover:ring-emerald-100">
            <SmartImage
              url={item.cover || fallbackCover}
              alt={item.title}
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
              fallbackClassName="h-full w-full bg-slate-100"
            />
            
            {/* 顶部标签 */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black tracking-wider text-emerald-600 backdrop-blur-md shadow-sm">
              <Sparkles size={10} className="fill-emerald-500" />
              NEW
            </div>

            {/* 底部数量悬浮显示 */}
            <div className="absolute bottom-3 right-3 translate-y-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              <div className="flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[9px] font-black text-white backdrop-blur-md">
                <Layers size={10} />
                {normalizeCount(item.file_count)} P
              </div>
            </div>
          </div>

          <div className="mt-4 px-1">
            <h3 className="line-clamp-1 text-sm font-black tracking-tight text-slate-800 transition-colors group-hover:text-emerald-600">
              {item.title}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <span>{normalizeCount(item.file_count)} 张表情</span>
            </div>
          </div>
        </Link>
      ))}
      {!items.length && (
        <div className="col-span-full rounded-2xl border border-slate-100 bg-white py-16 text-center text-sm text-slate-400">
          暂无新到馆内容
        </div>
      )}
    </div>
  );
}
