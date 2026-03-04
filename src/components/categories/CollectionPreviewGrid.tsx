"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

interface CollectionCard {
  id: number;
  title: string;
  author: string;
  authorAvatar: string;
  count: number;
  favoriteCount: number;
  downloadCount: number;
  likeCount: number;
  previewImages: string[];
}

type CollectionPreviewGridProps = {
  collections: CollectionCard[];
  loading?: boolean;
};

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;

function isImageFile(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return IMAGE_EXT_REGEX.test(clean);
}

const PREVIEW_GRID_SIZE = 15;

function buildImageCandidates(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];
  // 非图片后缀直接跳过，避免 .ds_store 之类的无效对象
  if (!isImageFile(trimmed)) return [];

  const candidates: string[] = [];
  const add = (value: string) => {
    if (value && isImageFile(value) && !candidates.includes(value)) {
      candidates.push(value);
    }
  };

  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  const preferHttps = protocol === "https:";

  if (trimmed.startsWith("//")) {
    const httpsURL = `https:${trimmed}`;
    const httpURL = `http:${trimmed}`;
    if (preferHttps) {
      add(httpsURL);
      add(httpURL);
    } else {
      add(httpURL);
      add(httpsURL);
    }
    return candidates;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const httpsURL = trimmed.replace(/^http:\/\//i, "https://");
    const httpURL = trimmed.replace(/^https:\/\//i, "http://");
    if (preferHttps) {
      add(httpsURL);
      add(httpURL);
    } else {
      add(httpURL);
      add(httpsURL);
    }
    return candidates;
  }

  if (trimmed.startsWith("/")) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (origin) {
      add(`${origin}${trimmed}`);
    } else {
      add(trimmed);
    }
    return candidates;
  }

  const hostCandidate = trimmed.split("/")[0];
  if (hostCandidate.includes(".") || hostCandidate.includes(":")) {
    if (preferHttps) {
      add(`https://${trimmed}`);
      add(`http://${trimmed}`);
    } else {
      add(`http://${trimmed}`);
      add(`https://${trimmed}`);
    }
    return candidates;
  }

  add(trimmed);
  return candidates;
}

function FallbackImage({ url, alt }: { url: string; alt: string }) {
  const candidates = useMemo(() => buildImageCandidates(url), [url]);
  const [index, setIndex] = useState(0);
  const src = candidates[index];

  if (!src) {
    return <div className="h-full w-full bg-slate-50" />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => {
        setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
      }}
    />
  );
}

export default function CollectionPreviewGrid({ collections, loading = false }: CollectionPreviewGridProps) {
  if (loading && collections.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={`skeleton-${idx}`}
            className="flex flex-col rounded-[2rem] border border-slate-100 bg-white shadow-sm overflow-hidden animate-pulse"
          >
            <div className="p-4 bg-slate-50/50">
              <div className="grid grid-cols-5 gap-2 aspect-[5/3] w-full">
                {Array.from({ length: PREVIEW_GRID_SIZE }).map((__, imgIdx) => (
                  <div key={imgIdx} className="aspect-square bg-slate-100" />
                ))}
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="h-5 w-3/4 bg-slate-100 rounded" />
              <div className="h-4 w-1/2 bg-slate-100 rounded" />
              <div className="h-10 w-full bg-slate-100 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!loading && collections.length === 0) {
    return (
      <div className="py-24 text-center text-slate-400 font-semibold">
        暂无可展示的合集
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {collections.map((item) => {
        const previewImages = [...item.previewImages]
          .filter((img) => isImageFile(img))
          .slice(0, PREVIEW_GRID_SIZE);
        while (previewImages.length < PREVIEW_GRID_SIZE) {
          previewImages.push("");
        }

        return (
        <Link
          key={item.id}
          href={`/collections/${item.id}`}
          className="group flex flex-col bg-white border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden"
        >
          {/* 5x3 Image Preview Grid */}
          <div className="p-4 bg-slate-50/50">
            <div className="grid grid-cols-5 gap-2 aspect-[5/3] w-full">
              {previewImages.map((img, idx) => (
                <div 
                  key={idx} 
                  className="relative aspect-square overflow-hidden bg-white border border-slate-100 group-hover:scale-105 transition-transform duration-300"
                  style={{ transitionDelay: `${idx * 20}ms` }}
                >
                  {img ? <FallbackImage url={img} alt={`preview-${idx}`} /> : <div className="h-full w-full bg-slate-50" />}
                </div>
              ))}
            </div>
          </div>

          {/* Collection Info */}
          <div className="flex-1 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-slate-900 leading-tight mb-2 group-hover:text-emerald-600 transition-colors truncate">
                {item.title}
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                  <Image src={item.authorAvatar} alt={item.author} fill unoptimized />
                </div>
                <span className="text-sm font-bold text-slate-500 truncate">{item.author}</span>
                <CheckCircle2 size={14} className="text-blue-500" fill="currentColor" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">数量</span>
              <span className="text-sm font-black text-slate-900">{item.count} Pcs</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">收藏</span>
              <span className="text-sm font-black text-slate-900">{item.favoriteCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">下载</span>
              <span className="text-sm font-black text-slate-900">{item.downloadCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">点赞</span>
              <span className="text-sm font-black text-slate-900">{item.likeCount}</span>
            </div>
          </div>
          </div>
        </Link>
        );
      })}
    </div>
  );
}
