"use client";

import React, { useEffect, useMemo, useState } from "react";
import CollectionPreviewGrid from "@/components/categories/CollectionPreviewGrid";
import { Filter, ChevronDown } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";
const PREVIEW_COUNT = 15;
const PAGE_SIZE = 12;
const DEFAULT_CREATOR_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=creator-default";

type ApiCategory = {
  id: number;
  name: string;
  slug?: string;
  icon?: string;
  cover_url?: string;
  parent_id?: number | null;
  description?: string;
  sort?: number;
};

type CategoryOption = {
  id: string;
  name: string;
  icon: string;
  parentId?: string | null;
  children?: CategoryOption[];
};

type ApiCollection = {
  id: number;
  title: string;
  cover_url?: string;
  preview_images?: string[];
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

function findIPRootCategory(categories: ApiCategory[]) {
  const topCategories = categories.filter((item) => !item.parent_id);
  if (!topCategories.length) return null;

  const scoreCategory = (item: ApiCategory) => {
    const name = (item.name || "").trim();
    const slug = (item.slug || "").trim();
    const compactName = name.replace(/\s+/g, "");
    const compactSlug = slug.toLowerCase().replace(/[-_\s]+/g, "");

    if (name === "IP人物" || compactName === "IP人物" || compactName.toLowerCase() === "ip人物") return 100;
    if (/ip/i.test(name) && name.includes("人物")) return 80;
    if (compactName.includes("IP") && compactName.includes("人物")) return 70;
    if (compactSlug === "ip人物" || compactSlug === "ippeople" || compactSlug === "ipcharacter") return 60;
    if (slug.toLowerCase().includes("ip") && name.includes("人物")) return 50;
    return -1;
  };

  const sorted = [...topCategories].sort((a, b) => {
    const scoreDiff = scoreCategory(b) - scoreCategory(a);
    if (scoreDiff !== 0) return scoreDiff;
    const sortA = typeof a.sort === "number" ? a.sort : 0;
    const sortB = typeof b.sort === "number" ? b.sort : 0;
    if (sortA !== sortB) return sortA - sortB;
    return a.id - b.id;
  });

  return scoreCategory(sorted[0]) >= 0 ? sorted[0] : null;
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

function normalizePreviewUrl(raw: string) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (!isImageFile(trimmed)) return "";
  if (isGifUrl(trimmed)) {
    return buildStaticPreview(trimmed);
  }
  return trimmed;
}

export default function CategoriesPage() {
  const [selectedTop, setSelectedTop] = useState<CategoryKey>(fallbackCategory.id);
  const [selectedChild, setSelectedChild] = useState<CategoryKey>(fallbackChild.id);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [collections, setCollections] = useState<CollectionCard[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSortID, setSelectedSortID] = useState<string>(SORT_OPTIONS[0].id);
  const [selectedMediaType, setSelectedMediaType] = useState<MediaFilterOption["id"]>("all");

  const selectedSort = useMemo(
    () => SORT_OPTIONS.find((item) => item.id === selectedSortID) || SORT_OPTIONS[0],
    [selectedSortID]
  );

  const topCategories = useMemo(() => {
    return [fallbackCategory, ...categories];
  }, [categories]);

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
    return selectedTopCategory.children || [];
  }, [selectedTopCategory]);

  useEffect(() => {
    const controller = new AbortController();
    const loadCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`, { signal: controller.signal });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ApiCategory[];
        if (!Array.isArray(data)) {
          return;
        }

        const ipRoot = findIPRootCategory(data);
        const ipRootID = ipRoot ? String(ipRoot.id) : null;

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
          };
          categoryMap.set(category.id, category);
        });

        // 第二遍：建立父子关系
        categoryMap.forEach((category) => {
          if (category.parentId && categoryMap.has(category.parentId)) {
            const parent = categoryMap.get(category.parentId)!;
            parent.children!.push(category);
          } else if (!category.parentId && category.id !== ipRootID) {
            rootCategories.push(category);
          }
        });

        setCategories(rootCategories);

        const topIds = new Set(rootCategories.map((item) => item.id));
        setSelectedTop((prevTop) => {
          if (prevTop !== "all" && !topIds.has(prevTop)) {
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
        params.set("preview_count", String(PREVIEW_COUNT));

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
        });
        if (!res.ok) {
          throw new Error("failed");
        }
        const payload = (await res.json()) as { items?: ApiCollection[]; total?: number };
        const items = Array.isArray(payload.items) ? payload.items : [];
        const totalCount = typeof payload.total === "number" ? payload.total : items.length;

        const cards = items.map((item) => {
          const previews = Array.isArray(item.preview_images)
            ? item.preview_images
                .map((u) => normalizePreviewUrl(u || ""))
                .filter((u) => Boolean(u) && isImageFile(u))
                .slice(0, PREVIEW_COUNT)
            : [];
          const coverFallback = normalizePreviewUrl(item.cover_url || "");
          const previewImages = previews.length > 0 ? previews : coverFallback ? [coverFallback] : [];
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
  }, [selectedTop, selectedChild, selectedTopCategory, currentPage, selectedSort, selectedMediaType]);

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
    <div className="min-h-screen bg-white">
      <div className="sticky top-16 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <Filter
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <select
                value={selectedSortID}
                onChange={(event) => setSelectedSortID(event.target.value)}
                className="h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm font-bold text-slate-600 outline-none transition-colors hover:bg-slate-50 focus:border-emerald-300"
                aria-label="合集排序"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              {MEDIA_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedMediaType(option.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                    selectedMediaType === option.id
                      ? "bg-emerald-500 text-white"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {topCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedTop(cat.id);
                    setSelectedChild("all");
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap font-bold transition-all text-sm ${
                    selectedTop === cat.id
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.icon ? <span>{cat.icon}</span> : null}
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            {selectedTop !== "all" && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[fallbackChild, ...childCategories].map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChild(child.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap font-medium text-xs transition-all ${
                      selectedChild === child.id
                        ? "bg-emerald-400 text-white shadow-md shadow-emerald-100"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span>{child.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {errorMessage}
          </div>
        ) : null}

        <CollectionPreviewGrid collections={collections} loading={loadingCollections} />

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
