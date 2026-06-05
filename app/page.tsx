import React from "react";
import { ControlBar } from "../components/control-bar";
import { SourceStatus } from "../components/source-status";
import { SubtitleWorkspace } from "../components/subtitle-workspace";
import { SummaryPanel } from "../components/summary-panel";

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="border-b border-slate-200/80 px-6 py-6 md:px-8">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-700">
              Phase-1 Workbench Shell
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              AI 英文演讲实时字幕翻译助手
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              这一版先聚焦英文转写事件进入后的翻译、修正与总结链路，页面形态按单页工作台搭建。
            </p>
          </div>

          <div className="grid gap-6 px-6 py-6 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
            <div className="flex flex-col gap-6">
              <SourceStatus />
              <ControlBar />
              <SubtitleWorkspace />
            </div>
            <SummaryPanel />
          </div>
        </section>
      </div>
    </main>
  );
}
