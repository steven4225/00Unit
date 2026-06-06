import React from "react";
import { WorkbenchClient } from "../components/workbench-client";

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="border-b border-slate-200/80 px-6 py-6 md:px-8">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-700">
              Phase-2 Real Input Workbench
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              AI 英文演讲实时字幕翻译助手
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              当前版本在保留 phase-1 翻译、修正与总结链路的基础上，开始接入真实
              Cloud ASR 输入模式，并继续保留 mock 演示模式。
            </p>
          </div>

          <WorkbenchClient />
        </section>
      </div>
    </main>
  );
}
