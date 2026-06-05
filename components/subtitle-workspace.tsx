import React from "react";

const sampleSegments = [
  {
    status: "上一句",
    english: "Today I want to talk about small language models in real products.",
    chinese: "今天我想谈谈小型语言模型在真实产品中的应用。"
  },
  {
    status: "当前句",
    english: "The goal is to keep translation readable even when a recent phrase gets corrected.",
    chinese: "目标是在最近一句发生修正时，仍然让翻译保持稳定可读。"
  }
] as const;

export function SubtitleWorkspace() {
  return (
    <section
      aria-labelledby="subtitle-workspace-title"
      className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
    >
      <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2
            id="subtitle-workspace-title"
            className="text-lg font-semibold text-slate-900"
          >
            主字幕区
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            采用最近两句的滚动窗口展示，每组字幕块上方英文、下方中文。
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          Rolling Pair
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {sampleSegments.map((segment, index) => (
          <article
            key={segment.status}
            className={`rounded-[22px] border p-4 transition ${
              index === sampleSegments.length - 1
                ? "border-sky-200 bg-sky-50/70 shadow-[0_10px_32px_rgba(14,165,233,0.12)]"
                : "border-slate-200 bg-slate-50/80"
            }`}
          >
            <div className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
              {segment.status}
            </div>
            <p className="text-lg font-medium leading-7 text-slate-900">
              {segment.english}
            </p>
            <p className="mt-3 text-base leading-7 text-slate-700">
              {segment.chinese}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
