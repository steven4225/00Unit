import React from "react";

type SourceStatusProps = {
  sourceLabel: string;
  statusDetail: string;
  modeLabel: string;
  errorMessage: string | null;
};

export function SourceStatus({
  sourceLabel,
  statusDetail,
  modeLabel,
  errorMessage
}: SourceStatusProps) {
  return (
    <section
      aria-labelledby="source-status-title"
      className="rounded-[24px] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-sky-50 p-5"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2
              id="source-status-title"
              className="text-lg font-semibold text-slate-900"
            >
              输入源状态
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              phase-2 保留 mock 模式，同时新增基于浏览器麦克风和 cloud asr 的真实输入模式。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>{modeLabel}</span>
            <span className="text-slate-400">·</span>
            <span>{sourceLabel}</span>
            <span className="text-slate-400">·</span>
            <span>{statusDetail}</span>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}
