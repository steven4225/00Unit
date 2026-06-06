import React from "react";

type SourceStatusProps = {
  sourceLabel: string;
  statusDetail: string;
};

export function SourceStatus({
  sourceLabel,
  statusDetail
}: SourceStatusProps) {
  return (
    <section
      aria-labelledby="source-status-title"
      className="rounded-[24px] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-sky-50 p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2
            id="source-status-title"
            className="text-lg font-semibold text-slate-900"
          >
            输入源状态
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Phase-1 采用 mock transcript source，后续真实 ASR 将通过统一的
            TranscriptEvent 契约接入。
          </p>
        </div>

        <div className="inline-flex items-center gap-3 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm text-slate-700">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span>{sourceLabel}</span>
          <span className="text-slate-400">·</span>
          <span>{statusDetail}</span>
        </div>
      </div>
    </section>
  );
}
