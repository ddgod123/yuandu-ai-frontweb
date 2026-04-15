"use client";

import React, { useEffect, useMemo, useState } from "react";
import CollectionPreviewGrid from "@/components/categories/CollectionPreviewGrid";
import { Filter, ChevronDown, Eye } from "lucide-react";
import { API_BASE } from "@/lib/auth-client";
import { emitBehaviorEvent } from "@/lib/behavior-events";

const DESKTOP_PREVIEW_COUNT = 15;
const MOBILE_PREVIEW_COUNT = 9;
const MOBILE_BREAKPOINT = 768;
const PAGE_SIZE = 12;
const DEFAULT_CREATOR_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=creator-default";
const MOTION_PREF_STORAGE_KEY = "emoji:showcase:motion-preview-enabled";

type ApiCollection = {
  id: number;
  title: string;
  cover_url?: string;
  preview_images?: string[];
  preview_assets?: ApiPreviewAsset[];
  file_count?: number;
  creator_name?: string;
  creator_name_zh?: string;
  creator_name_en?: string;
  creator_avatar_url?: string;
  favorite_count?: number;
  like_count?: number;
  download_count?: number;
};

type ApiPreviewAsset = {
  static_url?: string;
  animated_url?: string;
  is_animated?: boolean;
  format?: string;
};

type CollectionCard = {
  id: number;
  title: string;
  author: string;
  authorAvatar: string;
  count: number;
  favoriteCount: number;
  likeCount: number;
  downloadCount: number;
  previewImages: string[];
  previewAssets: { staticUrl: string; animatedUrl?: string; isAnimated?: boolean }[];
};

type SortOption = {
  id: string;
  label: string;
  sort: string;
  order: "asc" | "desc";
};

type MediaFilterOption = {
  id: "all" | "animated" | "static";
  label: string;
};

const SORT_OPTIONS: SortOption[] = [
  { id: "time_desc", label: "按时间（最新）", sort: "created_at", order: "desc" },
  { id: "time_asc", label: "按时间（最早）", sort: "created_at", order: "asc" },
  { id: "like_desc", label: "按点赞数（高到低）", sort: "like_count", order: "desc" },
  { id: "favorite_desc", label: "按收藏数（高到低）", sort: "favorite_count", order: "desc" },
  { id: "download_desc", label: "按下载数（高到低）", sort: "download_count", order: "desc" },
];

const MEDIA_FILTER_OPTIONS: MediaFilterOption[] = [
  { id: "all", label: "全部" },
  { id: "animated", label: "动图" },
  { id: "static", label: "静态图" },
];

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;

function isImageFile(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return IMAGE_EXT_REGEX.test(clean);
}

function isGifUrl(value: string) {
  const clean = value.split("?")[0].split("#")[0].toLowerCase();
  return clean.endsWith(".gif");
}

function buildStaticPreview(url: string) {
  const val = (url || "").trim();
  if (!val) {
    return "";
  }
  const hasProtocol = val.startsWith("http://") || val.startsWith("https://") || val.startsWith("//");
  if (!hasProtocol) {
    return val;
  }
  if (val.includes("token=") || val.includes("e=")) {
    return val;
  }
  const separator = val.includes("?") ? "&" : "?";
  return `${val}${separator}imageMogr2/format/png`;
}

function normalizePreviewUrl(raw: string, options?: { staticForGif?: boolean }) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (!isImageFile(trimmed)) return "";
  const staticForGif = options?.staticForGif ?? true;
  if (staticForGif && isGifUrl(trimmed)) {
    return buildStaticPreview(trimmed);
  }
  return trimmed;
}

