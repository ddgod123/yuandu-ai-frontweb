"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Bookmark, Layers, User } from "lucide-react";

type FeaturedCollection = {
  id: number;
  title: string;
  author: string;
  cover?: string;
  file_count?: number;
  like_count?: number;
  favorite_count?: number;
};

const FALLBACK_COVER = "https://api.dicebear.com/7.x/bottts/svg?seed=placeholder";

const CARD_FALLBACKS = [
  "from-cyan-100 via-sky-100 to-blue-100",
  "from-amber-100 via-orange-100 to-rose-100",
  "from-emerald-100 via-teal-100 to-cyan-100",
  "from-violet-100 via-fuchsia-100 to-pink-100",
];

function handleImageError(img: HTMLImageElement) {
  const source = img.src;
  const swapped = img.dataset.swapped === "1";
  if (!swapped && source.startsWith("https://")) {
    img.dataset.swapped = "1";
    img.src = source.replace("https://", "http://");
    return;
  }
  img.src = FALLBACK_COVER;
}

export default function FeaturedCollections({ items }: { items: FeaturedCollection[] }) {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <Link
          href={`/collections/${item.id}`}
          key={item.id}
          className="group relative flex flex-col transition-all duration-500 hover:-translate-y-2"
        >
          {/* 封面图容器 */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2.5rem] bg-slate-50 shadow-sm ring-1 ring-inset ring-slate-100/50 transition-all duration-500 group-hover:shadow-[0_30px_60px_-15px_rgba(15,23,42,0.15)] group-hover:ring-emerald-100">
            {item.cover ? (
              <Image
                src={item.cover}
                alt={item.title}
                fill
                unoptimized
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                onError={(event) => handleImageError(event.currentTarget)}
              />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${CARD_FALLBACKS[index % CARD_FALLBACKS.length]}`} />
            )}
            
            {/* 渐变遮罩 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            
            {/* 推荐标签 */}
            <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 backdrop-blur-md shadow-sm">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black tracking-[0.1em] text-slate-800 uppercase">Featured</span>
            </div>

            {/* 底部信息悬浮显示 */}
            <div className="absolute bottom-5 left-5 right-5 translate-y-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md ring-1 ring-white/30">
                    <User size={14} />
                  </div>
                  <span className="text-xs font-bold text-white drop-shadow-sm">{item.author}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black text-white shadow-lg shadow-emerald-500/20">
                  <Layers size={12} />
                  {item.file_count || 0} P
                </div>
              </div>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="mt-6 px-2">
            <h3 className="line-clamp-1 text-xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-emerald-600">
              {item.title}
            </h3>
            
            <div className="mt-4 flex items-center gap-4 text-slate-400">
              <div className="flex items-center gap-1.5 text-[11px] font-bold transition-colors group-hover:text-rose-500">
                <Heart size={14} className={item.like_count ? "fill-rose-500 text-rose-500" : ""} />
                <span>{(item.like_count || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold transition-colors group-hover:text-amber-500">
                <Bookmark size={14} className={item.favorite_count ? "fill-amber-500 text-amber-500" : ""} />
                <span>{(item.favorite_count || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
