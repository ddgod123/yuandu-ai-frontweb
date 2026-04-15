"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Heart,
  Loader2,
  ThumbsUp,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import SmartImage from "@/components/common/SmartImage";
import { API_BASE, fetchWithAuthRetry } from "@/lib/auth-client";

type UploadCollection = {
  id: number;
  title: string;
  description?: string;
  cover_url?: string;
  file_count?: number;
  status?: string;
  visibility?: string;
  preview_images?: string[];
  created_at?: string;
  updated_at?: string;
};

type UploadEmoji = {
  id: number;
  collection_id: number;
  title: string;
  preview_url?: string;
  format?: string;
  size_bytes?: number;
  like_count?: number;
  favorite_count?: number;
  download_count?: number;
  liked?: boolean;
  favorited?: boolean;
  created_at?: string;
};

type EmojiListResponse = {
  items?: UploadEmoji[];
  total?: number;
};

type UploadEmojisResponse = {
  added?: number;
  file_count?: number;
  max_allowed?: number;
  remaining_quota?: number;
};

type UploadRulesResponse = {
  enabled?: boolean;
  allowed_extensions?: string[];
  max_file_size_bytes?: number;
  max_files_per_collection?: number;
  max_files_per_request?: number;
  content_rules?: string[];
  reference_url?: string;
};

