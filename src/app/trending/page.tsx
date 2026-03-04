"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CollectionPreviewGrid from "@/components/categories/CollectionPreviewGrid";
import { ChevronDown, Filter } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";
const PREVIEW_COUNT = 15;
const PAGE_SIZE = 12;
const DEFAULT_CREATOR_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=creator-default";

type ApiCategory = {
  id: number;
  name: string;
  slug?: string;
  icon?: string;
  parent_id?: number | null;
  sort?: number;
};

type ChildCategoryOption = {
  id: string;
  name: string;
  icon: string;
  sort: number;
};

type ApiCollection = {
  id: number;
  title: string;
  cover_url?: string;
  preview_images?: string[];
  file_count?: number;
  creator_name?: string;
  creator_name_zh?: string;
  creator_name_en?: string;
  creator_avatar_url?: string;
  favorite_count?: number;
  like_count?: number;
  download_count?: number;
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
};

type SortOption = {
  id: string;
  label: string;
  sort: string;
  order: "asc" | "desc";
};

const SORT_OPTIONS: SortOption[] = [
  { id: "time_desc", label: "按时间（最新）", sort: "created_at", order: "desc" },
  { id: "like_desc", label: "按点赞数（高到低）", sort: "like_count", order: "desc" },
  { id: "favorite_desc", label: "按收藏数（高到低）", sort: "favorite_count", order: "desc" },
  { id: "download_desc", label: "按下载数（高到低）", sort: "download_count", order: "desc" },
];

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp)$/i;

function parsePositiveInt(raw?: string | null, fallback = 1) {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

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
  if (!val) return "";
  const hasProtocol = val.startsWith("http://") || val.startsWith("https://") || val.startsWith("//");
  if (!hasProtocol) return val;
  if (val.includes("token=") || val.includes("e=")) return val;
  const separator = val.includes("?") ? "&" : "?";
  return `${val}${separator}imageMogr2/format/png`;
}

function normalizePreviewUrl(raw: string) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (!isImageFile(trimmed)) return "";
  if (isGifUrl(trimmed)) return buildStaticPreview(trimmed);
  return trimmed;
}

