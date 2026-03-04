"use client";

type AuthPromptModalProps = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onLogin: () => void;
};

export default function AuthPromptModal({
  open,
  title = "请先登录",
  message,
  onClose,
  onLogin,
}: AuthPromptModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <p className="mt-2 text-sm font-semibold text-slate-600">{message}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
          >
            去登录
          </button>
        </div>
      </div>
    </div>
  );
}
