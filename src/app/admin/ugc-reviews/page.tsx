"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileClock, Loader2, ShieldAlert, XCircle } from "lucide-react";
import AdminLayout from "@/components/layout/admin-layout";
import { API_BASE, fetchWithAuthRetry } from "@/lib/auth-client";

type AdminReviewItem = {
  collection_id: number;
  owner_id: number;
  owner_name?: string;
  collection?: {
    id: number;
    title?: string;
    file_count?: number;
    updated_at?: string;
  };
  review?: {
    review_status?: string;
    publish_status?: string;
    submit_count?: number;
    reject_reason?: string;
    offline_reason?: string;
    last_submitted_at?: string;
    last_reviewed_at?: string;
  };
};

type AdminReviewListResponse = {
  items?: AdminReviewItem[];
  total?: number;
};

type AdminReviewLogItem = {
  id: number;
  action?: string;
  operator_role?: string;
  operator_id?: number;
  operator_name?: string;
  reason?: string;
  from_review_status?: string;
  to_review_status?: string;
  from_publish_status?: string;
  to_publish_status?: string;
  created_at?: string;
};

type AdminReviewLogListResponse = {
  items?: AdminReviewLogItem[];
  total?: number;
};

type AdminBatchActionResponse = {
  action?: string;
  total?: number;
  success_count?: number;
  failed?: Array<{
    collection_id: number;
    error: string;
  }>;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

async function parseApiError(res: Response) {
  try {
    const payload = (await res.clone().json()) as ApiErrorPayload;
    return (payload.message || payload.error || "").trim();
  } catch {
    return "";
  }
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN");
}

const REASON_TEMPLATES = [
  "疑似版权风险，请补充授权证明",
  "素材质量不达标（清晰度/构图不足）",
  "存在违规内容风险，请调整后重提",
  "运营活动结束，临时下架",
  "收到投诉，先行下架复核",
];

export default function AdminUGCReviewsPage() {
  const [items, setItems] = useState<AdminReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState("reviewing");
  const [actingCollectionID, setActingCollectionID] = useState<number | null>(null);
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);
  const [batchActing, setBatchActing] = useState<"approve" | "reject" | "offline" | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");

  const [logCollectionID, setLogCollectionID] = useState<number | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AdminReviewLogItem[]>([]);

  const allRowIDs = useMemo(() => items.map((item) => item.collection_id).filter((id) => id > 0), [items]);
  const allSelected = useMemo(
    () => allRowIDs.length > 0 && allRowIDs.every((id) => selectedIDs.includes(id)),
    [allRowIDs, selectedIDs]
  );

  const loadItems = async (status: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        page_size: "50",
        review_status: status,
      });
      const res = await fetchWithAuthRetry(`${API_BASE}/admin/ugc/reviews?${params.toString()}`);
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "加载审核列表失败");
        setItems([]);
        setTotal(0);
        setSelectedIDs([]);
        return;
      }
      const data = (await res.json()) as AdminReviewListResponse;
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setItems(nextItems);
      setTotal(typeof data.total === "number" ? data.total : nextItems.length);
      const idSet = new Set(nextItems.map((item) => item.collection_id));
      setSelectedIDs((prev) => prev.filter((id) => idSet.has(id)));
    } catch {
      setErrorMessage("加载审核列表失败");
      setItems([]);
      setTotal(0);
      setSelectedIDs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems(reviewStatus);
  }, [reviewStatus]);

  const toggleRow = (collectionID: number) => {
    if (!collectionID) return;
    setSelectedIDs((prev) => {
      if (prev.includes(collectionID)) return prev.filter((id) => id !== collectionID);
      return [...prev, collectionID];
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIDs([]);
      return;
    }
    setSelectedIDs(allRowIDs);
  };

  const callDecision = async (collectionID: number, action: "approve" | "reject" | "offline") => {
    if (!collectionID) return;
    const reason = reasonDraft.trim();
    if (action === "reject" && !reason) {
      setErrorMessage("驳回操作必须填写原因");
      return;
    }
    setActingCollectionID(collectionID);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/admin/ugc/reviews/${collectionID}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "操作失败");
        return;
      }
      await loadItems(reviewStatus);
    } catch {
      setErrorMessage("操作失败");
    } finally {
      setActingCollectionID(null);
    }
  };

  const callBatchAction = async (action: "approve" | "reject" | "offline") => {
    if (selectedIDs.length === 0) {
      setErrorMessage("请先勾选至少一个合集");
      return;
    }
    const reason = reasonDraft.trim();
    if (action === "reject" && !reason) {
      setErrorMessage("批量驳回必须填写原因");
      return;
    }
    setBatchActing(action);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/admin/ugc/reviews/batch/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_ids: selectedIDs,
          reason,
        }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        setErrorMessage(msg || "批量操作失败");
        return;
      }
      const payload = (await res.json()) as AdminBatchActionResponse;
      const failed = Array.isArray(payload.failed) ? payload.failed : [];
      const successCount = Number(payload.success_count || 0);
      if (failed.length > 0) {
        setErrorMessage(`批量操作完成：成功 ${successCount} 条，失败 ${failed.length} 条（请查看日志或重试）`);
      }
      setSelectedIDs([]);
      await loadItems(reviewStatus);
    } catch {
      setErrorMessage("批量操作失败");
    } finally {
      setBatchActing(null);
    }
  };

  const openLogs = async (collectionID: number) => {
    if (!collectionID) return;
    setLogCollectionID(collectionID);
    setLogsOpen(true);
    setLogs([]);
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await fetchWithAuthRetry(`${API_BASE}/admin/ugc/reviews/${collectionID}/logs?page=1&page_size=50`);
      if (!res.ok) {
        const msg = await parseApiError(res);
        setLogsError(msg || "加载日志失败");
        return;
      }
      const data = (await res.json()) as AdminReviewLogListResponse;
      setLogs(Array.isArray(data.items) ? data.items : []);
    } catch {
      setLogsError("加载日志失败");
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">UGC Reviews</h1>
            <p className="text-sm text-zinc-500">用户原创表情包提审、审核与上下架管理（支持批量审核）</p>
          </div>
          <div className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-zinc-500">共 {total} 条</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: "reviewing", label: "待审核" },
            { key: "approved", label: "已通过" },
            { key: "rejected", label: "已驳回" },
            { key: "draft", label: "草稿" },
            { key: "all", label: "全部" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setReviewStatus(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                reviewStatus === tab.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-zinc-700">运营备注模板：</span>
            {REASON_TEMPLATES.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setReasonDraft(tpl)}
                className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-200"
              >
                {tpl}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReasonDraft("")}
              className="rounded-md bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100"
            >
              清空
            </button>
          </div>
          <textarea
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            rows={2}
            placeholder="请输入审核备注（驳回时必填）"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={selectedIDs.length === 0 || Boolean(batchActing)}
              onClick={() => void callBatchAction("approve")}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {batchActing === "approve" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              批量通过（{selectedIDs.length}）
            </button>
            <button
              type="button"
              disabled={selectedIDs.length === 0 || Boolean(batchActing)}
              onClick={() => void callBatchAction("reject")}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              {batchActing === "reject" ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
              批量驳回（{selectedIDs.length}）
            </button>
            <button
              type="button"
              disabled={selectedIDs.length === 0 || Boolean(batchActing)}
              onClick={() => void callBatchAction("offline")}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
            >
              {batchActing === "offline" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              批量下架（{selectedIDs.length}）
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3">合集</th>
                <th className="px-4 py-3">作者</th>
                <th className="px-4 py-3">审核状态</th>
                <th className="px-4 py-3">上架状态</th>
                <th className="px-4 py-3">时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      加载中...
                    </span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const review = row.review;
                  const collection = row.collection;
                  const busy = actingCollectionID === row.collection_id;
                  return (
                    <tr key={row.collection_id} className="border-t">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIDs.includes(row.collection_id)}
                          onChange={() => toggleRow(row.collection_id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900">{collection?.title || `#${row.collection_id}`}</div>
                        <div className="text-xs text-zinc-500">{collection?.file_count || 0} 张</div>
                        <Link
                          href={`/mine/works/emoji-works/${row.collection_id}`}
                          className="text-xs font-semibold text-emerald-600 hover:underline"
                        >
                          查看作品页
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {row.owner_name || "-"}
                        <div className="text-xs text-zinc-400">UID: {row.owner_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          {review?.review_status || "-"}
                        </span>
                        {review?.reject_reason ? <div className="mt-1 text-xs text-rose-500">{review.reject_reason}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                          {review?.publish_status || "-"}
                        </span>
                        {review?.offline_reason ? <div className="mt-1 text-xs text-amber-600">{review.offline_reason}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        <div>提审：{formatDate(review?.last_submitted_at)}</div>
                        <div>审核：{formatDate(review?.last_reviewed_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void callDecision(row.collection_id, "approve")}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            通过
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void callDecision(row.collection_id, "reject")}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-200 px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                            驳回
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void callDecision(row.collection_id, "offline")}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 px-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                            下架
                          </button>
                          <button
                            type="button"
                            onClick={() => void openLogs(row.collection_id)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-indigo-200 px-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                          >
                            <FileClock size={12} />
                            日志
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {logsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">审核日志</h3>
                <p className="text-xs text-zinc-500">合集 ID：{logCollectionID || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setLogsOpen(false)}
                className="rounded-md border px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                关闭
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto p-4">
              {logsLoading ? (
                <div className="py-10 text-center text-sm text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    加载日志中...
                  </span>
                </div>
              ) : logsError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
                  {logsError}
                </div>
              ) : logs.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">暂无日志</div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-zinc-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                        <span className="font-semibold text-zinc-700">{log.action || "-"}</span>
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {log.operator_role || "-"} · {log.operator_name || "-"} ({log.operator_id || 0})
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        审核状态：{log.from_review_status || "-"} → {log.to_review_status || "-"} · 上架状态：
                        {log.from_publish_status || "-"} → {log.to_publish_status || "-"}
                      </div>
                      {log.reason ? <div className="mt-1 text-xs text-zinc-700">备注：{log.reason}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
