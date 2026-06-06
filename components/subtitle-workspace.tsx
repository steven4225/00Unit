import React from "react";
import type { SubtitleItem } from "../lib/schemas/transcript";

type SubtitleWorkspaceProps = {
  items: SubtitleItem[];
  isTranslating: boolean;
  errorMessage: string | null;
};

const statusCopy: Record<SubtitleItem["status"], string> = {
  draft: "Draft",
  final: "Final",
  corrected: "Corrected"
};

export function SubtitleWorkspace({
  items,
  isTranslating,
  errorMessage
}: SubtitleWorkspaceProps) {
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
          {isTranslating ? "Translating" : "Rolling Pair"}
        </span>
      </div>

      {errorMessage ? (
        <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-4">
        {items.length === 0 ? (
          <article className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm leading-6 text-slate-500">
            点击“开始模拟”或切到 Cloud ASR 模式后开始实时输入，这里会滚动显示最近两组英中对应字幕。
          </article>
        ) : null}

        {items.map((segment, index) => {
          const isNewest = index === items.length - 1;

          return (
            <article
              key={segment.id}
              className={`rounded-[22px] border p-4 transition ${
                isNewest
                  ? "border-sky-200 bg-sky-50/70 shadow-[0_10px_32px_rgba(14,165,233,0.12)]"
                  : "border-slate-200 bg-slate-50/80"
              }`}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                  {isNewest ? "当前句" : "上一句"}
                </span>
                <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                  {statusCopy[segment.status]}
                </span>
              </div>
              <p className="text-lg font-medium leading-7 text-slate-900">
                {segment.english}
              </p>
              <p className="mt-3 text-base leading-7 text-slate-700">
                {segment.chinese ||
                  (segment.status === "draft"
                    ? "等待句子定稿后生成正式中文字幕。"
                    : "正在生成中文字幕...")}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