export default function ShowcasePage() {
  const [collections, setCollections] = useState<CollectionCard[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSortID, setSelectedSortID] = useState<string>(SORT_OPTIONS[0].id);
  const [selectedMediaType, setSelectedMediaType] = useState<MediaFilterOption["id"]>("all");
  const [previewCount, setPreviewCount] = useState(DESKTOP_PREVIEW_COUNT);
  const [motionEnabled, setMotionEnabled] = useState(false);

  const selectedSort = useMemo(
    () => SORT_OPTIONS.find((item) => item.id === selectedSortID) || SORT_OPTIONS[0],
    [selectedSortID]
  );

  useEffect(() => {
    emitBehaviorEvent("page_view_showcase", {
      metadata: {
        page: "showcase",
      },
    });
  }, []);

  useEffect(() => {
    const pickPreviewCount = () =>
      window.innerWidth < MOBILE_BREAKPOINT ? MOBILE_PREVIEW_COUNT : DESKTOP_PREVIEW_COUNT;
    const updatePreviewCount = () => setPreviewCount(pickPreviewCount());

    updatePreviewCount();
    window.addEventListener("resize", updatePreviewCount);
    return () => {
      window.removeEventListener("resize", updatePreviewCount);
    };
  }, []);

  useEffect(() => {
    let nextEnabled = false;
    try {
      const saved = window.localStorage.getItem(MOTION_PREF_STORAGE_KEY);
      if (saved === "1") {
        nextEnabled = true;
      } else if (saved === "0") {
        nextEnabled = false;
      } else {
        nextEnabled = false;
      }
    } catch {
      nextEnabled = false;
    }
    setMotionEnabled(nextEnabled);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSortID, selectedMediaType]);

  useEffect(() => {
    const controller = new AbortController();
    const loadCollections = async () => {
      setLoadingCollections(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams();
        params.set("page_size", String(PAGE_SIZE));
        params.set("page", String(currentPage));
        params.set("preview_count", String(previewCount));
        params.set("is_showcase", "true");
        params.set("sort", selectedSort.sort);
        params.set("order", selectedSort.order);
        if (selectedMediaType !== "all") {
          params.set("media_type", selectedMediaType);
        }
        const res = await fetch(`${API_BASE}/collections?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("failed");
        }
        const payload = (await res.json()) as { items?: ApiCollection[]; total?: number };
        const items = Array.isArray(payload.items) ? payload.items : [];
        const totalCount = typeof payload.total === "number" ? payload.total : items.length;

        const cards = items.map((item) => {
          const previewAssets = Array.isArray(item.preview_assets)
            ? item.preview_assets
                .map((asset) => {
                  const staticURL = normalizePreviewUrl(asset.static_url || "", { staticForGif: true });
                  const animatedURL = normalizePreviewUrl(asset.animated_url || "", { staticForGif: false });
                  if (!staticURL && !animatedURL) {
                    return null;
                  }
                  return {
                    staticUrl: staticURL || animatedURL,
                    animatedUrl: animatedURL || undefined,
                    isAnimated: Boolean(asset.is_animated),
                  };
                })
                .filter(
                  (
                    asset
                  ): asset is { staticUrl: string; animatedUrl: string | undefined; isAnimated: boolean } =>
                    Boolean(asset)
                )
                .slice(0, previewCount)
            : [];

          const previews = Array.isArray(item.preview_images)
            ? item.preview_images
                .map((u) => normalizePreviewUrl(u || ""))
                .filter((u) => Boolean(u) && isImageFile(u))
                .slice(0, previewCount)
            : [];
          const coverFallback = normalizePreviewUrl(item.cover_url || "");
          const previewImages =
            previews.length > 0
              ? previews
              : previewAssets.length > 0
              ? previewAssets.map((asset) => asset.staticUrl)
              : coverFallback
              ? [coverFallback]
              : [];
          const authorName =
            item.creator_name || item.creator_name_zh || item.creator_name_en || "官方";
          const authorAvatar = item.creator_avatar_url || DEFAULT_CREATOR_AVATAR;
          return {
            id: item.id,
            title: item.title || "未命名合集",
            author: authorName,
            authorAvatar,
            count: Number(item.file_count) || previewImages.length,
            favoriteCount: Number(item.favorite_count) || 0,
            likeCount: Number(item.like_count) || 0,
            downloadCount: Number(item.download_count) || 0,
            previewImages,
            previewAssets,
          };
        });

        if (!controller.signal.aborted) {
          setCollections(cards);
          setTotal(totalCount);
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setCollections([]);
        setTotal(0);
        setErrorMessage("加载失败，请稍后重试");
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCollections(false);
        }
      }
    };

    loadCollections();

    return () => {
      controller.abort();
    };
  }, [currentPage, selectedSort, selectedMediaType, previewCount]);

  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return [];
    const items: (number | "ellipsis")[] = [];
    const showPage = (num: number) => {
      items.push(num);
    };
    const showEllipsis = () => {
      if (items[items.length - 1] !== "ellipsis") {
        items.push("ellipsis");
      }
    };

    if (totalPages <= 9) {
      for (let i = 1; i <= totalPages; i += 1) {
        showPage(i);
      }
      return items;
    }

    const firstPages = [1, 2, 3, 4, 5];
    const lastPages = [totalPages - 1, totalPages];
    if (currentPage <= 5) {
      firstPages.forEach(showPage);
      showEllipsis();
      lastPages.forEach(showPage);
      return items;
    }

    if (currentPage >= totalPages - 3) {
      showPage(1);
      showEllipsis();
      for (let i = totalPages - 4; i <= totalPages; i += 1) {
        showPage(i);
      }
      return items;
    }

    showPage(1);
    showEllipsis();
    showPage(currentPage - 1);
    showPage(currentPage);
    showPage(currentPage + 1);
    showEllipsis();
    lastPages.forEach(showPage);
    return items;
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-slate-50/30">
      <div className="sticky top-16 z-40 bg-white/80 border-b border-slate-100 backdrop-blur-xl shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-slate-900">表情包赏析</h1>
                <div className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">
                  <Eye size={11} />
                  表情包展示
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  {total} Collections Found
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-50 pt-2">
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Filter
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-emerald-500 transition-colors"
                  />
                  <select
                    value={selectedSortID}
                    onChange={(event) => setSelectedSortID(event.target.value)}
                    className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-10 text-xs font-bold text-slate-600 outline-none transition-all hover:border-emerald-200 focus:ring-4 focus:ring-emerald-500/5"
                    aria-label="合集排序"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                </div>

                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/50 p-1">
                  {MEDIA_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedMediaType(option.id)}
                      className={`rounded-lg px-4 py-1.5 text-[11px] font-black transition-all ${
                        selectedMediaType === option.id
                          ? "bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextValue = !motionEnabled;
                    setMotionEnabled(nextValue);
                    try {
                      window.localStorage.setItem(MOTION_PREF_STORAGE_KEY, nextValue ? "1" : "0");
                    } catch {
                      // ignore localStorage exceptions
                    }
                  }}
                  className={`h-10 rounded-xl border px-3 text-xs font-bold transition ${
                    motionEnabled
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
                  aria-pressed={motionEnabled}
                >
                  动效预览：{motionEnabled ? "开" : "关"}
                </button>
              </div>

              <div className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                赏析合集
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {errorMessage ? (
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-500">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            {errorMessage}
          </div>
        ) : null}

        <div className="mb-6 flex items-center gap-2">
          <h2 className="text-xl font-black text-slate-900">全部赏析合集</h2>
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">
            {total} 个结果
          </span>
        </div>

        {!loadingCollections && collections.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 py-16 text-center">
            <div className="text-5xl">🎭</div>
            <div className="mt-3 text-lg font-black text-slate-900">暂时还没有赏析合集</div>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              运营上架后会第一时间展示在这里
            </p>
          </div>
        ) : (
          <CollectionPreviewGrid
            collections={collections}
            loading={loadingCollections}
            previewCount={previewCount}
            motionEnabled={motionEnabled}
            showDownloadMetric={false}
            onCollectionClick={(collectionId) =>
              emitBehaviorEvent("showcase_collection_click", {
                collection_id: collectionId,
                metadata: {
                  page: "showcase",
                },
              })
            }
          />
        )}

        {totalPages > 1 ? (
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2 text-slate-500">
            <button
              className="h-10 w-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              aria-label="上一页"
            >
              ‹
            </button>

            {paginationItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  className={`h-10 w-10 rounded-full font-bold transition-colors ${
                    currentPage === item
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </button>
              )
            )}

            <button
              className="h-10 w-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              aria-label="下一页"
            >
              ›
            </button>
            <span className="ml-2 text-sm">共 {totalPages} 页</span>
          </div>
        ) : null}
      </div>

      <div className="h-20" />
    </div>
  );
}
