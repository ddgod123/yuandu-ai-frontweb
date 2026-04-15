"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, Bookmark, Download, Layers } from "lucide-react";
import SmartImage from "@/components/common/SmartImage";
import { isImageFile } from "@/lib/image-candidates";

export type CollectionPreviewAsset = {
  staticUrl: string;
  animatedUrl?: string;
  isAnimated?: boolean;
};

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
  previewAssets?: CollectionPreviewAsset[];
}

type CollectionPreviewGridProps = {
  collections: CollectionCard[];
  loading?: boolean;
  previewCount?: number;
  motionEnabled?: boolean;
  showDownloadMetric?: boolean;
  onCollectionClick?: (collectionId: number) => void;
};

const DEFAULT_PREVIEW_GRID_SIZE = 15;

function CollectionCardItem({
  item,
  index,
  previewCount,
  motionEnabled,
  showDownloadMetric,
  onCollectionClick,
}: {
  item: CollectionCard;
  index: number;
  previewCount: number;
  motionEnabled: boolean;
  showDownloadMetric: boolean;
  onCollectionClick?: (collectionId: number) => void;
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

  const normalizedAssets = (item.previewAssets || [])
    .map((asset) => {
      const staticUrl = (asset.staticUrl || "").trim();
      const animatedUrl = (asset.animatedUrl || "").trim();
      const staticValid = isImageFile(staticUrl);
      const animatedValid = isImageFile(animatedUrl);
      if (!staticValid && !animatedValid) {
        return null;
      }
      return {
        staticUrl: staticValid ? staticUrl : animatedUrl,
        animatedUrl: animatedValid ? animatedUrl : "",
        isAnimated: Boolean(asset.isAnimated),
      };
    })
    .filter((asset): asset is { staticUrl: string; animatedUrl: string; isAnimated: boolean } => Boolean(asset))
    .slice(0, previewCount);

  const normalized =
    normalizedAssets.length > 0
      ? normalizedAssets.map((asset) =>
          motionEnabled && asset.isAnimated && asset.animatedUrl ? asset.animatedUrl : asset.staticUrl
        )
      : item.previewImages.filter((img) => isImageFile(img)).slice(0, previewCount);

  const visibleLimit = loadAllPreviews ? previewCount : eagerCount;
  const previewImages = normalized.slice(0, visibleLimit);
  while (previewImages.length < previewCount) {
    previewImages.push("");
  }

  return (
    <Link
      ref={cardRef}
      href={`/collections/${item.id}`}
      onClick={() => onCollectionClick?.(item.id)}
      className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
    >
      {/* Preview Grid */}
      <div className="bg-slate-50/50 p-3">
        <div
          className="grid w-full gap-1.5 overflow-hidden rounded-2xl"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            aspectRatio: `${columns}/${rows}`,
          }}
        >
          {previewImages.map((img, idx) => (
            <div
              key={idx}
              className="relative aspect-square overflow-hidden bg-white transition-transform duration-500 group-hover:scale-110"
              style={{ transitionDelay: `${idx * 15}ms` }}
            >
              {img ? (
                <SmartImage
                  url={img}
                  alt={`preview-${idx}`}
                  loading={index < 3 && idx < eagerCount ? "eager" : "lazy"}
                  preferProxy
                  className="absolute inset-0 h-full w-full object-cover"
                  fallbackClassName="h-full w-full bg-white/50"
                />
              ) : (
                <div className="h-full w-full bg-white/50" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Collection Info */}
      <div className="flex-1 p-4">
        <div className="mb-3">
          <h3 className="mb-2 line-clamp-2 min-h-[2.5rem] text-sm font-black leading-tight text-slate-900 transition-colors group-hover:text-emerald-600">
            {item.title}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative h-6 w-6 overflow-hidden rounded-full ring-2 ring-slate-50">
                <SmartImage
                  url={item.authorAvatar}
                  alt={item.author}
                  className="object-cover"
                  loading="lazy"
                  fallbackClassName="h-full w-full bg-slate-200"
                />
              </div>
              <span className="max-w-[100px] truncate text-xs font-bold text-slate-500">{item.author}</span>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
              <Layers size={12} />
              {item.count}
            </div>
          </div>
        </div>

        <div className={`grid gap-1.5 border-t border-slate-100 pt-2 ${showDownloadMetric ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
            <Heart size={11} className="text-rose-400" />
            {item.likeCount}
          </div>
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
            <Bookmark size={11} className="text-amber-400" />
            {item.favoriteCount}
          </div>
          {showDownloadMetric ? (
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500">
              <Download size={11} className="text-sky-400" />
              {item.downloadCount}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function CollectionPreviewGrid({
  collections,
  loading = false,
  previewCount = DEFAULT_PREVIEW_GRID_SIZE,
  motionEnabled = false,
  showDownloadMetric = true,
  onCollectionClick,
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
          motionEnabled={motionEnabled}
          showDownloadMetric={showDownloadMetric}
          onCollectionClick={onCollectionClick}
        />
      ))}
    </div>
  );
}
