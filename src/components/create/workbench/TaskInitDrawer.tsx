"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import type {
  WorkbenchAdvancedFocusOption,
  WorkbenchAdvancedSceneOption,
  WorkbenchFormatOption,
  WorkbenchModelOption,
} from "./types";

type TaskInitDrawerProps = {
  open: boolean;
  onClose: () => void;
  selectedFormat: string;
  formatOptions: WorkbenchFormatOption[];
  onChangeFormat: (value: string) => void;
  selectedAIModel: string;
  modelOptions: WorkbenchModelOption[];
  onChangeModel: (value: string) => void;
  selectedPNGMode: "smart_llm" | "fast_extract";
  onChangePNGMode: (value: "smart_llm" | "fast_extract") => void;
  fastExtractFPS: 1 | 2;
  onChangeFastExtractFPS: (value: 1 | 2) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedFileName: string;
  submitting: boolean;
  onFileSelected: (file: File | null) => void;
  showAdvancedOptions: boolean;
  onToggleAdvancedOptions: () => void;
  advancedSceneOptions: WorkbenchAdvancedSceneOption[];
  advancedScene: string;
  onChangeScene: (value: string) => void;
  advancedFocusOptions: WorkbenchAdvancedFocusOption[];
  advancedVisualFocus: string[];
  onToggleFocus: (value: string) => void;
  promptText: string;
  onPromptChange: (value: string) => void;
  promptMaxChars: number;
  onSend: () => void;
  sendBlockReason?: string;
  selectedFormatReason?: string;
  disabledSend: boolean;
};

export function TaskInitDrawer({
  open,
  onClose,
  selectedFormat,
  formatOptions,
  onChangeFormat,
  selectedAIModel,
  modelOptions,
  onChangeModel,
  selectedPNGMode,
  onChangePNGMode,
  fastExtractFPS,
  onChangeFastExtractFPS,
  fileInputRef,
  selectedFileName,
  submitting,
  onFileSelected,
  showAdvancedOptions,
  onToggleAdvancedOptions,
  advancedSceneOptions,
  advancedScene,
  onChangeScene,
  advancedFocusOptions,
  advancedVisualFocus,
  onToggleFocus,
  promptText,
  onPromptChange,
  promptMaxChars,
  onSend,
  sendBlockReason,
  selectedFormatReason,
  disabledSend,
}: TaskInitDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const format = selectedFormat.trim().toLowerCase();
  const advancedSupported = format === "png";
  const isPNGFastMode = format === "png" && selectedPNGMode === "fast_extract";

  return (
    <>
      <button
        type="button"
        aria-label="关闭新建任务抽屉"
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex h-full w-full max-w-[460px] flex-col rounded-r-2xl border-r border-slate-200 bg-white shadow-2xl transition-transform">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/50 text-emerald-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">新建创作任务</div>
              <p className="mt-0.5 text-xs font-medium text-slate-500">配置参数并上传视频，开始 AI 创作</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="关闭"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-slate-700">
              输出格式
              <select
                value={selectedFormat}
                onChange={(event) => onChangeFormat(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
              >
                {formatOptions.map((item) => (
                  <option key={item.value} value={item.value} disabled={item.disabled}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              AI 模型
              <select
                value={selectedAIModel}
                onChange={(event) => onChangeModel(event.target.value)}
                disabled={submitting || isPNGFastMode}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
              >
                {modelOptions.map((item) => (
                  <option key={item.value} value={item.value} disabled={item.disabled}>
                    {item.label}
                  </option>
                ))}
              </select>
              {isPNGFastMode ? (
                <p className="mt-1 text-[11px] font-medium text-slate-500">普通模式会跳过 AI1~AI3，模型设置不生效。</p>
              ) : null}
            </label>
          </div>

          {format === "png" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-sm font-semibold text-slate-700">PNG 出图模式</div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => onChangePNGMode("smart_llm")}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedPNGMode === "smart_llm"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  智能出图（AI1→AI3）
                </button>
                <button
                  type="button"
                  onClick={() => onChangePNGMode("fast_extract")}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedPNGMode === "fast_extract"
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  普通模式（按秒切帧）
                </button>
              </div>
              {selectedPNGMode === "fast_extract" ? (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-slate-600">
                    切帧频率
                    <select
                      value={String(fastExtractFPS)}
                      onChange={(event) => onChangeFastExtractFPS(event.target.value === "2" ? 2 : 1)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    >
                      <option value="1">1 秒 1 帧</option>
                      <option value="2">1 秒 2 帧</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">视频源文件</label>
            <div className="group relative flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3 transition-colors hover:border-emerald-400 hover:bg-emerald-50/30">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition-all hover:bg-slate-50 hover:text-emerald-600 disabled:opacity-50"
              >
                选择文件
              </button>
              <div className="min-w-0 flex-1">
                {selectedFileName ? (
                  <div className="truncate text-sm font-medium text-emerald-700">{selectedFileName}</div>
                ) : (
                  <div className="truncate text-sm text-slate-400">尚未选择视频...</div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo,video/mpeg,video/x-ms-wmv,video/x-flv,video/3gpp,video/mp2t,.m4v,.mts,.m2ts,.mpg"
                className="hidden"
                onChange={(event) => onFileSelected(event.target.files?.[0] || null)}
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                if (isPNGFastMode) return;
                onToggleAdvancedOptions();
              }}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm transition-colors ${
                isPNGFastMode
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                高级处理选项
              </div>
              <svg className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${showAdvancedOptions ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isPNGFastMode ? (
              <p className="mt-2 text-[11px] font-medium text-slate-500">普通模式按秒切帧，场景/聚焦等 AI 高级策略暂不参与。</p>
            ) : null}
            {showAdvancedOptions ? (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                {!isPNGFastMode && advancedSupported ? (
                  <>
                    <div className="text-xs font-bold text-slate-700">场景与用途</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {advancedSceneOptions.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => onChangeScene(item.value)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                            advancedScene === item.value
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 text-xs font-bold text-slate-700">视觉聚焦 <span className="text-[10px] font-normal text-slate-400">（最多2项）</span></div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {advancedFocusOptions.map((item) => {
                        const active = advancedVisualFocus.includes(item.value);
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => onToggleFocus(item.value)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                              active
                                ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-[12px] text-slate-600">
                    {isPNGFastMode
                      ? "普通模式已关闭 AI 高级策略，请切换到“智能出图（AI1→AI3）”后配置。"
                      : `${selectedFormat.toUpperCase()} 高级处理策略研发中，当前仅 PNG 可配置。`}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>任务描述</span>
              <span className="text-xs font-normal text-slate-400">
                {promptText.length} / {promptMaxChars}
              </span>
            </label>
            <textarea
              value={promptText}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="例如：帮我挑选最有张力的清晰特写，适合封面展示"
              rows={5}
              maxLength={promptMaxChars}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  if (!disabledSend) onSend();
                }
              }}
            />
            {selectedFormatReason ? (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{selectedFormatReason}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              {sendBlockReason ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="truncate">{sendBlockReason}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans font-semibold text-slate-500">Cmd</kbd>
                  <span>+</span>
                  <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans font-semibold text-slate-500">Enter</kbd>
                  <span>发送</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onSend}
              disabled={disabledSend}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none active:scale-[0.98]"
              title={sendBlockReason || "发送任务"}
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  发送中...
                </>
              ) : (
                <>
                  发送任务
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
