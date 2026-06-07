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
      ? "正在基于当前完整识别稿生成会后总结..."
      : status === "ready" && summary
        ? summary.summary
        : status === "error"
          ? errorMessage ?? "总结生成失败，请稍后重试。"
          : "在这个区域里，系统会基于当前完整识别稿输出中文摘要。";

  const keywords = status === "ready" && summary ? summary.keywords : [];
  const uncertainTerms =
    status === "ready" && summary ? summary.uncertainTerms : [];

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
          {keywords.length > 0 ? (
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
          ) : (
            <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              生成总结后，这里会显示自动提取的关键词。
            </p>
          )}
        </section>

        <section>
          <h3 className="text-sm font-medium text-slate-300">可疑术语</h3>
          {uncertainTerms.length > 0 ? (
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
          ) : (
            <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              生成总结后，这里会显示需要复核的术语或片段。
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
