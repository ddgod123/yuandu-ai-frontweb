"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import CollectionPreviewGrid from "@/components/categories/CollectionPreviewGrid";
import { Filter, ChevronDown } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";
const DESKTOP_PREVIEW_COUNT = 15;
const MOBILE_PREVIEW_COUNT = 9;
const MOBILE_BREAKPOINT = 768;
const PAGE_SIZE = 12;
const DEFAULT_CREATOR_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=creator-default";
const MOTION_PREF_STORAGE_KEY = "emoji:categories:motion-preview-enabled";

type ApiCategory = {
  id: number;
  name: string;
  slug?: string;
  icon?: string;
  cover_url?: string;
  parent_id?: number | null;
  description?: string;
  sort?: number;
  public_collection_count?: number;
};

type CategoryOption = {
  id: string;
  name: string;
  icon: string;
  parentId?: string | null;
  children?: CategoryOption[];
  publicCollectionCount?: number;
};

type ApiCollection = {
  id: number;
  title: string;
  cover_url?: string;
  preview_images?: string[];
  preview_assets?: ApiPreviewAsset[];
  owner_id?: number;
  category_id?: number | null;
  file_count?: number;
  download_code?: string;
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

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;

function isImageFile(url?: string | null) {
  if (!url) return false;
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  return IMAGE_EXT_REGEX.test(clean);
}

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

const fallbackCategory: CategoryOption = { id: "all", name: "全部", icon: "🌈" };
const fallbackChild: CategoryOption = { id: "all", name: "全部", icon: "" };

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

type CategoryKey = "all" | string;

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

function getCategoryPublicCollectionCount(category: CategoryOption): number | null {
  let known = false;
  let total = 0;

  if (typeof category.publicCollectionCount === "number") {
    known = true;
    total += Math.max(0, category.publicCollectionCount);
  }

  (category.children || []).forEach((child) => {
    const childCount = getCategoryPublicCollectionCount(child);
    if (typeof childCount === "number") {
      known = true;
      total += childCount;
    }
  });

  return known ? total : null;
}

export default function CategoriesPage() {
  const [selectedTop, setSelectedTop] = useState<CategoryKey>(fallbackCategory.id);
  const [selectedChild, setSelectedChild] = useState<CategoryKey>(fallbackChild.id);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryPublicCountFallback, setCategoryPublicCountFallback] = useState<Record<string, number>>({});
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

  const resolveCategoryOwnPublicCount = useCallback(
    (category: CategoryOption): number | null => {
      if (typeof category.publicCollectionCount === "number") {
        return Math.max(0, category.publicCollectionCount);
      }
      if (Object.prototype.hasOwnProperty.call(categoryPublicCountFallback, category.id)) {
        return Math.max(0, categoryPublicCountFallback[category.id]);
      }
      return null;
    },
    [categoryPublicCountFallback]
  );

  const resolveCategoryAggregatePublicCount = useCallback(
    (category: CategoryOption): number | null => {
      let known = false;
      let total = 0;

      const ownCount = resolveCategoryOwnPublicCount(category);
      if (typeof ownCount === "number") {
        known = true;
        total += ownCount;
      }

      (category.children || []).forEach((child) => {
        const childCount = resolveCategoryAggregatePublicCount(child);
        if (typeof childCount === "number") {
          known = true;
          total += childCount;
        }
      });

      return known ? total : null;
    },
    [resolveCategoryOwnPublicCount]
  );

  const topCategories = useMemo(() => {
    const visibleTopCategories = categories.filter((category) => {
      const count = resolveCategoryAggregatePublicCount(category);
      if (count === null) return true;
      return count >= 1;
    });
    return [fallbackCategory, ...visibleTopCategories];
  }, [categories, resolveCategoryAggregatePublicCount]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    categories.forEach((cat) => {
      map.set(cat.id, cat);
      cat.children?.forEach((child) => {
        map.set(child.id, child);
      });
    });
    return map;
  }, [categories]);

  const selectedTopCategory = useMemo(() => {
    if (selectedTop === "all") return null;
    return categoryMap.get(selectedTop) || null;
  }, [categoryMap, selectedTop]);

  const childCategories = useMemo(() => {
    if (!selectedTopCategory) return [];
    const children = selectedTopCategory.children || [];
    return children.filter((child) => {
      const count = resolveCategoryOwnPublicCount(child);
      if (count === null) return true;
      return count >= 1;
    });
  }, [selectedTopCategory, resolveCategoryOwnPublicCount]);

  useEffect(() => {
    let cancelled = false;
    const allCategories: CategoryOption[] = [];
    categories.forEach((top) => {
      allCategories.push(top);
      (top.children || []).forEach((child) => allCategories.push(child));
    });

    const needFallback = allCategories.filter((item) => typeof item.publicCollectionCount !== "number");
    if (!needFallback.length) {
      setCategoryPublicCountFallback({});
      return;
    }

    const loadFallbackCounts = async () => {
      const entries = await Promise.all(
        needFallback.map(async (category) => {
          try {
            const params = new URLSearchParams();
            params.set("page_size", "1");
            params.set("page", "1");
            params.set("category_id", category.id);
            const res = await fetch(`${API_BASE}/collections?${params.toString()}`, {
              cache: "no-store",
            });
            if (!res.ok) return [category.id, 0] as const;
            const payload = (await res.json()) as { total?: number };
            const totalCount = typeof payload.total === "number" ? payload.total : 0;
            return [category.id, Math.max(0, totalCount)] as const;
          } catch {
            return [category.id, 0] as const;
          }
        })
      );

      if (cancelled) return;
      const nextMap: Record<string, number> = {};
      entries.forEach(([id, count]) => {
        nextMap[id] = count;
      });
      setCategoryPublicCountFallback(nextMap);
    };

    void loadFallbackCounts();
    return () => {
      cancelled = true;
    };
  }, [categories]);

  useEffect(() => {
    if (selectedTop === "all") return;
    const isVisible = topCategories.some((item) => item.id === selectedTop);
    if (!isVisible) {
      setSelectedTop("all");
      setSelectedChild("all");
    }
  }, [selectedTop, topCategories]);

  useEffect(() => {
    if (selectedChild === "all") return;
    const isVisible = childCategories.some((item) => item.id === selectedChild);
    if (!isVisible) {
      setSelectedChild("all");
    }
  }, [selectedChild, childCategories]);

  useEffect(() => {
    const controller = new AbortController();
    const loadCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ApiCategory[];
        if (!Array.isArray(data)) {
          return;
        }

        // 构建层级结构
        const categoryMap = new Map<string, CategoryOption>();
        const rootCategories: CategoryOption[] = [];

        // 第一遍：创建所有分类对象
        data.forEach((item) => {
          const category: CategoryOption = {
            id: String(item.id),
            name: item.name,
            icon: item.icon && item.icon.trim() !== "" ? item.icon : "🏷️",
            parentId: item.parent_id ? String(item.parent_id) : null,
            children: [],
            publicCollectionCount:
              typeof item.public_collection_count === "number"
                ? item.public_collection_count
                : undefined,
          };
          categoryMap.set(category.id, category);
        });

        // 第二遍：建立父子关系
        categoryMap.forEach((category) => {
          if (category.parentId && categoryMap.has(category.parentId)) {
            const parent = categoryMap.get(category.parentId)!;
            parent.children!.push(category);
          } else if (!category.parentId) {
            rootCategories.push(category);
          }
        });

        setCategories(rootCategories);

        const visibleTopIds = new Set(
          rootCategories
            .filter((item) => {
              const count = getCategoryPublicCollectionCount(item);
              if (count === null) return true;
              return count >= 1;
            })
            .map((item) => item.id)
        );
        setSelectedTop((prevTop) => {
          if (prevTop !== "all" && !visibleTopIds.has(prevTop)) {
            setSelectedChild("all");
            return "all";
          }
          if (prevTop === "all") {
            setSelectedChild("all");
            return prevTop;
          }
          const currentTop = rootCategories.find((cat) => cat.id === prevTop) || null;
          if (!currentTop) {
            setSelectedChild("all");
            return prevTop;
          }
          const childIds = new Set((currentTop.children || []).map((c) => c.id));
          setSelectedChild((prevChild) =>
            prevChild !== "all" && !childIds.has(prevChild) ? "all" : prevChild
          );
          return prevTop;
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }
      }
    };

    loadCategories();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTop, selectedChild, selectedSortID, selectedMediaType]);

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

        // 如果选中的是父分类，包含所有子分类
        if (selectedTop !== "all") {
          if (selectedChild !== "all") {
            params.set("category_id", selectedChild);
          } else {
            const children = selectedTopCategory?.children || [];
            if (children.length > 0) {
              const categoryIds = [selectedTop, ...children.map((c) => c.id)];
              params.set("category_ids", categoryIds.join(","));
            } else {
              params.set("category_id", selectedTop);
            }
          }
        }

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
  }, [selectedTop, selectedChild, selectedTopCategory, currentPage, selectedSort, selectedMediaType, previewCount]);

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
      <div className="sticky top-16 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-6">
            {/* 顶层分类选择 - 铺满展示 */}
            <div className="flex flex-wrap items-center gap-3">
              {topCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedTop(cat.id);
                    setSelectedChild("all");
                  }}
                  className={`group flex items-center gap-2 px-4 py-2 rounded-xl font-black transition-all text-sm ${
                    selectedTop === cat.id
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-200 scale-105"
                      : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <span className={`text-base transition-transform group-hover:scale-110 ${selectedTop === cat.id ? "scale-110" : ""}`}>
                    {cat.icon || "🏷️"}
                  </span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            {/* 子分类与过滤器行 */}
            <div className="flex flex-col gap-6 pt-2 border-t border-slate-50">
              {selectedTop !== "all" && childCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {[fallbackChild, ...childCategories].map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChild(child.id)}
                      className={`flex items-center px-4 py-1.5 rounded-lg font-bold text-xs transition-all border ${
                        selectedChild === child.id
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm"
                          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600"
                      }`}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
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

                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    {total} Collections Found
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {errorMessage ? (
          <div className="mb-8 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-500 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            {errorMessage}
          </div>
        ) : null}

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">
              {selectedTopCategory?.name || "全部合集"}
            </h2>
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">
              {total} 个结果
            </span>
          </div>
        </div>

        <CollectionPreviewGrid
          collections={collections}
          loading={loadingCollections}
          previewCount={previewCount}
          motionEnabled={motionEnabled}
        />

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
                <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
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
