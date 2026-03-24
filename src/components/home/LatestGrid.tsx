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
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((item) => (
        <Link
          href={`/collections/${item.id}`}
          key={item.id}
          className="group relative block overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
            <SmartImage
              url={item.cover || fallbackCover}
              alt={item.title}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              fallbackClassName="h-full w-full bg-slate-100"
            />
            <div className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/85 px-2 py-1 text-[10px] font-extrabold text-emerald-700 backdrop-blur-md">
              <Sparkles size={11} />
              新到馆
            </div>
          </div>

          <div className="space-y-3 p-3.5">
            <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-tight text-slate-900 transition-colors group-hover:text-emerald-600">
              {item.title}
            </h3>

            <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
              <Layers size={11} />
              {normalizeCount(item.file_count)}
            </div>

            <div className="grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
                <Heart size={11} className="text-rose-400" />
                {normalizeCount(item.like_count)}
              </div>
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
                <Bookmark size={11} className="text-amber-400" />
                {normalizeCount(item.favorite_count)}
              </div>
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
                <Download size={11} className="text-sky-400" />
                {normalizeCount(item.download_count)}
              </div>
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
