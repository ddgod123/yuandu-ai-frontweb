export function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN");
}

export function aiStatusLabel(raw: string) {
  const value = raw.trim().toLowerCase();
  switch (value) {
    case "done":
      return "完成";
    case "repaired":
      return "已修复";
    case "warn":
      return "风险";
    case "error":
      return "失败";
    case "pending":
      return "待处理";
    default:
      return value || "未知";
  }
}

export function aiStatusBadgeClass(raw: string) {
  const value = raw.trim().toLowerCase();
  switch (value) {
    case "done":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "repaired":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "warn":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "pending":
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-slate-200 bg-white text-slate-500";
  }
}

