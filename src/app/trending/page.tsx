"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { emitBehaviorEvent } from "@/lib/behavior-events";
import SmartImage from "@/components/common/SmartImage";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";
const PAGE_SIZE = 12;

type IPItem = {
  id: number;
  name: string;
  slug: string;
  cover_url?: string;
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
      <section className="border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <h1 className="text-2xl font-black text-slate-900">表情包 IP 馆</h1>
            <p className="mt-1 text-sm text-slate-500">先选 IP，再查看该 IP 绑定的表情包合集</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-64 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-600 outline-none focus:border-emerald-400"
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
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="h-40 animate-pulse bg-slate-100" />
                <div className="space-y-2 p-4">
                  <div className="h-4 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-20 text-center text-sm text-slate-400">
            暂无可展示的 IP
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-slate-500">
              共 {filtered.length} 个 IP
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paged.map((ip) => (
                <Link
                  key={ip.id}
                  href={`/trending/${ip.id}`}
                  className="group overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg"
                >
                  <div className="h-40 bg-gradient-to-b from-emerald-50/60 to-slate-50">
                    {ip.cover_url ? (
                      <div className="relative h-full w-full">
                        <SmartImage
                          url={ip.cover_url}
                          alt={ip.name}
                          className="object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl font-black text-slate-300">
                        {ip.name?.slice(0, 1) || "IP"}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="line-clamp-1 text-base font-black text-slate-900 transition-colors group-hover:text-emerald-600">
                      {ip.name || "未命名 IP"}
                    </div>
                    <div className="mt-1 line-clamp-1 text-[11px] font-semibold text-slate-400">{ip.slug || "-"}</div>
                    <div className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-slate-500">
                      {ip.description || "暂无简介"}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <div className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                        合集 {Number(ip.collection_count || 0)}
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-[10px] font-black text-emerald-700 transition group-hover:bg-emerald-50">
                        进入
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2 text-sm">
                <button
                  type="button"
                  className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 disabled:opacity-40"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </button>
                <span className="px-2 text-slate-500">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 disabled:opacity-40"
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
