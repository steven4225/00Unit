import React from "react";
import type { SummaryResponse } from "../lib/schemas/summarize";

type SummaryPanelProps = {
  status: "idle" | "loading" | "ready" | "error";
  summary: SummaryResponse | null;
  errorMessage: string | null;
};

export function SummaryPanel({
  status,
  summary,
  errorMessage
}: SummaryPanelProps) {
  const summaryText =
    status === "loading"
      ? "正在基于当前完整英文稿生成会后总结..."
      : status === "ready" && summary
        ? summary.summary
        : status === "error"
          ? errorMessage ?? "总结生成失败，请稍后重试。"
          : "在这个区域里，系统会基于当前完整英文稿输出中文摘要。";

  const keywords =
    status === "ready" && summary
      ? summary.keywords
      : ["small models", "translation", "correction"];

  const uncertainTerms =
    status === "ready" && summary
      ? summary.uncertainTerms
      : ["后续这里会提示可能识别不准或需要人工核对的术语。"];

  return (
    <aside
      aria-labelledby="summary-panel-title"
      className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="summary-panel-title" className="text-lg font-semibold">
            会后总结
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            summary、keywords、uncertainTerms 通过手动触发生成，和实时字幕链路分离。
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
          Manual
        </span>
      </div>

      <div className="mt-6 space-y-5">
        <section>
          <h3 className="text-sm font-medium text-slate-300">摘要预览</h3>
          <p className="mt-2 rounded-2xl bg-white/5 p-4 text-sm leading-6 text-slate-200">
            {summaryText}
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium text-slate-300">关键词</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.map((term) => (
              <span
                key={term}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200"
              >
                {term}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-slate-300">可疑术语</h3>
          <div className="mt-2 flex flex-col gap-2">
            {uncertainTerms.map((term) => (
              <p
                key={term}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200"
              >
                {term}
              </p>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
