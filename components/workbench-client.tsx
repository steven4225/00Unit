"use client";

import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { summaryResponseSchema, type SummaryResponse } from "../lib/schemas/summarize";
import { translationResponseSchema } from "../lib/schemas/translate";
import { MockTranscriptSource } from "../lib/source/mock-transcript-source";
import type { TranscriptSource } from "../lib/source/transcript-source";
import {
  createInitialSubtitleSessionState,
  subtitleSessionReducer
} from "../lib/subtitle/reducer";
import {
  selectRecentSubtitleWindow,
  selectSegmentsPendingTranslation
} from "../lib/subtitle/selectors";
import { ControlBar } from "./control-bar";
import { SourceStatus } from "./source-status";
import { SubtitleWorkspace } from "./subtitle-workspace";
import { SummaryPanel } from "./summary-panel";

type PlaybackStatus = "idle" | "playing" | "paused";
type SummaryStatus = "idle" | "loading" | "ready" | "error";

export function WorkbenchClient() {
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>("idle");
  const [subtitleState, dispatch] = useReducer(
    subtitleSessionReducer,
    undefined,
    createInitialSubtitleSessionState
  );
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>("idle");
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const sourceRef = useRef<TranscriptSource | null>(null);
  const latestItemsRef = useRef(subtitleState.itemsById);
  const translationAbortRef = useRef<AbortController | null>(null);
  const translationRequestVersionRef = useRef(0);

  if (!sourceRef.current) {
    sourceRef.current = new MockTranscriptSource();
  }

  useEffect(() => {
    latestItemsRef.current = subtitleState.itemsById;
  }, [subtitleState.itemsById]);

  const recentWindow = useMemo(
    () => selectRecentSubtitleWindow(subtitleState),
    [subtitleState]
  );

  const pendingTranslations = useMemo(
    () =>
      selectSegmentsPendingTranslation(subtitleState)
        .map((id) => subtitleState.itemsById[id])
        .filter(Boolean)
        .map((item) => ({
          id: item.id,
          text: item.english
        })),
    [subtitleState]
  );

  const fullTranscript = useMemo(
    () =>
      subtitleState.orderedSegmentIds
        .map((id) => subtitleState.itemsById[id]?.english ?? "")
        .filter(Boolean)
        .join("\n"),
    [subtitleState]
  );

  useEffect(() => {
    if (pendingTranslations.length === 0) {
      setIsTranslating(false);
      return;
    }

    translationAbortRef.current?.abort();
    const controller = new AbortController();
    translationAbortRef.current = controller;
    const requestVersion = ++translationRequestVersionRef.current;
    const requestSnapshot = Object.fromEntries(
      pendingTranslations.map((item) => [item.id, item.text])
    );

    async function runTranslation() {
      setIsTranslating(true);
      setTranslationError(null);

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            items: pendingTranslations
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Translation request failed");
        }

        const result = translationResponseSchema.parse(await response.json());

        if (translationRequestVersionRef.current !== requestVersion) {
          return;
        }

        result.items.forEach((item) => {
          if (latestItemsRef.current[item.id]?.english === requestSnapshot[item.id]) {
            dispatch({
              type: "TRANSLATION_APPLIED",
              id: item.id,
              chinese: item.chinese
            });
          }
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setTranslationError(
          error instanceof Error
            ? "中文字幕生成失败，请稍后重试。"
            : "中文字幕生成失败，请稍后重试。"
        );
      } finally {
        if (translationRequestVersionRef.current === requestVersion) {
          setIsTranslating(false);
        }
      }
    }

    void runTranslation();

    return () => {
      controller.abort();
    };
  }, [pendingTranslations]);

  function handleStart() {
    sourceRef.current?.start((event) => {
      dispatch({
        type: "TRANSCRIPT_RECEIVED",
        event
      });
    });
    setPlaybackStatus("playing");
  }

  function handlePause() {
    sourceRef.current?.pause();
    setPlaybackStatus("paused");
  }

  function handleReset() {
    translationAbortRef.current?.abort();
    sourceRef.current?.reset();
    dispatch({
      type: "SESSION_RESET"
    });
    setPlaybackStatus("idle");
    setIsTranslating(false);
    setTranslationError(null);
    setSummaryStatus("idle");
    setSummaryData(null);
    setSummaryError(null);
  }

  async function handleGenerateSummary() {
    if (!fullTranscript.trim()) {
      return;
    }

    setSummaryStatus("loading");
    setSummaryError(null);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullText: fullTranscript
        })
      });

      if (!response.ok) {
        throw new Error("Summary request failed");
      }

      const result = summaryResponseSchema.parse(await response.json());
      setSummaryData(result);
      setSummaryStatus("ready");
    } catch (error) {
      setSummaryStatus("error");
      setSummaryError(
        error instanceof Error
          ? "会后总结生成失败，请稍后重试。"
          : "会后总结生成失败，请稍后重试。"
      );
    }
  }

  const statusDetail =
    playbackStatus === "playing"
      ? "Playing"
      : playbackStatus === "paused"
        ? "Paused"
        : "Standby";

  return (
    <div className="grid gap-6 px-6 py-6 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
      <div className="flex flex-col gap-6">
        <SourceStatus
          sourceLabel="Mock Source"
          statusDetail={statusDetail}
        />
        <ControlBar
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
          onGenerateSummary={handleGenerateSummary}
          canStart={playbackStatus !== "playing"}
          canPause={playbackStatus === "playing"}
          isSummaryLoading={summaryStatus === "loading"}
        />
        <SubtitleWorkspace
          items={recentWindow}
          isTranslating={isTranslating}
          errorMessage={translationError}
        />
      </div>
      <SummaryPanel
        status={summaryStatus}
        summary={summaryData}
        errorMessage={summaryError}
      />
    </div>
  );
}
