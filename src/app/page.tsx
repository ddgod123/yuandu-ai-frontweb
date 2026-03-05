import Link from "next/link";
import LatestGrid from "@/components/home/LatestGrid";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

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
      next: { revalidate: 3600 }, // 1 小时缓存，后端每日刷新
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
      next: { revalidate: 300 }, // 5 分钟缓存 + ISR
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
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: CollectionBrief[] };
    return (data.items || []).slice(0, limit);
  } catch {
    return [];
  }
}

async function resolveCoverUrl(key?: string): Promise<string> {
  if (!key) return "";
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  try {
    const res = await fetch(
      `${API_BASE}/storage/url?key=${encodeURIComponent(trimmed)}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return "";
    const data = (await res.json()) as { url?: string };
    return data.url || "";
  } catch {
    return "";
  }
}

export default async function Page() {
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
      cover: await resolveCoverUrl(item.cover_url),
    }))
  );
  const featuredWithCovers = await Promise.all(
    featuredCollections.map(async (item) => ({
      ...item,
      cover: await resolveCoverUrl(item.cover_url),
      author: item.creator_name || item.creator_name_zh || item.creator_name_en || "官方推荐",
    }))
  );
  const fallbackCover = "https://api.dicebear.com/7.x/bottts/svg?seed=placeholder";
  const featuredCardFallbacks = [
    "from-cyan-100 via-sky-100 to-blue-100",
    "from-amber-100 via-orange-100 to-rose-100",
    "from-emerald-100 via-teal-100 to-cyan-100",
    "from-violet-100 via-fuchsia-100 to-pink-100",
  ];

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white py-24">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 h-96 w-96 rounded-full bg-emerald-50 blur-3xl" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 h-96 w-96 rounded-full bg-blue-50 blur-3xl" />
        
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 ring-1 ring-emerald-100">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            今日已新增 {todayText} 个表情
          </div>
          <h1 className="text-5xl font-black tracking-tight text-slate-900 md:text-7xl">
            表情包<span className="text-emerald-500">档案馆</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-slate-500 md:text-xl">
            在这里，我们用像素记录情绪。已收录 {totalCollectionsText} 个合集、{totalEmojisText} 张表情。
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/categories" className="rounded-2xl bg-slate-900 px-8 py-4 text-base font-bold text-white shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 hover:-translate-y-1 active:translate-y-0">
              浏览分类
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Collections */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">推荐合集</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">来自后台勾选“推荐”的合集，首页固定展示最多 4 个。</p>
            </div>
            <Link href="/categories" className="text-sm font-bold text-emerald-600 hover:underline">查看全部</Link>
          </div>

          {featuredWithCovers.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featuredWithCovers.map((item, index) => (
                <Link
                  href={`/collections/${item.id}`}
                  key={item.id}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-40 overflow-hidden">
                    {item.cover ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url("${item.cover}")` }}
                      />
                    ) : (
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${featuredCardFallbacks[index % featuredCardFallbacks.length]}`}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 via-slate-900/5 to-transparent" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black tracking-wide text-slate-800">
                      推荐
                    </span>
                  </div>

                  <div className="p-4">
                    <h3 className="min-h-[3rem] overflow-hidden text-lg font-black leading-6 text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-slate-400">by {item.author}</p>
                    <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>{(item.file_count || 0).toLocaleString()} 张</span>
                      <span>赞 {(item.like_count || 0).toLocaleString()}</span>
                      <span>藏 {(item.favorite_count || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-500">当前还没有被标记为推荐的合集</p>
              <p className="mt-1 text-xs font-medium text-slate-400">可在管理后台编辑合集时勾选“推荐”</p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Emojis Masonry-ish Grid */}
      <section className="bg-slate-100/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">新到馆表情</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">刚刚入库的精彩内容，抢先一睹为快。</p>
          </div>

          <LatestGrid items={latestWithCovers} fallbackCover={fallbackCover} />
          
          <div className="mt-16 text-center">
            <Link
              href="/categories"
              className="rounded-2xl bg-white px-10 py-4 text-sm font-bold text-slate-900 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:shadow-md"
            >
              浏览更多合集
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative overflow-hidden rounded-[3rem] bg-slate-900 px-8 py-20 text-center text-white shadow-2xl">
            <div className="absolute left-0 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="absolute right-0 bottom-0 h-64 w-64 translate-x-1/2 translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl" />
            
            <h2 className="relative text-4xl font-black tracking-tight md:text-5xl">加入档案馆，成为档案官</h2>
            <p className="relative mt-6 text-lg font-medium text-slate-400">
              分享你收藏已久的私藏表情包，让全世界看到你的幽默感。
            </p>
            <div className="relative mt-10 flex justify-center gap-4">
              <Link
                href="/join"
                className="rounded-2xl bg-emerald-500 px-8 py-4 text-base font-bold text-white transition-all hover:bg-emerald-400 hover:scale-105 active:scale-95"
              >
                立即加入
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
