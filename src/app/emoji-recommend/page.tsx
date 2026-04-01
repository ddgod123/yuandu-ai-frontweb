import Link from "next/link";
import { ChevronRight, Image as ImageIcon } from "lucide-react";
import LatestGrid from "@/components/home/LatestGrid";
import FeaturedCollections from "@/components/home/FeaturedCollections";

export const dynamic = "force-dynamic";

function resolveApiBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE || "/api").trim();
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, "");
  }
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return `http://127.0.0.1:5050${normalized}`.replace(/\/+$/, "");
}

const API_BASE = resolveApiBase();
const FETCH_TIMEOUT_MS = 8000;

type CollectionBrief = {
  id: number;
  title: string;
  cover_url?: string;
  file_count?: number;
  creator_name?: string;
  creator_name_zh?: string;
  creator_name_en?: string;
  like_count?: number;
  favorite_count?: number;
  download_count?: number;
  created_at?: string;
};

type HomeStats = {
  total_collections?: number;
  total_emojis?: number;
  today_new_emojis?: number;
};

async function fetchHomeStats(): Promise<HomeStats | null> {
  try {
    const res = await fetch(`${API_BASE}/stats/home`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HomeStats;
    return data;
  } catch {
    // ignore
  }
  return null;
}

async function fetchLatestCollections(limit = 12): Promise<CollectionBrief[]> {
  try {
    const params = new URLSearchParams({
      page: "1",
      page_size: String(limit),
      sort: "created_at",
      order: "desc",
    });
    const res = await fetch(`${API_BASE}/collections?${params.toString()}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: CollectionBrief[] };
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchFeaturedCollections(limit = 4): Promise<CollectionBrief[]> {
  try {
    const params = new URLSearchParams({
      page: "1",
      page_size: String(limit),
      sort: "created_at",
      order: "desc",
      is_featured: "1",
    });
    const res = await fetch(`${API_BASE}/collections?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: CollectionBrief[] };
    return (data.items || []).slice(0, limit);
  } catch {
    return [];
  }
}

export default async function EmojiRecommendPage() {
  const homeStats = await fetchHomeStats();
  const todayText =
    typeof homeStats?.today_new_emojis === "number"
      ? homeStats.today_new_emojis.toLocaleString()
      : "--";
  const totalCollectionsText =
    typeof homeStats?.total_collections === "number"
      ? homeStats.total_collections.toLocaleString()
      : "--";
  const totalEmojisText =
    typeof homeStats?.total_emojis === "number"
      ? homeStats.total_emojis.toLocaleString()
      : "--";
  const latestCollections = await fetchLatestCollections(12);
  const featuredCollections = await fetchFeaturedCollections(4);

  const latestWithCovers = await Promise.all(
    latestCollections.map(async (item) => ({
      ...item,
      cover: (item.cover_url || "").trim(),
    }))
  );
  const featuredWithCovers = await Promise.all(
    featuredCollections.map(async (item) => ({
      ...item,
      cover: (item.cover_url || "").trim(),
      author: item.creator_name || item.creator_name_zh || item.creator_name_en || "官方推荐",
    }))
  );
  const fallbackCover = "https://api.dicebear.com/7.x/bottts/svg?seed=placeholder";

  return (
    <main className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-white pb-20 pt-24 lg:pb-32 lg:pt-36">
        <div className="absolute right-0 top-0 h-[600px] w-[600px] translate-x-1/4 -translate-y-1/2 rounded-full bg-emerald-50/40 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[600px] w-[600px] -translate-x-1/4 translate-y-1/2 rounded-full bg-blue-50/40 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <div className="mx-auto mb-10 inline-flex items-center gap-3 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-emerald-600 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-100/50 transition-transform hover:scale-105">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            今日已新增 <span className="text-emerald-700">{todayText}</span> 张图片
          </div>

          <h1 className="text-6xl font-black tracking-tighter text-slate-900 md:text-8xl lg:text-9xl">
            表情包<span className="text-emerald-500">档案馆</span>
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-lg font-medium leading-relaxed text-slate-500 md:text-2xl">
            在这里，我们用表情包记录情绪。已收录{" "}
            <span className="font-bold text-slate-900">{totalCollectionsText}</span> 个合集、
            <span className="font-bold text-slate-900">{totalEmojisText}</span> 张表情。
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-6">
            <Link
              href="/categories"
              className="group relative flex h-16 items-center justify-center overflow-hidden rounded-[2rem] bg-slate-900 px-10 text-lg font-bold text-white shadow-2xl shadow-slate-200 transition-all hover:-translate-y-1 hover:bg-emerald-500 hover:shadow-emerald-200 active:translate-y-0"
            >
              <span className="relative z-10">立即开启浏览</span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-transform duration-500 group-hover:translate-x-0" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 flex flex-col items-center text-center md:flex-row md:items-end md:justify-between md:text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">
                <div className="h-1 w-8 rounded-full bg-emerald-500" />
                Featured
              </div>
              <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">推荐合集</h2>
              <p className="max-w-md text-base font-medium text-slate-400">来自后台勾选“推荐”的合集，首页固定展示最多 4 个。</p>
            </div>
            <Link href="/categories" className="group mt-6 flex items-center gap-2 text-sm font-bold text-emerald-600 hover:underline md:mt-0">
              查看全部 <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {featuredWithCovers.length > 0 ? (
            <FeaturedCollections items={featuredWithCovers} />
          ) : (
            <div className="rounded-[3rem] border-2 border-dashed border-slate-100 bg-slate-50/50 px-6 py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
                <ImageIcon size={32} />
              </div>
              <p className="text-lg font-bold text-slate-400">当前还没有被标记为推荐的合集</p>
              <p className="mt-2 text-sm font-medium text-slate-400">可在管理后台编辑合集时勾选“推荐”</p>
            </div>
          )}
        </div>
      </section>

      <section className="relative overflow-hidden bg-slate-50/50 py-24 lg:py-32">
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 space-y-4 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-500">
              <div className="h-1 w-8 rounded-full bg-blue-500" />
              New Arrival
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">最新图片资产</h2>
            <p className="mx-auto max-w-2xl text-base font-medium text-slate-400">刚刚入库的精彩内容，抢先一睹为快。</p>
          </div>

          <LatestGrid items={latestWithCovers} fallbackCover={fallbackCover} />

          <div className="mt-20 text-center">
            <Link
              href="/categories"
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-white px-10 text-sm font-bold text-slate-900 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
            >
              浏览更多合集
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 lg:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-[4rem] bg-slate-900 px-8 py-24 text-center text-white shadow-[0_40px_100px_-20px_rgba(15,23,42,0.3)]">
            <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-[100px]" />
            <div className="absolute bottom-0 right-0 h-[500px] w-[500px] translate-x-1/2 translate-y-1/2 rounded-full bg-blue-500/20 blur-[100px]" />

            <div className="relative z-10 space-y-8">
              <h2 className="text-5xl font-black tracking-tight md:text-7xl">
                加入档案馆，
                <br />
                <span className="text-emerald-400">成为档案官</span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg font-medium text-slate-400 md:text-xl">
                分享你收藏已久的私藏表情包，让全世界看到你的幽默感。
              </p>
              <div className="flex justify-center pt-4">
                <Link
                  href="/join"
                  className="group relative flex h-16 items-center justify-center overflow-hidden rounded-2xl bg-emerald-500 px-12 text-lg font-bold text-white shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 hover:bg-emerald-400 active:scale-95"
                >
                  立即加入
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
