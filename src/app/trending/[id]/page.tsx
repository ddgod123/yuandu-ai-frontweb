import Link from "next/link";
import Image from "next/image";
import CollectionPreviewGrid from "@/components/categories/CollectionPreviewGrid";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";
const PREVIEW_COUNT = 15;
const PAGE_SIZE = 12;

type IPItem = {
  id: number;
  name: string;
  slug: string;
  cover_url?: string;
  description?: string;
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
  params: { id: string };
  searchParams: { page?: string; sort?: string };
}) {
  const currentPage = Math.max(1, Number.parseInt(searchParams.page || "1", 10) || 1);
  const sortKey = searchParams.sort === "count" ? "count" : "new";
  const ip = await fetchIP(params.id);
  const { items: collections, total } = await fetchCollections(params.id, currentPage, sortKey);
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
  const pagination = buildPagination(currentPage, totalPages);

  const cards: CollectionCard[] = collections.map((item) => {
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

  return (
    <main className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/40 to-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Link href="/trending" className="text-xs font-semibold text-emerald-600 hover:underline">
            ← 返回 IP 馆
          </Link>
          <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="h-28 w-28 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              {ip?.cover_url ? (
                <Image src={ip.cover_url} alt={ip.name} width={112} height={112} unoptimized className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black text-slate-300">
                  {ip?.name?.slice(0, 1) || "IP"}
                </div>
              )}
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900">{ip?.name || "IP 专题"}</div>
              <div className="mt-2 text-sm text-slate-500">{ip?.description || "暂无简介"}</div>
              <div className="mt-3 text-xs font-semibold text-slate-400">
                共 {total} 个合集
              </div>
            </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Link
                href={`/trending/${params.id}?sort=new&page=1`}
                className={`rounded-full px-4 py-2 transition ${
                  sortKey === "new" ? "bg-emerald-500 text-white" : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                最新
              </Link>
              <Link
                href={`/trending/${params.id}?sort=count&page=1`}
                className={`rounded-full px-4 py-2 transition ${
                  sortKey === "count" ? "bg-emerald-500 text-white" : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                数量
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="mx-auto max-w-6xl px-6">
          {cards.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-400">暂无合集中该 IP 的数据</div>
          ) : (
            <>
              <CollectionPreviewGrid collections={cards} loading={false} />
              {totalPages > 1 && (
                <div className="mt-12 flex flex-wrap items-center justify-center gap-2 text-slate-500">
                  <Link
                    href={`/trending/${params.id}?sort=${sortKey}&page=${Math.max(1, currentPage - 1)}`}
                    className={`h-10 w-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 ${
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
                        href={`/trending/${params.id}?sort=${sortKey}&page=${item}`}
                        className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                          currentPage === item
                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {item}
                      </Link>
                    )
                  )}
                  <Link
                    href={`/trending/${params.id}?sort=${sortKey}&page=${Math.min(totalPages, currentPage + 1)}`}
                    className={`h-10 w-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 ${
                      currentPage === totalPages ? "pointer-events-none opacity-40" : ""
                    }`}
                  >
                    ›
                  </Link>
                  <span className="ml-2 text-sm">共 {totalPages} 页</span>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
