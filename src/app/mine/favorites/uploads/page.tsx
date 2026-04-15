"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Download,
  FolderOpen,
  Heart,
  Loader2,
  Plus,
  ThumbsUp,
  UploadCloud,
  X,
} from "lucide-react";
import SmartImage from "@/components/common/SmartImage";
import { API_BASE, fetchWithAuthRetry } from "@/lib/auth-client";

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "updated_desc", label: "最近更新", sort: "updated_at", order: "desc" },
  { value: "interaction_desc", label: "总互动高到低", sort: "interaction_count", order: "desc" },
  { value: "download_desc", label: "下载高到低", sort: "download_count", order: "desc" },
  { value: "favorite_desc", label: "收藏高到低", sort: "favorite_count", order: "desc" },
  { value: "like_desc", label: "点赞高到低", sort: "like_count", order: "desc" },
  { value: "created_desc", label: "创建时间新到旧", sort: "created_at", order: "desc" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

type UploadCollection = {
  id: number;
  title: string;
  description?: string;
  cover_url?: string;
  file_count?: number;
  like_count?: number;
  favorite_count?: number;
  download_count?: number;
  status?: string;
  visibility?: string;
  review_status?: string;
  publish_status?: string;
  preview_images?: string[];
  created_at?: string;
  updated_at?: string;
};

type UploadCollectionListResponse = {
  items?: UploadCollection[];
  total?: number;
  page?: number;
  page_size?: number;
};

type UploadRulesResponse = {
  max_files_per_collection?: number;
};

type UploadOverviewSummary = {
  collection_count?: number;
  emoji_count?: number;
  like_count?: number;
  favorite_count?: number;
  download_count?: number;
  range_like_count?: number;
  range_favorite_count?: number;
  range_download_count?: number;
};

type UploadOverviewTrendItem = {
  date?: string;
  like_count?: number;
  favorite_count?: number;
  download_count?: number;
};

type UploadOverviewCollectionItem = {
  id: number;
  title?: string;
  cover_url?: string;
  total_interactions?: number;
  like_count?: number;
  favorite_count?: number;
  download_count?: number;
};

type UploadOverviewEmojiItem = {
  id: number;
  collection_id?: number;
  title?: string;
  preview_url?: string;
  total_interactions?: number;
  like_count?: number;
  favorite_count?: number;
  download_count?: number;
};

type UploadOverviewResponse = {
  range?: string;
  start_date?: string;
  end_date?: string;
  summary?: UploadOverviewSummary;
  trend?: UploadOverviewTrendItem[];
  top_collections?: UploadOverviewCollectionItem[];
  top_emojis?: UploadOverviewEmojiItem[];
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("zh-CN");
}

function formatCount(value?: number) {
  return Math.max(0, Number(value || 0)).toLocaleString("zh-CN");
}

function buildUploadCardImages(item: UploadCollection) {
  const result: string[] = [];
  const pushUnique = (raw?: string) => {
    const value = (raw || "").trim();
    if (!value) return;
    if (result.includes(value)) return;
    result.push(value);
  };
  pushUnique(item.cover_url);
  (item.preview_images || []).forEach((url) => pushUnique(url));
  while (result.length < 4) {
    result.push("");
  }
  return result.slice(0, 4);
}

function badgeLabelStatus(item: UploadCollection) {
  const collectionStatus = String(item.status || "").toLowerCase();
  if (collectionStatus === "disabled") return "不可用";

  const reviewStatus = String(item.review_status || "").toLowerCase();
  if (reviewStatus === "draft") return "未提交";
  if (reviewStatus === "reviewing") return "待审核";
  if (reviewStatus === "approved") return "已通过";
  if (reviewStatus === "rejected") return "已驳回";
  return "未提交";
}

function badgeClassStatus(item: UploadCollection) {
  const collectionStatus = String(item.status || "").toLowerCase();
  if (collectionStatus === "disabled") return "bg-slate-100 text-slate-600 ring-slate-200";

  const reviewStatus = String(item.review_status || "").toLowerCase();
  if (reviewStatus === "draft") return "bg-slate-100 text-slate-600 ring-slate-200";
  if (reviewStatus === "reviewing") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (reviewStatus === "approved") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (reviewStatus === "rejected") return "bg-rose-50 text-rose-700 ring-rose-100";
  return "bg-slate-50 text-slate-500 ring-slate-100";
}

function badgeLabelVisibility(item: UploadCollection) {
  if (String(item.status || "").toLowerCase() === "disabled") return "未上架";
  const publishStatus = String(item.publish_status || "").toLowerCase();
  if (publishStatus === "online") return "上架中";
  return "未上架";
}

function badgeClassVisibility(item: UploadCollection) {
  if (String(item.status || "").toLowerCase() === "disabled") return "bg-slate-100 text-slate-600 ring-slate-200";
  const publishStatus = String(item.publish_status || "").toLowerCase();
  if (publishStatus === "online") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function buildLinePath(values: number[], width: number, height: number, padding = 8) {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const min = 0;
  const spanX = Math.max(1, width - padding * 2);
  const spanY = Math.max(1, height - padding * 2);

  return values
    .map((val, idx) => {
      const x = padding + (values.length === 1 ? spanX / 2 : (idx / (values.length - 1)) * spanX);
      const y = padding + (1 - (val - min) / (max - min || 1)) * spanY;
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function TrendChart({ trend }: { trend: UploadOverviewTrendItem[] }) {
  const width = 320;
  const height = 132;
  const likes = trend.map((item) => Math.max(0, Number(item.like_count || 0)));
  const favorites = trend.map((item) => Math.max(0, Number(item.favorite_count || 0)));
  const downloads = trend.map((item) => Math.max(0, Number(item.download_count || 0)));

  const likePath = buildLinePath(likes, width, height);
  const favoritePath = buildLinePath(favorites, width, height);
  const downloadPath = buildLinePath(downloads, width, height);

  if (trend.length === 0) {
    return <div className="rounded-xl border border-slate-100 p-4 text-xs text-slate-500">暂无趋势数据</div>;
  }

  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
        <path d={downloadPath} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
        <path d={favoritePath} fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
        <path d={likePath} fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" />下载</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-600" />收藏</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-600" />点赞</span>
      </div>
    </div>
  );
}

async function parseApiError(res: Response) {
  try {
    const payload = (await res.clone().json()) as ApiErrorPayload;
    return (payload.message || payload.error || "").trim();
  } catch {
    return "";
  }
}

export default function MyUploadsPage() {
  const router = useRouter();
  const [items, setItems] = useState<UploadCollection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [maxFilesPerCollection, setMaxFilesPerCollection] = useState(50);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overview, setOverview] = useState<UploadOverviewResponse | null>(null);
  const [overviewRange, setOverviewRange] = useState<"7d" | "30d">("7d");

  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [sortValue, setSortValue] = useState<SortValue>("updated_desc");

  const sortConfig = useMemo(
    () => SORT_OPTIONS.find((item) => item.value === sortValue) || SORT_OPTIONS[0],
    [sortValue]
  );

  const canLoadMore = useMemo(() => items.length < total, [items.length, total]);

  const loadCollections = useCallback(
    async (nextPage: number, append: boolean) => {
      setLoading(true);
      if (!append) setErrorMessage(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          page_size: String(PAGE_SIZE),
          preview_count: "15",
          sort: sortConfig.sort,
          order: sortConfig.order,
        });
        if (visibilityFilter !== "all") params.set("visibility", visibilityFilter);

        const res = await fetchWithAuthRetry(`${API_BASE}/me/uploads/collections?${params.toString()}`);
        if (!res.ok) {
          const msg = await parseApiError(res);
          setErrorMessage(msg || "加载我的上传失败，请稍后重试");
          if (!append) {
            setItems([]);
            setTotal(0);
          }
          return;
        }
        const data = (await res.json()) as UploadCollectionListResponse;
        const nextItems = Array.isArray(data.items) ? data.items : [];
        const nextTotal = typeof data.total === "number" ? data.total : nextItems.length;
        setTotal(nextTotal);
        setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
        setPage(nextPage);
      } catch {
        setErrorMessage("加载我的上传失败，请稍后重试");
        if (!append) {
          setItems([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    },
    [visibilityFilter, sortConfig]
  );

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/uploads/overview?range=${overviewRange}`);
      if (!res.ok) return;
      const data = (await res.json()) as UploadOverviewResponse;
      setOverview(data);
    } catch {
      // ignore overview errors to keep page available
    } finally {
      setOverviewLoading(false);
    }
  }, [overviewRange]);

  useEffect(() => {
    void loadCollections(1, false);
  }, [loadCollections]);

  useEffect(() => {
    const loadRules = async () => {
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/upload-rules`);
        if (!res.ok) return;
        const payload = (await res.json()) as UploadRulesResponse;
        const value = Number(payload?.max_files_per_collection || 0);
        if (Number.isFinite(value) && value > 0) {
          setMaxFilesPerCollection(Math.floor(value));
        }
      } catch {
        // ignore and keep default
      }
    };
    void loadRules();
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!overviewOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [overviewOpen]);

  const openCreate = () => {
    setTitle("");
    setDescription("");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const resetFilters = () => {
    setVisibilityFilter("all");
    setSortValue("updated_desc");
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage("合集标题不能为空");
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/uploads/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "创建合集失败，请稍后重试");
        return;
      }
      setEditorOpen(false);
      await Promise.all([loadCollections(1, false), loadOverview()]);
    } catch {
      setErrorMessage("创建合集失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const rangeLike = Number(overview?.summary?.range_like_count || 0);
  const rangeFavorite = Number(overview?.summary?.range_favorite_count || 0);
  const rangeDownload = Number(overview?.summary?.range_download_count || 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-600 ring-1 ring-emerald-100">
            <UploadCloud size={12} />
            MY UPLOADS
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">我的上传</h1>
          <p className="mt-1 text-sm text-slate-500">
            优先查看互动数据，衡量作品受欢迎程度。编辑与删除维护请前往
            <button
              type="button"
              className="ml-1 font-bold text-emerald-700 underline-offset-2 hover:underline"
              onClick={() => router.push("/mine/favorites/review")}
            >
              投稿审核
            </button>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOverviewOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            {overviewLoading ? <Loader2 size={15} className="animate-spin" /> : <BarChart3 size={15} />}
            数据总览
            <span className="hidden text-xs text-slate-500 sm:inline">
              近{overviewRange === "30d" ? "30" : "7"}天 赞{formatCount(rangeLike)} / 藏{formatCount(rangeFavorite)} / 下
              {formatCount(rangeDownload)}
            </span>
          </button>
          <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
            共 {total} 个上传合集
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-emerald-600"
          >
            <Plus size={16} />
            新建合集
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="w-full sm:w-[180px]">
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-300"
            >
              <option value="all">全部上架状态</option>
              <option value="public">上架中</option>
              <option value="private">未上架</option>
            </select>
          </div>
          <div className="w-full sm:w-[220px]">
            <select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value as SortValue)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-300"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:ml-auto">
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:border-slate-300"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {errorMessage}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-[2.25rem] border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <FolderOpen size={34} />
          </div>
          <h3 className="text-lg font-black text-slate-900">没有匹配到合集</h3>
          <p className="mt-2 text-sm text-slate-500">试试调整筛选条件，或新建合集</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600"
          >
            <Plus size={14} />
            新建合集
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const cardImages = buildUploadCardImages(item);
          const bigImage = cardImages[0];
          const smallImages = cardImages.slice(1, 4);
          return (
            <div
              key={item.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/mine/favorites/uploads/${item.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/mine/favorites/uploads/${item.id}`);
                }
              }}
              className="group cursor-pointer overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-50 p-2">
                <div className="grid h-full grid-cols-3 grid-rows-3 gap-1.5">
                  <div className="relative col-span-2 row-span-3 overflow-hidden rounded-xl bg-slate-100">
                    {bigImage ? (
                      <SmartImage
                        url={bigImage}
                        alt={item.title || "cover"}
                        className="object-cover transition duration-300 group-hover:scale-105"
                        preferProxy={false}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-300">暂无封面</div>
                    )}
                  </div>
                  {smallImages.map((url, idx) => (
                    <div key={`${item.id}-small-${idx}`} className="relative overflow-hidden rounded-lg bg-slate-100">
                      {url ? (
                        <SmartImage
                          url={url}
                          alt={`${item.title || "cover"}-${idx + 1}`}
                          className="object-cover transition duration-300 group-hover:scale-105"
                          preferProxy={false}
                        />
                      ) : (
                        <div className="h-full w-full bg-slate-100" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  点击卡片查看互动
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div>
                  <h3 className="line-clamp-1 text-base font-black text-slate-900">{item.title || "未命名合集"}</h3>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">{item.description || "暂无描述"}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                  <div className="rounded-xl bg-emerald-50 px-2 py-2 text-emerald-700">
                    <div className="flex items-center gap-1 text-[11px]">
                      <Download size={12} />下载
                    </div>
                    <div className="mt-1 text-sm font-black">{formatCount(item.download_count)}</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-2 py-2 text-amber-700">
                    <div className="flex items-center gap-1 text-[11px]">
                      <Heart size={12} />收藏
                    </div>
                    <div className="mt-1 text-sm font-black">{formatCount(item.favorite_count)}</div>
                  </div>
                  <div className="rounded-xl bg-rose-50 px-2 py-2 text-rose-700">
                    <div className="flex items-center gap-1 text-[11px]">
                      <ThumbsUp size={12} />点赞
                    </div>
                    <div className="mt-1 text-sm font-black">{formatCount(item.like_count)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>
                    {Math.max(0, Number(item.file_count ?? 0))} / {maxFilesPerCollection} 张
                  </span>
                  <span>更新于 {formatDate(item.updated_at || item.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badgeClassStatus(item)}`}>
                    {badgeLabelStatus(item)}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badgeClassVisibility(item)}`}>
                    {badgeLabelVisibility(item)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canLoadMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => loadCollections(page + 1, true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            加载更多
          </button>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900">新建合集</h2>
            <div className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">合集标题（必填）</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400"
                  placeholder="例如：我的猫咪表情"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">合集描述（可选）</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-400"
                  placeholder="描述一下你的合集内容"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeEditor} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600">
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {overviewOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
          <button type="button" className="h-full flex-1 cursor-default" onClick={() => setOverviewOpen(false)} aria-label="close" />
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">创作总览</h3>
              <button
                type="button"
                onClick={() => setOverviewOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-2 inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setOverviewRange("7d")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  overviewRange === "7d" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                近7天
              </button>
              <button
                type="button"
                onClick={() => setOverviewRange("30d")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  overviewRange === "30d" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                近30天
              </button>
            </div>

            <p className="mt-2 text-xs font-semibold text-slate-500">
              统计区间：{overview?.start_date || "-"} ~ {overview?.end_date || "-"}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold">
              <div className="rounded-xl bg-slate-50 p-3 text-slate-600">
                <div>合集数</div>
                <div className="mt-1 text-lg font-black text-slate-900">{formatCount(overview?.summary?.collection_count)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-slate-600">
                <div>表情数</div>
                <div className="mt-1 text-lg font-black text-slate-900">{formatCount(overview?.summary?.emoji_count)}</div>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 text-rose-700">
                <div>总点赞</div>
                <div className="mt-1 text-lg font-black">{formatCount(overview?.summary?.like_count)}</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
                <div>总收藏</div>
                <div className="mt-1 text-lg font-black">{formatCount(overview?.summary?.favorite_count)}</div>
              </div>
              <div className="col-span-2 rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <div>总下载</div>
                <div className="mt-1 text-lg font-black">{formatCount(overview?.summary?.download_count)}</div>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-black text-slate-900">互动趋势</h4>
              <div className="mt-2">{overviewLoading ? <div className="py-5 text-xs text-slate-500">加载中...</div> : <TrendChart trend={overview?.trend || []} />}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
