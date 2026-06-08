"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  isSubtitleMonitorMessage,
  type SubtitleMonitorMessage,
  type SubtitleMonitorSnapshot,
  SUBTITLE_MONITOR_CHANNEL_NAME
} from "../../lib/subtitle/subtitle-monitor-channel";

const initialSnapshot: SubtitleMonitorSnapshot = {
  sessionId: "subtitle-monitor-initial",
  items: [],
  isTranslating: false,
  modeLabel: "Subtitle Monitor",
  statusDetail: "Waiting for workbench"
};

type MonitorDisplayMode = "bilingual" | "source" | "chinese";
type MonitorTextSize = "compact" | "comfort" | "large";
type MonitorVisibleCount = 1 | 2;

const sourceTextSizeClass: Record<MonitorTextSize, string> = {
  compact: "text-xl leading-8",
  comfort: "text-2xl leading-9",
  large: "text-3xl leading-10"
};

const chineseTextSizeClass: Record<MonitorTextSize, string> = {
  compact: "text-base leading-7",
  comfort: "text-lg leading-8",
  large: "text-2xl leading-9"
};

export default function SubtitleMonitorPage() {
  const [snapshot, setSnapshot] = useState<SubtitleMonitorSnapshot>(initialSnapshot);
  const [displayMode, setDisplayMode] =
    useState<MonitorDisplayMode>("bilingual");
  const [textSize, setTextSize] = useState<MonitorTextSize>("comfort");
  const [visibleCount, setVisibleCount] = useState<MonitorVisibleCount>(2);
  const activeSessionIdRef = useRef<string | null>(null);
  const visibleItems = snapshot.items.slice(-visibleCount);
  const showSourceText = displayMode === "bilingual" || displayMode === "source";
  const showChineseText =
    displayMode === "bilingual" || displayMode === "chinese";

  function getControlButtonClass(isActive: boolean) {
    return `rounded-full border px-3 py-1 text-xs font-semibold transition ${
      isActive
        ? "border-sky-300/70 bg-sky-300/20 text-white"
        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10"
    }`;
  }

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(SUBTITLE_MONITOR_CHANNEL_NAME);
    channel.postMessage({
      type: "monitor-ready"
    } satisfies SubtitleMonitorMessage);
    channel.postMessage({
      type: "request-snapshot"
    } satisfies SubtitleMonitorMessage);

    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;

      if (!isSubtitleMonitorMessage(message)) {
        return;
      }

      if (message.type === "session-reset") {
        activeSessionIdRef.current = message.sessionId;
        setSnapshot({
          sessionId: message.sessionId,
          items: [],
          isTranslating: false,
          modeLabel: message.modeLabel,
          statusDetail: message.statusDetail
        });
        return;
      }

      if (message.type !== "snapshot") {
        return;
      }

      if (
        activeSessionIdRef.current !== null &&
        activeSessionIdRef.current !== message.snapshot.sessionId
      ) {
        return;
      }

      activeSessionIdRef.current = message.snapshot.sessionId;
      setSnapshot(message.snapshot);
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

        <section
          aria-label="Subtitle monitor display controls"
          className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <p className="text-sm font-semibold text-white">Local view only</p>
              <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
                These controls only change this pop-out window. They do not affect the main workbench.
              </p>
            </div>
            <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">
              Display
            </span>
          </div>
          <div className="grid gap-4 text-xs text-slate-300 sm:grid-cols-3">
            <div>
              <p className="mb-2 font-semibold uppercase tracking-[0.16em] text-slate-400">
                Display
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={displayMode === "bilingual"}
                  className={getControlButtonClass(displayMode === "bilingual")}
                  onClick={() => setDisplayMode("bilingual")}
                >
                  Bilingual
                </button>
                <button
                  type="button"
                  aria-pressed={displayMode === "source"}
                  className={getControlButtonClass(displayMode === "source")}
                  onClick={() => setDisplayMode("source")}
                >
                  Source only
                </button>
                <button
                  type="button"
                  aria-pressed={displayMode === "chinese"}
                  className={getControlButtonClass(displayMode === "chinese")}
                  onClick={() => setDisplayMode("chinese")}
                >
                  Chinese only
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold uppercase tracking-[0.16em] text-slate-400">
                Text size
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={textSize === "compact"}
                  className={getControlButtonClass(textSize === "compact")}
                  onClick={() => setTextSize("compact")}
                >
                  Compact text
                </button>
                <button
                  type="button"
                  aria-pressed={textSize === "comfort"}
                  className={getControlButtonClass(textSize === "comfort")}
                  onClick={() => setTextSize("comfort")}
                >
                  Comfort text
                </button>
                <button
                  type="button"
                  aria-pressed={textSize === "large"}
                  className={getControlButtonClass(textSize === "large")}
                  onClick={() => setTextSize("large")}
                >
                  Large text
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold uppercase tracking-[0.16em] text-slate-400">
                Recent items
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={visibleCount === 1}
                  className={getControlButtonClass(visibleCount === 1)}
                  onClick={() => setVisibleCount(1)}
                >
                  Latest only
                </button>
                <button
                  type="button"
                  aria-pressed={visibleCount === 2}
                  className={getControlButtonClass(visibleCount === 2)}
                  onClick={() => setVisibleCount(2)}
                >
                  Latest two
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          {visibleItems.length === 0 ? (
            <article className="rounded-[28px] border border-dashed border-sky-200/20 bg-sky-200/[0.04] px-6 py-8 text-sm leading-6 text-slate-300">
              <p className="text-base font-semibold text-white">
                Waiting for subtitles
              </p>
              <p className="mt-2 max-w-lg text-slate-300">
                Open the main workbench, start realtime input, then keep this window near your video.
              </p>
            </article>
          ) : null}

          {visibleItems.map((item, index) => {
            const isNewest = index === visibleItems.length - 1;

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
                {showSourceText ? (
                  <p className={`${sourceTextSizeClass[textSize]} font-semibold text-white`}>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Source text
                    </span>
                    {item.english}
                  </p>
                ) : null}
                {showChineseText ? (
                  <p className={`mt-3 ${chineseTextSizeClass[textSize]} text-slate-200`}>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Chinese
                    </span>
                    {item.chinese ??
                      (item.status === "draft"
                        ? "Chinese preview will appear after the current line stabilizes."
                        : "Chinese translation is being generated...")}
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
