import Link from "next/link";
import LatestGrid from "@/components/home/LatestGrid";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

type CollectionBrief = {
  id: number;
  title: string;
  cover_url?: string;
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
  const latestWithCovers = await Promise.all(
    latestCollections.map(async (item) => ({
      ...item,
      cover: await resolveCoverUrl(item.cover_url),
    }))
  );
  const fallbackCover = "https://api.dicebear.com/7.x/bottts/svg?seed=placeholder";
  const trendingCollections = [
    { title: "当代职场生存图鉴", author: "摸鱼专家", count: 42, color: "bg-blue-500", emoji: "💼" },
    { title: "猫猫统治世界计划", author: "喵星大使", count: 128, color: "bg-rose-500", emoji: "🐱" },
    { title: "大学期末现状", author: "挂科回避", count: 35, color: "bg-amber-500", emoji: "📚" },
    { title: "微信万能表情包", author: "社交恐怖分子", count: 99, color: "bg-emerald-500", emoji: "✨" },
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

      {/* Trending Collections */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">精选合集</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">馆长亲自挑选的优质合集，绝不踩雷。</p>
            </div>
            <Link href="/categories" className="text-sm font-bold text-emerald-600 hover:underline">查看全部</Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trendingCollections.map((col) => (
              <div
                key={col.title} 
                className="group relative h-64 overflow-hidden rounded-3xl bg-white p-8 shadow-sm transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-200/50"
              >
                <div className={`absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full ${col.color} opacity-10 transition-transform group-hover:scale-150`} />
                <div className="relative flex h-full flex-col justify-between">
                  <div>
                    <div className="text-4xl">{col.emoji}</div>
                    <h3 className="mt-4 text-xl font-bold leading-tight text-slate-900">{col.title}</h3>
                    <p className="mt-1 text-xs font-bold text-slate-400">by {col.author}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 uppercase">
                      {col.count} Emojis
                    </span>
                    <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
              <button className="rounded-2xl bg-emerald-500 px-8 py-4 text-base font-bold text-white transition-all hover:bg-emerald-400 hover:scale-105 active:scale-95">
                立即加入
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
