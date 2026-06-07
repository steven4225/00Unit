import React from "react";

export type InputMode = "mock" | "cloud-asr-mic" | "cloud-asr-tab";

type ControlBarProps = {
  inputMode: InputMode;
  onModeChange: (mode: InputMode) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onGenerateSummary: () => void;
  onOpenSubtitleMonitor: () => void;
  onRetry: () => void;
  canStart: boolean;
  canPause: boolean;
  canRetry: boolean;
  isSummaryLoading: boolean;
  isRealtimeStarting: boolean;
  monitorErrorMessage?: string | null;
};

export function ControlBar({
  inputMode,
  onModeChange,
  onStart,
  onPause,
  onReset,
  onGenerateSummary,
  onOpenSubtitleMonitor,
  onRetry,
  canStart,
  canPause,
  canRetry,
  isSummaryLoading,
  isRealtimeStarting,
  monitorErrorMessage
}: ControlBarProps) {
  const startButtonLabel =
    inputMode === "mock"
      ? "开始模拟"
      : isRealtimeStarting
        ? "连接中..."
        : inputMode === "cloud-asr-tab"
          ? "共享标签页音频"
          : "开始实时输入";

  return (
    <section
      aria-labelledby="control-area-title"
      className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2
              id="control-area-title"
              className="text-lg font-semibold text-slate-900"
            >
              控制区
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              可在 mock 和 cloud asr 间切换输入模式，复用同一条翻译、修正和总结工作流。
            </p>
          </div>

          <div
            className="inline-flex flex-wrap gap-2 rounded-full border border-slate-200 bg-white p-1"
            role="group"
            aria-label="输入模式"
          >
            <ModeButton
              label="Mock"
              isActive={inputMode === "mock"}
              onClick={() => onModeChange("mock")}
            />
            <ModeButton
              label="Cloud ASR (Mic)"
              isActive={inputMode === "cloud-asr-mic"}
              onClick={() => onModeChange("cloud-asr-mic")}
            />
            <ModeButton
              label="Cloud ASR (Tab Audio)"
              isActive={inputMode === "cloud-asr-tab"}
              onClick={() => onModeChange("cloud-asr-tab")}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 shadow-sm transition hover:border-sky-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {startButtonLabel}
          </button>
          <button
            type="button"
            onClick={onPause}
            disabled={!canPause}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            暂停
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
          >
            重置
          </button>
          <button
            type="button"
            onClick={onOpenSubtitleMonitor}
            className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 shadow-sm transition hover:border-violet-300"
          >
            打开字幕窗
          </button>
          <button
            type="button"
            onClick={onGenerateSummary}
            disabled={isSummaryLoading}
            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm transition hover:border-amber-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {isSummaryLoading ? "生成中..." : "生成总结"}
          </button>
          {canRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800 shadow-sm transition hover:border-rose-300"
            >
              重试连接
            </button>
          ) : null}
        </div>

        {monitorErrorMessage ? (
          <p
            role="alert"
            className="rounded-[18px] border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800"
          >
            {monitorErrorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

type ModeButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function ModeButton({ label, isActive, onClick }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        isActive
          ? "bg-slate-950 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      {label}
    </button>
  );
}
