import Link from "next/link";
import CollectionPreviewGrid from "@/components/categories/CollectionPreviewGrid";
import SmartImage from "@/components/common/SmartImage";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";
const PREVIEW_COUNT = 15;
const PAGE_SIZE = 12;

type IPItem = {
  id: number;
  name: string;
  slug: string;
  cover_url?: string;
  cover_thumb_url?: string;
  description?: string;
};

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

function normalizePreviewUrl(raw: string, options?: { staticForGif?: boolean }) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (!isImageFile(trimmed)) return "";
  const staticForGif = options?.staticForGif ?? true;
  if (staticForGif && isGifUrl(trimmed)) return buildStaticPreview(trimmed);
  return trimmed;
}

async function fetchIP(id: string) {
  try {
    const res = await fetch(`${API_BASE}/ips/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as IPItem;
  } catch {
    return null;
  }
}

async function fetchCollections(ipId: string, page: number, sort: string) {
  try {
    const params = new URLSearchParams({
      page_size: String(PAGE_SIZE),
      page: String(page),
      preview_count: String(PREVIEW_COUNT),
    });
    if (sort === "count") {
      params.set("sort", "file_count");
      params.set("order", "desc");
    } else {
      params.set("sort", "created_at");
      params.set("order", "desc");
    }
    const res = await fetch(`${API_BASE}/ips/${ipId}/collections?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return { items: [], total: 0 };
    const data = (await res.json()) as { items?: ApiCollection[]; total?: number };
    return {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === "number" ? data.total : 0,
    };
  } catch {
    return { items: [], total: 0 };
  }
}

const DEFAULT_CREATOR_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=creator-default";

function buildPagination(current: number, total: number) {
  if (total <= 1) return [];
  const items: (number | "ellipsis")[] = [];
  const pushPage = (value: number) => items.push(value);
  const pushEllipsis = () => {
    if (items[items.length - 1] !== "ellipsis") items.push("ellipsis");
  };
  if (total <= 9) {
    for (let i = 1; i <= total; i += 1) pushPage(i);
    return items;
  }
  if (current <= 5) {
    [1, 2, 3, 4, 5].forEach(pushPage);
    pushEllipsis();
    pushPage(total - 1);
    pushPage(total);
    return items;
  }
  if (current >= total - 3) {
    pushPage(1);
    pushEllipsis();
    for (let i = total - 4; i <= total; i += 1) pushPage(i);
    return items;
  }
  pushPage(1);
  pushEllipsis();
  pushPage(current - 1);
  pushPage(current);
  pushPage(current + 1);
  pushEllipsis();
  pushPage(total - 1);
  pushPage(total);
  return items;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams: Promise<{ page?: string; sort?: string }> | { page?: string; sort?: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const ipID = String(resolvedParams?.id || "");
  const currentPage = Math.max(1, Number.parseInt(resolvedSearchParams?.page || "1", 10) || 1);
  const sortKey = resolvedSearchParams?.sort === "count" ? "count" : "new";
  const ip = ipID ? await fetchIP(ipID) : null;
  const { items: collections, total } = ipID
    ? await fetchCollections(ipID, currentPage, sortKey)
    : { items: [], total: 0 };
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
  const pagination = buildPagination(currentPage, totalPages);

  const cards: CollectionCard[] = collections.map((item) => {
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
          .slice(0, PREVIEW_COUNT)
      : [];

    const previews = Array.isArray(item.preview_images)
      ? item.preview_images
          .map((url) => normalizePreviewUrl(url || ""))
          .filter((url) => Boolean(url) && isImageFile(url))
          .slice(0, PREVIEW_COUNT)
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

  return (
    <main className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/40 to-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <Link href="/trending" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-emerald-600 transition-colors">
            ← 返回 IP 馆
          </Link>
          <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative aspect-[16/10] w-44 shrink-0 overflow-hidden rounded-[2.5rem] bg-slate-50 shadow-sm ring-1 ring-inset ring-slate-100/50 sm:w-56">
                {ip?.cover_thumb_url || ip?.cover_url ? (
                  <SmartImage
                    url={ip.cover_thumb_url || ip.cover_url}
                    alt={ip.name}
                    className="object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                    <span className="text-5xl font-black text-slate-200/60">
                      {ip?.name?.slice(0, 1).toUpperCase() || "IP"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{ip?.name || "未命名 IP"}</h1>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {ip?.slug || "TRENDING IP"}
                  </span>
                </div>
                <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
                  {ip?.description || "该 IP 暂无详细描述，正在完善中..."}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  共收录 <span className="text-slate-700">{total}</span> 个相关合集
                </div>
              </div>
            </div>
            
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-slate-50 p-1 ring-1 ring-slate-100">
              <Link
                href={`/trending/${ipID}?sort=new&page=1`}
                className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
                  sortKey === "new" 
                    ? "bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/50" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                最新收录
              </Link>
              <Link
                href={`/trending/${ipID}?sort=count&page=1`}
                className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
                  sortKey === "count" 
                    ? "bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/50" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                表情最多
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-24 pt-8">
        <div className="mx-auto max-w-7xl px-6">
          {cards.length === 0 ? (
            <div className="rounded-[3rem] border-2 border-dashed border-slate-100 bg-slate-50/50 py-32 text-center">
              <p className="text-lg font-bold text-slate-400">暂无相关合集</p>
              <p className="mt-2 text-sm font-medium text-slate-400">该 IP 下还没有收录任何表情包合集。</p>
            </div>
          ) : (
            <>
              <CollectionPreviewGrid collections={cards} loading={false} />
              {totalPages > 1 && (
                <div className="mt-16 flex flex-wrap items-center justify-center gap-3 text-slate-500">
                  <Link
                    href={`/trending/${ipID}?sort=${sortKey}&page=${Math.max(1, currentPage - 1)}`}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 transition-all hover:border-emerald-200 hover:text-emerald-600 active:scale-90 ${
                      currentPage === 1 ? "pointer-events-none opacity-40" : ""
                    }`}
                  >
                    ‹
                  </Link>
                  {pagination.map((item, idx) =>
                    item === "ellipsis" ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">...</span>
                    ) : (
                      <Link
                        key={item}
                        href={`/trending/${ipID}?sort=${sortKey}&page=${item}`}
                        className={`flex h-10 w-10 items-center justify-center rounded-full font-bold transition-all active:scale-90 ${
                          currentPage === item
                            ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                            : "border border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-600"
                        }`}
                      >
                        {item}
                      </Link>
                    )
                  )}
                  <Link
                    href={`/trending/${ipID}?sort=${sortKey}&page=${Math.min(totalPages, currentPage + 1)}`}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 transition-all hover:border-emerald-200 hover:text-emerald-600 active:scale-90 ${
                      currentPage === totalPages ? "pointer-events-none opacity-40" : ""
                    }`}
                  >
                    ›
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
