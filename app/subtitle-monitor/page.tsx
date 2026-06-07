"use client";

import React, { useEffect, useState } from "react";
import {
  type SubtitleMonitorSnapshot,
  SUBTITLE_MONITOR_CHANNEL_NAME
} from "../../lib/subtitle/subtitle-monitor-channel";

const initialSnapshot: SubtitleMonitorSnapshot = {
  items: [],
  isTranslating: false,
  modeLabel: "Subtitle Monitor",
  statusDetail: "Waiting for workbench"
};

export default function SubtitleMonitorPage() {
  const [snapshot, setSnapshot] =
    useState<SubtitleMonitorSnapshot>(initialSnapshot);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(SUBTITLE_MONITOR_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<SubtitleMonitorSnapshot>) => {
      setSnapshot(event.data);
    };

    return () => {
      channel.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-slate-50">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <header className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.24)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Subtitle Monitor
              </p>
              <h1 className="mt-2 text-xl font-semibold text-white">
                {snapshot.modeLabel}
              </h1>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">
              {snapshot.statusDetail}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {snapshot.isTranslating
              ? "Receiving live subtitles and translation updates."
              : "Waiting for the next subtitle update from the workbench."}
          </p>
        </header>

        <section className="flex flex-col gap-3">
          {snapshot.items.length === 0 ? (
            <article className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] px-5 py-6 text-sm leading-6 text-slate-300">
              Start realtime input in the main workbench and the latest subtitle
              pair will appear here.
            </article>
          ) : null}

          {snapshot.items.map((item, index) => {
            const isNewest = index === snapshot.items.length - 1;

            return (
              <article
                key={item.id}
                className={`rounded-[24px] border px-5 py-4 ${
                  isNewest
                    ? "border-sky-400/40 bg-sky-400/10"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {isNewest ? "Current" : "Previous"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase">
                    {item.status}
                  </span>
                </div>
                <p className="text-2xl font-semibold leading-9 text-white">
                  {item.english}
                </p>
                <p className="mt-3 text-lg leading-8 text-slate-200">
                  {item.chinese ??
                    (item.status === "draft"
                      ? "Chinese preview will appear after the current line stabilizes."
                      : "Chinese translation is being generated...")}
                </p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
