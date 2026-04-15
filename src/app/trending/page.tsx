"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, Search, Layers } from "lucide-react";
import { emitBehaviorEvent } from "@/lib/behavior-events";
import SmartImage from "@/components/common/SmartImage";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";
const PAGE_SIZE = 12;

type IPItem = {
  id: number;
  name: string;
  slug: string;
  cover_url?: string;
  cover_thumb_url?: string;
  description?: string;
  collection_count?: number;
};

function parsePositiveInt(raw?: string | null, fallback = 1) {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export default function TrendingPage() {
  const [ips, setIps] = useState<IPItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setKeyword((params.get("keyword") || "").trim());
    setCurrentPage(parsePositiveInt(params.get("page"), 1));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (keyword.trim()) params.set("keyword", keyword.trim());
    else params.delete("keyword");
    if (currentPage > 1) params.set("page", String(currentPage));
    else params.delete("page");
    const nextURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, "", nextURL);
  }, [keyword, currentPage]);

  const loadIps = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/ips`, { cache: "no-store" });
      if (!res.ok) throw new Error("加载 IP 失败");
      const data = (await res.json()) as IPItem[];
      setIps(Array.isArray(data) ? data : []);
    } catch {
      setIps([]);
      setError("加载 IP 失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const trackIPSearch = () => {
    const q = keyword.trim();
    if (!q) return;
    emitBehaviorEvent("search_ip", {
      metadata: {
        keyword: q,
        keyword_length: q.length,
      },
    });
  };

  useEffect(() => {
    loadIps();
  }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return ips;
    return ips.filter((item) =>
      [item.name, item.slug, item.description]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(q))
    );
  }, [ips, keyword]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filtered.length, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  return (
    <main className="min-h-screen bg-white">
      <section className="sticky top-16 z-40 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 rounded-full bg-emerald-500" />
            <div>
              <h1 className="text-xl font-black text-slate-900">表情包 IP 馆</h1>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">DISCOVER TRENDING IPS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
              <input
                className="h-10 w-64 rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-medium text-slate-600 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/5"
                placeholder="搜索 IP 名称 / slug"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setCurrentPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    trackIPSearch();
                    loadIps();
                    setCurrentPage(1);
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                trackIPSearch();
                loadIps();
              }}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition-all hover:border-emerald-200 hover:text-emerald-600 hover:bg-emerald-50/30 active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="flex flex-col">
                <div className="aspect-[16/10] animate-pulse rounded-[2.5rem] bg-slate-100" />
                <div className="mt-5 space-y-3 px-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                  <div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="rounded-[3rem] border-2 border-dashed border-slate-100 bg-slate-50/50 py-32 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
              <Search size={32} />
            </div>
            <p className="text-lg font-bold text-slate-400">暂无可展示的 IP 形象</p>
            <p className="mt-2 text-sm font-medium text-slate-400">换个关键词搜索试试看吧。</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">全部 IP 形象</h2>
                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-400">
                  {filtered.length}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paged.map((ip) => (
                <Link
                  key={ip.id}
                  href={`/trending/${ip.id}`}
                  className="group relative flex flex-col transition-all duration-500 hover:-translate-y-1.5"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[2.5rem] bg-slate-50 shadow-sm ring-1 ring-inset ring-slate-100/50 transition-all duration-500 group-hover:shadow-[0_20px_40px_-15px_rgba(15,23,42,0.1)] group-hover:ring-emerald-100">
                    {ip.cover_thumb_url || ip.cover_url ? (
                      <SmartImage
                        url={ip.cover_thumb_url || ip.cover_url}
                        alt={ip.name}
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                        <span className="text-6xl font-black text-slate-200/60 transition-transform duration-500 group-hover:scale-110 group-hover:text-emerald-200/60">
                          {ip.name?.slice(0, 1).toUpperCase() || "IP"}
                        </span>
                      </div>
                    )}
                    
                    {/* 悬浮遮罩 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </div>

                  <div className="mt-5 px-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500/80">
                      <span className="h-px w-4 bg-emerald-200" />
                      {ip.slug || "TRENDING IP"}
                    </div>
                    <h3 className="mt-2 line-clamp-1 text-xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-emerald-600">
                      {ip.name || "未命名 IP"}
                    </h3>
                    <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-relaxed text-slate-400 transition-colors group-hover:text-slate-500">
                      {ip.description || "该 IP 暂无详细描述，正在完善中..."}
                    </p>
                    
                    <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-600">
                        <Layers size={12} />
                        {Number(ip.collection_count || 0)} 合集
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all duration-300 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-200">
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-16 flex items-center justify-center gap-3">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-emerald-200 hover:text-emerald-600 active:scale-90 disabled:opacity-40"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </button>
                <div className="flex h-10 items-center justify-center rounded-full bg-slate-50 px-5 text-xs font-black text-slate-500">
                  {currentPage} / {totalPages}
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:border-emerald-200 hover:text-emerald-600 active:scale-90 disabled:opacity-40"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
