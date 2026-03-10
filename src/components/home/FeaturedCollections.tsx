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
          className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-2 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-emerald-100 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)]"
        >
          {/* 封面图容器 */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.5rem] bg-slate-50">
            {item.cover ? (
              <Image
                src={item.cover}
                alt={item.title}
                fill
                unoptimized
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                onError={(event) => handleImageError(event.currentTarget)}
              />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${CARD_FALLBACKS[index % CARD_FALLBACKS.length]}`} />
            )}
            
            {/* 渐变遮罩 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            
            {/* 推荐标签 */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 backdrop-blur-md shadow-sm">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black tracking-wider text-slate-800 uppercase">Featured</span>
            </div>

            {/* 悬浮显示的张数 */}
            <div className="absolute bottom-3 right-3 translate-y-2 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              <div className="flex items-center gap-1.5 rounded-xl bg-black/50 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md">
                <Layers size={12} />
                {(item.file_count || 0).toLocaleString()} Emojis
              </div>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex flex-1 flex-col p-4">
            <h3 className="line-clamp-2 min-h-[3rem] text-lg font-black leading-tight text-slate-900 transition-colors group-hover:text-emerald-600">
              {item.title}
            </h3>
            
            <div className="mt-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <User size={12} />
              </div>
              <p className="text-xs font-bold text-slate-400 truncate">by {item.author}</p>
            </div>

            {/* 底部数据栏 */}
            <div className="mt-auto pt-4 flex items-center gap-4 border-t border-slate-50">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 transition-colors group-hover:text-rose-500">
                <Heart size={14} className={item.like_count ? "fill-rose-500 text-rose-500" : ""} />
                <span>{(item.like_count || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 transition-colors group-hover:text-amber-500">
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
