import React from "react";

type ControlBarProps = {
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onGenerateSummary: () => void;
  canStart: boolean;
  canPause: boolean;
  isSummaryLoading: boolean;
};

export function ControlBar({
  onStart,
  onPause,
  onReset,
  onGenerateSummary,
  canStart,
  canPause,
  isSummaryLoading
}: ControlBarProps) {
  return (
    <section
      aria-labelledby="control-area-title"
      className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2
            id="control-area-title"
            className="text-lg font-semibold text-slate-900"
          >
            控制区
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            使用 mock transcript source 演示开始、暂停、重置和手动总结的完整链路。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 shadow-sm transition hover:border-sky-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            开始模拟
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
            onClick={onGenerateSummary}
            disabled={isSummaryLoading}
            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm transition hover:border-amber-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {isSummaryLoading ? "生成中..." : "生成总结"}
          </button>
        </div>
      </div>
    </section>
  );
}
