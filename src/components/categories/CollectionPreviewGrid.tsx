"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Heart, Bookmark, Download, Layers } from "lucide-react";

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
  previewCount?: number;
};

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

function isImageFile(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return IMAGE_EXT_REGEX.test(clean);
}

function extractObjectKey(rawUrl: string) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return "";
  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
      const parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
      const key = decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
      return key;
    }
  } catch {
    // ignore parse errors
  }
  return trimmed.replace(/^\/+/, "").split("?")[0].split("#")[0];
}

function buildStorageProxyCandidate(rawUrl: string) {
  const key = extractObjectKey(rawUrl);
  if (!key || !key.startsWith("emoji/")) return "";
  return `${API_BASE}/storage/proxy?key=${encodeURIComponent(key)}`;
}

const DEFAULT_PREVIEW_GRID_SIZE = 15;

function buildImageCandidates(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];
  const proxyCandidate = buildStorageProxyCandidate(trimmed);
  // 非图片后缀直接跳过，避免 .ds_store 之类的无效对象；但允许 storage proxy 兜底地址
  if (!isImageFile(trimmed) && !proxyCandidate) return [];

  const candidates: string[] = [];
  const isProxyURL = (value: string) => value.includes("/api/storage/proxy?");
  const add = (value: string) => {
    if (!value) return;
    if (!isProxyURL(value) && !isImageFile(value)) return;
    if (!candidates.includes(value)) {
      candidates.push(value);
    }
  };

  // 开发阶段默认优先走后端 storage proxy，避免依赖未备案/冻结域名。
  add(proxyCandidate);

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
    add(proxyCandidate);
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
    add(proxyCandidate);
    return candidates;
  }

  if (trimmed.startsWith("/")) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (origin) {
      add(`${origin}${trimmed}`);
    } else {
      add(trimmed);
    }
    add(proxyCandidate);
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
    add(proxyCandidate);
    return candidates;
  }

  add(trimmed);
  add(proxyCandidate);
  return candidates;
}

function FallbackImage({
  url,
  alt,
  loading = "lazy",
}: {
  url: string;
  alt: string;
  loading?: "lazy" | "eager";
}) {
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
      loading={loading}
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => {
        setIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
      }}
    />
  );
}

function CollectionCardItem({
  item,
  index,
  previewCount,
}: {
  item: CollectionCard;
  index: number;
  previewCount: number;
}) {
  const cardRef = useRef<HTMLAnchorElement | null>(null);
  const columns = previewCount <= 9 ? 3 : 5;
  const rows = Math.ceil(previewCount / columns);
  const eagerCount = Math.min(columns, previewCount);
  const [loadAllPreviews, setLoadAllPreviews] = useState(index < 3);

  useEffect(() => {
    if (loadAllPreviews) {
      return;
    }
    const node = cardRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoadAllPreviews(true);
          observer.disconnect();
        }
      },
      { rootMargin: "220px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadAllPreviews]);

  const normalized = item.previewImages.filter((img) => isImageFile(img)).slice(0, previewCount);
  const visibleLimit = loadAllPreviews ? previewCount : eagerCount;
  const previewImages = normalized.slice(0, visibleLimit);
  while (previewImages.length < previewCount) {
    previewImages.push("");
  }

  return (
    <Link
      ref={cardRef}
      href={`/collections/${item.id}`}
      className="group flex flex-col bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-[0_30px_60px_-15px_rgba(15,23,42,0.1)] transition-all duration-500 overflow-hidden hover:-translate-y-2"
    >
      {/* Preview Grid */}
      <div className="p-3 bg-slate-50/50">
        <div
          className="grid gap-1.5 w-full rounded-2xl overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            aspectRatio: `${columns}/${rows}`,
          }}
        >
          {previewImages.map((img, idx) => (
            <div
              key={idx}
              className="relative aspect-square overflow-hidden bg-white group-hover:scale-110 transition-transform duration-500"
              style={{ transitionDelay: `${idx * 15}ms` }}
            >
              {img ? (
                <FallbackImage
                  url={img}
                  alt={`preview-${idx}`}
                  loading={index < 3 && idx < eagerCount ? "eager" : "lazy"}
                />
              ) : (
                <div className="h-full w-full bg-white/50" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Collection Info */}
      <div className="flex-1 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-black text-slate-900 leading-tight mb-3 group-hover:text-emerald-600 transition-colors line-clamp-1">
            {item.title}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 rounded-full overflow-hidden ring-2 ring-slate-50">
                <Image src={item.authorAvatar} alt={item.author} fill unoptimized loading="lazy" className="object-cover" />
              </div>
              <span className="text-xs font-bold text-slate-500 truncate max-w-[100px]">{item.author}</span>
              <CheckCircle2 size={12} className="text-blue-500 fill-blue-50" />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
              <Layers size={12} />
              <span className="text-[10px] font-black">{item.count}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
          <div className="flex flex-col items-center py-1 rounded-xl transition-colors group-hover:bg-rose-50/50">
            <Heart size={14} className="text-slate-300 group-hover:text-rose-500 transition-colors" />
            <span className="text-[11px] font-black text-slate-400 group-hover:text-rose-600 mt-1">{item.likeCount}</span>
          </div>
          <div className="flex flex-col items-center py-1 rounded-xl transition-colors group-hover:bg-amber-50/50">
            <Bookmark size={14} className="text-slate-300 group-hover:text-amber-500 transition-colors" />
            <span className="text-[11px] font-black text-slate-400 group-hover:text-amber-600 mt-1">{item.favoriteCount}</span>
          </div>
          <div className="flex flex-col items-center py-1 rounded-xl transition-colors group-hover:bg-blue-50/50">
            <Download size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
            <span className="text-[11px] font-black text-slate-400 group-hover:text-blue-600 mt-1">{item.downloadCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CollectionPreviewGrid({
  collections,
  loading = false,
  previewCount = DEFAULT_PREVIEW_GRID_SIZE,
}: CollectionPreviewGridProps) {
  const gridColumns = previewCount <= 9 ? 3 : 5;
  const gridRows = Math.ceil(previewCount / gridColumns);

  if (loading && collections.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={`skeleton-${idx}`}
            className="flex flex-col rounded-[2rem] border border-slate-100 bg-white shadow-sm overflow-hidden animate-pulse"
          >
            <div className="p-4 bg-slate-50/50">
              <div
                className="grid gap-2 w-full"
                style={{
                  gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                  aspectRatio: `${gridColumns}/${gridRows}`,
                }}
              >
                {Array.from({ length: previewCount }).map((__, imgIdx) => (
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
      {collections.map((item, index) => (
        <CollectionCardItem
          key={item.id}
          item={item}
          index={index}
          previewCount={previewCount}
        />
      ))}
    </div>
  );
}
