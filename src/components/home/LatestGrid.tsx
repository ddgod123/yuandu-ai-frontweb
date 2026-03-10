"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";

type Item = {
  id: number;
  title: string;
  cover?: string;
  coverKey?: string;
};

export default function LatestGrid({
  items,
  fallbackCover,
}: {
  items: Item[];
  fallbackCover: string;
}) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

  const extractStorageKey = (raw: string) => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const parsed = new URL(trimmed);
        const path = parsed.pathname.replace(/^\/+/, "");
        const decoded = decodeURIComponent(path);
        return decoded.startsWith("emoji/") ? decoded : "";
      } catch {
        return "";
      }
    }
    const clean = trimmed.replace(/^\/+/, "");
    return clean.startsWith("emoji/") ? clean : "";
  };

  const SmartCover = ({ item }: { item: Item }) => {
    const initial = item.cover || fallbackCover;
    const [src, setSrc] = useState(initial);
    const [retriedSignedURL, setRetriedSignedURL] = useState(false);
    const [swappedProtocol, setSwappedProtocol] = useState(false);

    const handleError = async () => {
      if (src === fallbackCover) return;

      if (!retriedSignedURL) {
        setRetriedSignedURL(true);
        const key = (item.coverKey || "").trim() || extractStorageKey(item.cover || src);
        if (key) {
          try {
            const params = new URLSearchParams({ key });
            const res = await fetch(`${API_BASE}/storage/url?${params.toString()}`, {
              credentials: "include",
            });
            if (res.ok) {
              const data = (await res.json()) as { url?: string };
              const refreshed = (data.url || "").trim();
              if (refreshed && refreshed !== src) {
                setSrc(refreshed);
                return;
              }
            }
          } catch {
            // ignore and continue fallback chain
          }
        }
      }

      if (!swappedProtocol && src.startsWith("https://")) {
        setSwappedProtocol(true);
        setSrc(src.replace("https://", "http://"));
        return;
      }

      setSrc(fallbackCover);
    };

    return (
      <Image
        src={src || fallbackCover}
        alt={item.title}
        width={512}
        height={512}
        unoptimized
        className="aspect-square w-full object-cover"
        onError={() => {
          void handleError();
        }}
      />
    );
  };

  // 避免重复渲染导致 handler 重新创建
  const gridItems = useMemo(() => items, [items]);

  return (
    <div className="columns-2 gap-4 space-y-4 md:columns-3 lg:columns-4 xl:columns-6">
      {gridItems.map((item) => (
        <Link
          href={`/collections/${item.id}`}
          key={item.id}
          className="group relative block overflow-hidden rounded-2xl bg-white transition-all hover:ring-2 hover:ring-emerald-500"
        >
          <SmartCover item={item} />
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
