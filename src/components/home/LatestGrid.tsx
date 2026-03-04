"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";

type Item = {
  id: number;
  title: string;
  cover?: string;
};

export default function LatestGrid({
  items,
  fallbackCover,
}: {
  items: Item[];
  fallbackCover: string;
}) {
  // 避免重复渲染导致 handler 重新创建
  const gridItems = useMemo(() => items, [items]);

  const handleError = (img: HTMLImageElement) => {
    const src = img.src;
    const swapped = img.dataset.swapped === "1";
    if (!swapped && src.startsWith("https://")) {
      img.dataset.swapped = "1";
      img.src = src.replace("https://", "http://");
      return;
    }
    img.src = fallbackCover;
  };

  return (
    <div className="columns-2 gap-4 space-y-4 md:columns-3 lg:columns-4 xl:columns-6">
      {gridItems.map((item) => (
        <Link
          href={`/collections/${item.id}`}
          key={item.id}
          className="group relative block overflow-hidden rounded-2xl bg-white transition-all hover:ring-2 hover:ring-emerald-500"
        >
          <Image
            src={item.cover || fallbackCover}
            alt={item.title}
            width={512}
            height={512}
            unoptimized
            className="aspect-square w-full object-cover"
            onError={(e) => handleError(e.currentTarget)}
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="text-sm font-bold text-white line-clamp-2">{item.title}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
              新上架
            </div>
          </div>
        </Link>
      ))}
      {!gridItems.length && (
        <div className="col-span-full text-center text-sm text-slate-400">暂无新到馆内容</div>
      )}
    </div>
  );
}