type UploadReviewDetailResponse = {
  review?: {
    review_status?: string;
    publish_status?: string;
  };
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

async function parseApiError(res: Response) {
  try {
    const payload = (await res.clone().json()) as ApiErrorPayload;
    const message = (payload.message || payload.error || "").trim();
    const normalized = message.toLowerCase();
    if (normalized === "collection is under review") return "合集正在审核中，暂不可编辑内容";
    if (normalized === "collection already under review") return "合集已在审核中";
    if (normalized === "collection is disabled") return "合集不可用，无法操作";
    return message;
  } catch {
    return "";
  }
}

function formatBytes(size?: number) {
  const value = Math.max(0, Number(size || 0));
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("zh-CN");
}

const DEFAULT_UPLOAD_RULES: Required<UploadRulesResponse> = {
  enabled: true,
  allowed_extensions: ["jpg", "jpeg", "png", "gif", "webp"],
  max_file_size_bytes: 10 * 1024 * 1024,
  max_files_per_collection: 50,
  max_files_per_request: 20,
  content_rules: [
    "不得上传违法违规、涉政极端、色情暴力、恐怖、诈骗等内容。",
    "不得侵犯他人著作权、商标权、肖像权、隐私权等合法权益。",
    "上传即默认你对素材拥有合法使用与传播授权。",
  ],
  reference_url: "https://mos.m.taobao.com/iconfont/upload_rule?spm=a313x.icons_upload.i1.5.176b3a813scH6m",
};

function normalizeExtensions(raw?: string[]) {
  if (!Array.isArray(raw)) return DEFAULT_UPLOAD_RULES.allowed_extensions;
  const seen = new Set<string>();
  const out: string[] = [];
  raw.forEach((item) => {
    const ext = String(item || "").trim().toLowerCase().replace(/^\./, "");
    if (!ext || seen.has(ext)) return;
    seen.add(ext);
    out.push(ext);
  });
  return out.length > 0 ? out : DEFAULT_UPLOAD_RULES.allowed_extensions;
}

function normalizePositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function normalizeUploadRules(raw?: UploadRulesResponse): Required<UploadRulesResponse> {
  const contentRules = Array.isArray(raw?.content_rules)
    ? raw.content_rules.map((item) => String(item || "").trim()).filter((item) => item.length > 0)
    : [];
  const referenceURL = String(raw?.reference_url || "").trim();

  return {
    enabled: typeof raw?.enabled === "boolean" ? raw.enabled : DEFAULT_UPLOAD_RULES.enabled,
    allowed_extensions: normalizeExtensions(raw?.allowed_extensions),
    max_file_size_bytes: normalizePositiveInt(raw?.max_file_size_bytes, DEFAULT_UPLOAD_RULES.max_file_size_bytes),
    max_files_per_collection: normalizePositiveInt(raw?.max_files_per_collection, DEFAULT_UPLOAD_RULES.max_files_per_collection),
    max_files_per_request: normalizePositiveInt(raw?.max_files_per_request, DEFAULT_UPLOAD_RULES.max_files_per_request),
    content_rules: contentRules.length > 0 ? contentRules : DEFAULT_UPLOAD_RULES.content_rules,
    reference_url: referenceURL || DEFAULT_UPLOAD_RULES.reference_url,
  };
}

export default function MyUploadCollectionDetailPage() {
  const params = useParams<{ id: string }>();
  const collectionID = Number(params?.id || 0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [collection, setCollection] = useState<UploadCollection | null>(null);
  const [emojis, setEmojis] = useState<UploadEmoji[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingEmojiID, setDeletingEmojiID] = useState<number | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedEmojiIDs, setSelectedEmojiIDs] = useState<number[]>([]);
  const [reviewStatus, setReviewStatus] = useState("");
  const [uploadRules, setUploadRules] = useState<Required<UploadRulesResponse>>(DEFAULT_UPLOAD_RULES);

  const allowedExtensions = useMemo(() => normalizeExtensions(uploadRules.allowed_extensions), [uploadRules.allowed_extensions]);
  const acceptValue = useMemo(() => allowedExtensions.map((ext) => `.${ext}`).join(","), [allowedExtensions]);
  const maxFilesPerCollection = useMemo(
    () => normalizePositiveInt(uploadRules.max_files_per_collection, DEFAULT_UPLOAD_RULES.max_files_per_collection),
    [uploadRules.max_files_per_collection]
  );
  const maxFilesPerRequest = useMemo(
    () => normalizePositiveInt(uploadRules.max_files_per_request, DEFAULT_UPLOAD_RULES.max_files_per_request),
    [uploadRules.max_files_per_request]
  );
  const maxFileSizeBytes = useMemo(
    () => normalizePositiveInt(uploadRules.max_file_size_bytes, DEFAULT_UPLOAD_RULES.max_file_size_bytes),
    [uploadRules.max_file_size_bytes]
  );

  const currentCount = useMemo(() => Math.max(0, Number(collection?.file_count || emojis.length || 0)), [collection?.file_count, emojis.length]);
  const remainingQuota = useMemo(() => Math.max(0, maxFilesPerCollection - currentCount), [currentCount, maxFilesPerCollection]);
  const collectionDisabled = useMemo(
    () => String(collection?.status || "").trim().toLowerCase() === "disabled",
    [collection?.status]
  );
  const collectionUnderReview = useMemo(() => reviewStatus === "reviewing", [reviewStatus]);
  const canEditContent = useMemo(() => !collectionDisabled && !collectionUnderReview, [collectionDisabled, collectionUnderReview]);
  const editBlockedMessage = useMemo(() => {
    if (collectionDisabled) return "合集已被设为不可用，暂不可编辑内容";
    if (collectionUnderReview) return "合集正在审核中，暂不可编辑内容";
    return "";
  }, [collectionDisabled, collectionUnderReview]);

  const loadUploadRules = useCallback(async () => {
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/upload-rules`);
      if (!res.ok) return;
      const payload = (await res.json()) as UploadRulesResponse;
      setUploadRules(normalizeUploadRules(payload));
    } catch {
      // keep defaults for resilient UX
    }
  }, []);

  const loadCollection = useCallback(async () => {
    if (!collectionID) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [collectionRes, emojiRes, reviewRes] = await Promise.all([
        fetchWithAuthRetry(`${API_BASE}/me/uploads/collections/${collectionID}`),
        fetchWithAuthRetry(`${API_BASE}/me/uploads/collections/${collectionID}/emojis?page=1&page_size=100`),
        fetchWithAuthRetry(`${API_BASE}/me/uploads/collections/${collectionID}/review-detail`),
      ]);

      if (!collectionRes.ok) {
        const msg = await parseApiError(collectionRes);
        setErrorMessage(msg || "加载合集失败");
        setCollection(null);
        setEmojis([]);
        setReviewStatus("");
        return;
      }
      if (!emojiRes.ok) {
        const msg = await parseApiError(emojiRes);
        setErrorMessage(msg || "加载表情失败");
        setCollection(null);
        setEmojis([]);
        setReviewStatus("");
        return;
      }

      const collectionData = (await collectionRes.json()) as UploadCollection;
      const emojiData = (await emojiRes.json()) as EmojiListResponse;
      let nextReviewStatus = "";
      if (reviewRes.ok) {
        const reviewData = (await reviewRes.json()) as UploadReviewDetailResponse;
        nextReviewStatus = String(reviewData.review?.review_status || "")
          .trim()
          .toLowerCase();
      }
      const nextEmojis = Array.isArray(emojiData.items) ? emojiData.items : [];
      setCollection(collectionData);
      setEmojis(nextEmojis);
      setReviewStatus(nextReviewStatus);
    } catch {
      setErrorMessage("加载失败，请稍后重试");
      setCollection(null);
      setEmojis([]);
      setReviewStatus("");
    } finally {
      setLoading(false);
    }
  }, [collectionID]);

  useEffect(() => {
    if (!collectionID) return;
    void loadCollection();
  }, [collectionID, loadCollection]);

  useEffect(() => {
    void loadUploadRules();
  }, [loadUploadRules]);

  useEffect(() => {
    setSelectedEmojiIDs((prev) => prev.filter((id) => emojis.some((emoji) => emoji.id === id)));
    if (emojis.length === 0) {
      setBatchMode(false);
    }
  }, [emojis]);

  const handleChooseFiles = () => {
    if (!canEditContent) {
      setErrorMessage(editBlockedMessage || "当前状态不可编辑");
      return;
    }
    if (!uploadRules.enabled) {
      setErrorMessage("当前已关闭用户上传，请稍后再试");
      return;
    }
    if (remainingQuota <= 0) {
      setErrorMessage(`单个合集最多 ${maxFilesPerCollection} 张，请先删除后再上传`);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !collectionID) return;
    const list = Array.from(files);
    if (!canEditContent) {
      setErrorMessage(editBlockedMessage || "当前状态不可编辑");
      return;
    }
    if (!uploadRules.enabled) {
      setErrorMessage("当前已关闭用户上传，请稍后再试");
      return;
    }
    if (list.length > maxFilesPerRequest) {
      setErrorMessage(`单次最多上传 ${maxFilesPerRequest} 张，本次选择了 ${list.length} 张`);
      return;
    }
    if (list.length > remainingQuota) {
      setErrorMessage(`本合集剩余可上传 ${remainingQuota} 张，本次选择了 ${list.length} 张`);
      return;
    }
    const allowedSet = new Set(allowedExtensions);
    for (const file of list) {
      const ext = String(file.name.split(".").pop() || "")
        .trim()
        .toLowerCase();
      if (!ext || !allowedSet.has(ext)) {
        setErrorMessage(`不支持的文件格式：${file.name}`);
        return;
      }
      if (Number(file.size || 0) > maxFileSizeBytes) {
        setErrorMessage(`文件过大：${file.name}（单文件最大 ${formatBytes(maxFileSizeBytes)}）`);
        return;
      }
    }
    setUploading(true);
    setErrorMessage(null);
    try {
      const form = new FormData();
      list.forEach((file) => {
        form.append("files", file);
      });
      const res = await fetchWithAuthRetry(`${API_BASE}/me/uploads/collections/${collectionID}/emojis/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "上传失败，请稍后重试");
        return;
      }
      const payload = (await res.json()) as UploadEmojisResponse;
      const added = Number(payload.added || 0);
      if (added > 0) {
        await loadCollection();
      }
    } catch {
      setErrorMessage("上传失败，请稍后重试");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteEmoji = async (emojiID: number) => {
    if (!emojiID || deletingEmojiID === emojiID || batchMode) return;
    if (!canEditContent) {
      setErrorMessage(editBlockedMessage || "当前状态不可编辑");
      return;
    }
    const ok = window.confirm("确认删除该表情吗？");
    if (!ok) return;
    setDeletingEmojiID(emojiID);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/me/uploads/emojis/${emojiID}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "删除表情失败");
        return;
      }
      setSelectedEmojiIDs((prev) => prev.filter((id) => id !== emojiID));
      await loadCollection();
    } catch {
      setErrorMessage("删除表情失败");
    } finally {
      setDeletingEmojiID(null);
    }
  };

  const allSelected = batchMode && emojis.length > 0 && selectedEmojiIDs.length === emojis.length;

  const toggleSelectAll = () => {
    if (!batchMode) return;
    if (allSelected) {
      setSelectedEmojiIDs([]);
      return;
    }
    setSelectedEmojiIDs(emojis.map((item) => item.id));
  };

  const toggleSelectOne = (emojiID: number, checked: boolean) => {
    if (!batchMode) return;
    setSelectedEmojiIDs((prev) => {
      if (checked) {
        if (prev.includes(emojiID)) return prev;
        return [...prev, emojiID];
      }
      return prev.filter((id) => id !== emojiID);
    });
  };

  const batchDeleteSelected = async () => {
    if (selectedEmojiIDs.length === 0 || batchDeleting) return;
    if (!canEditContent) {
      setErrorMessage(editBlockedMessage || "当前状态不可编辑");
      return;
    }
    const ok = window.confirm(`确认批量删除已选中的 ${selectedEmojiIDs.length} 张表情吗？`);
    if (!ok) return;

    setBatchDeleting(true);
    setErrorMessage(null);
    let success = 0;
    let failed = 0;
    let lastError = "";

    for (const emojiID of selectedEmojiIDs) {
      try {
        const res = await fetchWithAuthRetry(`${API_BASE}/me/uploads/emojis/${emojiID}`, { method: "DELETE" });
        if (res.ok) {
          success += 1;
          continue;
        }
        failed += 1;
        const msg = await parseApiError(res);
        if (msg) lastError = msg;
      } catch {
        failed += 1;
      }
    }

    await loadCollection();
    setSelectedEmojiIDs([]);
    setBatchDeleting(false);
    setBatchMode(false);

    if (failed > 0) {
      setErrorMessage(lastError || `批量删除完成：成功 ${success} 张，失败 ${failed} 张`);
    }
  };

  const openBatchMode = () => {
    if (batchDeleting || !canEditContent) {
      if (!canEditContent) setErrorMessage(editBlockedMessage || "当前状态不可编辑");
      return;
    }
    setSelectedEmojiIDs([]);
    setBatchMode(true);
  };

  const closeBatchMode = () => {
    if (batchDeleting) return;
    setSelectedEmojiIDs([]);
    setBatchMode(false);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/mine/favorites/uploads"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          返回我的上传
        </Link>
        <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-100">
          {currentCount} / {maxFilesPerCollection} 张
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {errorMessage}
        </div>
      ) : null}
      {!errorMessage && editBlockedMessage ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {editBlockedMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">{collection?.title || "我的上传合集"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {collection?.description || "在这里上传与管理该合集中的表情素材"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
          <span>创建于 {formatDate(collection?.created_at)}</span>
          <span>更新于 {formatDate(collection?.updated_at)}</span>
          <span>剩余可上传 {remainingQuota} 张</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptValue}
          multiple
          className="hidden"
          onChange={(e) => {
            void handleUploadFiles(e.target.files);
          }}
        />
        <button
          type="button"
          onClick={handleChooseFiles}
          disabled={uploading || loading || !uploadRules.enabled || batchMode || batchDeleting || !canEditContent}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-black text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          上传表情
        </button>
        {!loading && emojis.length > 0 && !batchMode ? (
          <button
            type="button"
            onClick={openBatchMode}
            disabled={batchDeleting || !canEditContent}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 px-5 text-sm font-black text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            <Trash2 size={15} />
            批量删除
          </button>
        ) : null}
        <div className="text-xs font-semibold text-slate-500">
          {uploadRules.enabled ? (
            <>
              支持 {allowedExtensions.join("/")}，单文件≤{formatBytes(maxFileSizeBytes)}，单次最多 {maxFilesPerRequest} 张。上传即表示你同意
              <Link href="/terms" className="mx-1 text-emerald-700 underline-offset-2 hover:underline">
                《用户协议》
              </Link>
            </>
          ) : (
            "当前已关闭用户上传"
          )}
        </div>
      </div>

      {!loading && emojis.length > 0 ? (
        batchMode ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/40 p-3">
            <span className="text-xs font-semibold text-slate-700">批量删除模式：已选 {selectedEmojiIDs.length} 项</span>
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={batchDeleting}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
            >
              {allSelected ? "取消全选" : "全选"}
            </button>
            <button
              type="button"
              onClick={() => void batchDeleteSelected()}
              disabled={selectedEmojiIDs.length === 0 || batchDeleting}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              {batchDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              确认删除
            </button>
            <button
              type="button"
              onClick={closeBatchMode}
              disabled={batchDeleting}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        ) : null
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm font-semibold text-slate-500">
          <Loader2 size={18} className="mr-2 animate-spin" />
          加载中...
        </div>
      ) : emojis.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-14 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
            <ImageIcon size={26} />
          </div>
          <p className="text-sm font-semibold text-slate-500">该合集还没有表情，点击上方按钮开始上传</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {emojis.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-50">
                {item.preview_url ? (
                  <SmartImage url={item.preview_url} alt={item.title || "emoji"} className="object-cover" preferProxy={false} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <ImageIcon size={30} />
                  </div>
                )}

                {batchMode ? (
                  <label className="absolute left-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-black/50 px-2 text-[11px] font-semibold text-white backdrop-blur-sm">
                    <input
                      type="checkbox"
                      checked={selectedEmojiIDs.includes(item.id)}
                      onChange={(e) => toggleSelectOne(item.id, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-white/60"
                    />
                    选择
                  </label>
                ) : null}

                <div className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                  {(item.format || "img").toUpperCase()}
                </div>
                <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                  {formatBytes(item.size_bytes)}
                </div>

                {/* Hover Actions */}
                {!batchMode ? (
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => deleteEmoji(item.id)}
                      disabled={deletingEmojiID === item.id || batchDeleting || !canEditContent}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-rose-500 disabled:opacity-50"
                      title="删除"
                    >
                      {deletingEmojiID === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 p-2.5">
                <div
                  className="line-clamp-1 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
                  title={item.title || `emoji-${item.id}`}
                >
                  {item.title || `emoji-${item.id}`}
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-semibold">
                  <div className="rounded-lg bg-emerald-50 px-1.5 py-1 text-emerald-700">
                    <div className="inline-flex items-center gap-1 leading-none">
                      <Download size={11} />
                      下载
                    </div>
                    <div className="mt-1 text-xs font-black leading-none">{Math.max(0, Number(item.download_count || 0))}</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-1.5 py-1 text-amber-700">
                    <div className="inline-flex items-center gap-1 leading-none">
                      <Heart size={11} />
                      收藏
                    </div>
                    <div className="mt-1 text-xs font-black leading-none">{Math.max(0, Number(item.favorite_count || 0))}</div>
                  </div>
                  <div className="rounded-lg bg-rose-50 px-1.5 py-1 text-rose-700">
                    <div className="inline-flex items-center gap-1 leading-none">
                      <ThumbsUp size={11} />
                      点赞
                    </div>
                    <div className="mt-1 text-xs font-black leading-none">{Math.max(0, Number(item.like_count || 0))}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