function findIPRootCategory(categories: ApiCategory[]) {
  const topCategories = categories.filter((item) => !item.parent_id);
  if (!topCategories.length) return null;

  const scoreCategory = (item: ApiCategory) => {
    const name = (item.name || "").trim();
    const slug = (item.slug || "").trim();
    const compactName = name.replace(/\s+/g, "");
    const compactSlug = slug.toLowerCase().replace(/[-_\s]+/g, "");

    if (name === "IP人物" || compactName === "IP人物") return 100;
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

export default function TrendingPage() {
  const router = useRouter();
  const [rootCategory, setRootCategory] = useState<ApiCategory | null>(null);
  const [childCategories, setChildCategories] = useState<ChildCategoryOption[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("all");
  const [selectedSortID, setSelectedSortID] = useState<string>(SORT_OPTIONS[0].id);
  const [collections, setCollections] = useState<CollectionCard[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [queryReady, setQueryReady] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasInitializedFilters = useRef(false);

  const selectedSort = useMemo(
    () => SORT_OPTIONS.find((item) => item.id === selectedSortID) || SORT_OPTIONS[0],
    [selectedSortID]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const categoryParam = (params.get("category") || "all").trim();
    const sortParam = (params.get("sort") || "").trim();
    const pageParam = parsePositiveInt(params.get("page"), 1);

    setSelectedChild(categoryParam || "all");
    setSelectedSortID(
      SORT_OPTIONS.some((item) => item.id === sortParam) ? sortParam : SORT_OPTIONS[0].id
    );
    setCurrentPage(pageParam);
    setQueryReady(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadCategories = async () => {
      setLoadingCategories(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`${API_BASE}/categories`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error("failed to load categories");
        }
        const data = (await res.json()) as ApiCategory[];
        if (!Array.isArray(data)) {
          throw new Error("invalid categories");
        }

        const ipRoot = findIPRootCategory(data);
        setRootCategory(ipRoot);

        if (!ipRoot) {
          setChildCategories([]);
          setSelectedChild("all");
          return;
        }

        const children = data
          .filter((item) => item.parent_id === ipRoot.id)
          .map((item) => ({
            id: String(item.id),
            name: item.name,
            icon: item.icon && item.icon.trim() ? item.icon : "🏷️",
            sort: typeof item.sort === "number" ? item.sort : 0,
          }))
          .sort((a, b) => {
            if (a.sort !== b.sort) return a.sort - b.sort;
            return Number(a.id) - Number(b.id);
          });

        setChildCategories(children);
        setSelectedChild((prev) => {
          if (prev === "all") return "all";
          return children.some((item) => item.id === prev) ? prev : "all";
        });
      } catch {
        if (controller.signal.aborted) return;
        setErrorMessage("加载 IP 分类失败，请稍后重试");
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCategories(false);
        }
      }
    };

    loadCategories();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!queryReady) return;
    if (!hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      return;
    }
    setCurrentPage(1);
  }, [queryReady, selectedChild, selectedSortID]);

  useEffect(() => {
    if (!queryReady || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (selectedChild !== "all") params.set("category", selectedChild);
    else params.delete("category");

    if (selectedSortID !== SORT_OPTIONS[0].id) params.set("sort", selectedSortID);
    else params.delete("sort");
    params.delete("ip");

    if (currentPage > 1) params.set("page", String(currentPage));
    else params.delete("page");

    const nextQuery = params.toString();
    const nextURL = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    router.replace(nextURL, { scroll: false });
  }, [queryReady, selectedChild, selectedSortID, currentPage, router]);

  useEffect(() => {
    if (!queryReady) return;
    if (!rootCategory) {
      setCollections([]);
      setTotal(0);
      return;
    }

    const controller = new AbortController();
    const loadCollections = async () => {
      setLoadingCollections(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams();
        params.set("page_size", String(PAGE_SIZE));
        params.set("page", String(currentPage));
        params.set("preview_count", String(PREVIEW_COUNT));
        params.set("sort", selectedSort.sort);
        params.set("order", selectedSort.order);

        if (selectedChild !== "all") {
          params.set("category_id", selectedChild);
        } else if (childCategories.length > 0) {
          params.set("category_ids", [String(rootCategory.id), ...childCategories.map((item) => item.id)].join(","));
        } else {
          params.set("category_id", String(rootCategory.id));
        }

        const res = await fetch(`${API_BASE}/collections?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("failed to load collections");
        }

        const payload = (await res.json()) as { items?: ApiCollection[]; total?: number };
        const items = Array.isArray(payload.items) ? payload.items : [];
        const totalCount = typeof payload.total === "number" ? payload.total : items.length;

        const cards = items.map((item) => {
          const previews = Array.isArray(item.preview_images)
            ? item.preview_images
                .map((url) => normalizePreviewUrl(url || ""))
                .filter((url) => Boolean(url) && isImageFile(url))
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
          setErrorMessage(null);
        }
      } catch {
        if (controller.signal.aborted) return;
        setCollections([]);
        setTotal(0);
        setErrorMessage("加载 IP 合集失败，请稍后重试");
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCollections(false);
        }
      }
    };

    loadCollections();
    return () => controller.abort();
  }, [queryReady, rootCategory, childCategories, selectedChild, currentPage, selectedSort]);

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
      for (let i = 1; i <= totalPages; i += 1) showPage(i);
      return items;
    }
    if (currentPage <= 5) {
      [1, 2, 3, 4, 5].forEach(showPage);
      showEllipsis();
      showPage(totalPages - 1);
      showPage(totalPages);
      return items;
    }
    if (currentPage >= totalPages - 3) {
      showPage(1);
      showEllipsis();
      for (let i = totalPages - 4; i <= totalPages; i += 1) showPage(i);
      return items;
    }
    showPage(1);
    showEllipsis();
    showPage(currentPage - 1);
    showPage(currentPage);
    showPage(currentPage + 1);
    showEllipsis();
    showPage(totalPages - 1);
    showPage(totalPages);
    return items;
  }, [currentPage, totalPages]);

  const selectedChildLabel = useMemo(() => {
    if (selectedChild === "all") return "全部子分类";
    return childCategories.find((item) => item.id === selectedChild)?.name || "全部子分类";
  }, [childCategories, selectedChild]);

  return (
    <main className="min-h-screen bg-white">
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black text-slate-900">表情包IP</h1>
              <p className="mt-2 text-sm font-medium text-slate-500">
                展示“IP人物”分类下的合集内容，支持按二级分类快速筛选。
              </p>
            </div>
            {rootCategory ? (
              <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500">
                一级分类：{rootCategory.name} · {total} 个合集
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedChild("all")}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                selectedChild === "all"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              全部
            </button>
            {childCategories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedChild(item.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${
                  selectedChild === item.id
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </button>
            ))}
            <div className="relative shrink-0">
              <Filter
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <select
                value={selectedSortID}
                onChange={(event) => setSelectedSortID(event.target.value)}
                className="h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm font-bold text-slate-600 outline-none transition-colors hover:bg-slate-50 focus:border-emerald-300"
                aria-label="IP 合集排序"
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
            <div className="ml-1 text-xs font-semibold text-slate-400">
              当前筛选：{selectedChildLabel}
            </div>
            {(selectedChild !== "all" || selectedSortID !== SORT_OPTIONS[0].id) ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedChild("all");
                  setSelectedSortID(SORT_OPTIONS[0].id);
                  setCurrentPage(1);
                }}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50"
              >
                清空筛选
              </button>
            ) : null}
            {rootCategory && childCategories.length === 0 ? (
              <span className="ml-1 text-xs font-semibold text-slate-400">
                当前一级分类暂无二级分类，默认展示该一级分类下全部合集
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        {loadingCategories ? (
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
            正在加载分类...
          </div>
        ) : null}

        {!loadingCategories && !rootCategory ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            未找到一级分类“IP人物”。请在管理端确认分类名称后刷新页面。
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {errorMessage}
          </div>
        ) : null}

        {rootCategory ? (
          <>
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
          </>
        ) : null}
      </section>
    </main>
  );
}
