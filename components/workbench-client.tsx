"use client";

import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  createDefaultCloudAsrSource,
  type CloudAsrInputKind,
  type CloudAsrRuntime
} from "../lib/asr/create-default-cloud-asr-source";
import { summaryResponseSchema, type SummaryResponse } from "../lib/schemas/summarize";
import { translationResponseSchema } from "../lib/schemas/translate";
import { MockTranscriptSource } from "../lib/source/mock-transcript-source";
import type { TranscriptSource } from "../lib/source/transcript-source";
import {
  createInitialSubtitleSessionState,
  subtitleSessionReducer
} from "../lib/subtitle/reducer";
import {
  createSubtitleMonitorSessionId,
  isSubtitleMonitorMessage,
  type SubtitleMonitorMessage,
  type SubtitleMonitorSnapshot,
  SUBTITLE_MONITOR_CHANNEL_NAME,
  SUBTITLE_MONITOR_WINDOW_PATH
} from "../lib/subtitle/subtitle-monitor-channel";
import {
  selectRecentSubtitleWindow,
  selectSegmentsPendingTranslation
} from "../lib/subtitle/selectors";
import { ControlBar, type InputMode } from "./control-bar";
import { SourceStatus } from "./source-status";
import { SubtitleWorkspace } from "./subtitle-workspace";
import { SummaryPanel } from "./summary-panel";

type PlaybackStatus = "idle" | "starting" | "playing" | "paused";
type SummaryStatus = "idle" | "loading" | "ready" | "error";
const DRAFT_PREVIEW_TRANSLATION_DEBOUNCE_MS = 800;

type WorkbenchClientProps = {
  createMockSource?: () => TranscriptSource;
  createCloudAsrSource?: (inputKind: CloudAsrInputKind) => CloudAsrRuntime;
};

export function WorkbenchClient({
  createMockSource = () => new MockTranscriptSource(),
  createCloudAsrSource = (inputKind) => createDefaultCloudAsrSource({ inputKind })
}: WorkbenchClientProps) {
  const [inputMode, setInputMode] = useState<InputMode>("mock");
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>("idle");
  const [subtitleState, dispatch] = useReducer(
    subtitleSessionReducer,
    undefined,
    createInitialSubtitleSessionState
  );
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [audioChunkCount, setAudioChunkCount] = useState(0);
  const [providerEventCount, setProviderEventCount] = useState(0);
  const [audioLevelPercent, setAudioLevelPercent] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPreviewTranslating, setIsPreviewTranslating] = useState(false);
  const [activeTranslationId, setActiveTranslationId] = useState<string | null>(null);
  const [blockedTranslationKey, setBlockedTranslationKey] = useState<string | null>(null);
  const [blockedPreviewTranslationKey, setBlockedPreviewTranslationKey] = useState<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>("idle");
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [monitorErrorMessage, setMonitorErrorMessage] = useState<string | null>(null);
  const [subtitleMonitorSessionId, setSubtitleMonitorSessionId] = useState(() =>
    createSubtitleMonitorSessionId()
  );

  const mockSourceRef = useRef<TranscriptSource | null>(null);
  const cloudSourceRef = useRef<CloudAsrRuntime | null>(null);
  const latestItemsRef = useRef(subtitleState.itemsById);
  const translationAbortRef = useRef<AbortController | null>(null);
  const previewTranslationAbortRef = useRef<AbortController | null>(null);
  const subtitleMonitorChannelRef = useRef<BroadcastChannel | null>(null);
  const subtitleMonitorSessionIdRef = useRef(subtitleMonitorSessionId);
  const latestSubtitleMonitorSnapshotRef =
    useRef<SubtitleMonitorSnapshot | null>(null);

  if (!mockSourceRef.current) {
    mockSourceRef.current = createMockSource();
  }

  useEffect(() => {
    latestItemsRef.current = subtitleState.itemsById;
  }, [subtitleState.itemsById]);

  useEffect(() => {
    subtitleMonitorSessionIdRef.current = subtitleMonitorSessionId;
  }, [subtitleMonitorSessionId]);

  useEffect(() => {
    return () => {
      translationAbortRef.current?.abort();
      previewTranslationAbortRef.current?.abort();
      subtitleMonitorChannelRef.current?.close();
      mockSourceRef.current?.pause();
      void stopRealtimeSource(cloudSourceRef.current);
    };
  }, []);

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

  const activeDraftPreviewCandidate = useMemo(() => {
    const latestId =
      subtitleState.orderedSegmentIds[subtitleState.orderedSegmentIds.length - 1];

    if (!latestId) {
      return null;
    }

    const latestItem = subtitleState.itemsById[latestId];

    if (!latestItem || latestItem.status !== "draft") {
      return null;
    }

    return {
      id: latestItem.id,
      text: latestItem.english,
      existingChinese: latestItem.chinese
    };
  }, [subtitleState]);

  useEffect(() => {
    if (pendingTranslations.length === 0 && activeTranslationId === null) {
      setIsTranslating(false);
      if (blockedTranslationKey !== null) {
        setBlockedTranslationKey(null);
      }
      return;
    }

    if (activeTranslationId !== null || pendingTranslations.length === 0) {
      return;
    }

    const nextTranslation = pendingTranslations[0];
    const nextTranslationKey = createTranslationRequestKey(nextTranslation);

    if (
      blockedTranslationKey !== null &&
      blockedTranslationKey !== nextTranslationKey
    ) {
      setBlockedTranslationKey(null);
      return;
    }

    if (blockedTranslationKey === nextTranslationKey) {
      setIsTranslating(false);
      return;
    }

    const controller = new AbortController();
    translationAbortRef.current = controller;

    async function runTranslation() {
      setActiveTranslationId(nextTranslation.id);
      setIsTranslating(true);
      setTranslationError(null);

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            items: [nextTranslation]
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Translation request failed");
        }

        const result = translationResponseSchema.parse(await response.json());

        result.items.forEach((item) => {
          if (latestItemsRef.current[item.id]?.english === nextTranslation.text) {
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

        setBlockedTranslationKey(nextTranslationKey);
        setTranslationError(
          error instanceof Error
            ? "中文字幕生成失败，请稍后重试。"
            : "中文字幕生成失败，请稍后重试。"
        );
      } finally {
        if (translationAbortRef.current === controller) {
          translationAbortRef.current = null;
        }
        setActiveTranslationId(null);
      }
    }

    void runTranslation();
  }, [activeTranslationId, blockedTranslationKey, pendingTranslations]);

  useEffect(() => {
    if (!activeDraftPreviewCandidate) {
      setIsPreviewTranslating(false);
      if (blockedPreviewTranslationKey !== null) {
        setBlockedPreviewTranslationKey(null);
      }
      return;
    }

    const previewTranslationKey = createTranslationRequestKey(
      activeDraftPreviewCandidate
    );

    if (
      blockedPreviewTranslationKey !== null &&
      blockedPreviewTranslationKey !== previewTranslationKey
    ) {
      setBlockedPreviewTranslationKey(null);
      return;
    }

    if (blockedPreviewTranslationKey === previewTranslationKey) {
      setIsPreviewTranslating(false);
      return;
    }

    if (activeDraftPreviewCandidate.existingChinese) {
      setIsPreviewTranslating(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      previewTranslationAbortRef.current?.abort();
      previewTranslationAbortRef.current = controller;

      void runDraftPreviewTranslation({
        candidate: activeDraftPreviewCandidate,
        controller,
        onApplied: (item) => {
          if (
            latestItemsRef.current[item.id]?.english ===
              activeDraftPreviewCandidate.text &&
            latestItemsRef.current[item.id]?.status === "draft"
          ) {
            dispatch({
              type: "TRANSLATION_APPLIED",
              id: item.id,
              chinese: item.chinese
            });
          }
        },
        onError: (error) => {
          if (controller.signal.aborted) {
            return;
          }

          setBlockedPreviewTranslationKey(previewTranslationKey);
          setTranslationError(
            error instanceof Error
              ? "中文字幕生成失败，请稍后重试。"
              : "中文字幕生成失败，请稍后重试。"
          );
        },
        onStart: () => {
          setIsPreviewTranslating(true);
          setTranslationError(null);
        },
        onFinish: () => {
          if (previewTranslationAbortRef.current === controller) {
            previewTranslationAbortRef.current = null;
          }
          setIsPreviewTranslating(false);
        }
      });
    }, DRAFT_PREVIEW_TRANSLATION_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      if (previewTranslationAbortRef.current === controller) {
        controller.abort();
        previewTranslationAbortRef.current = null;
      }
    };
  }, [activeDraftPreviewCandidate, blockedPreviewTranslationKey]);

  async function stopRealtimeSource(
    target: CloudAsrRuntime | null = cloudSourceRef.current
  ) {
    if (!target) {
      return;
    }

    try {
      await target.stop();
    } finally {
      if (cloudSourceRef.current === target) {
        cloudSourceRef.current = null;
      }
    }
  }

  function postSubtitleMonitorMessage(message: SubtitleMonitorMessage) {
    subtitleMonitorChannelRef.current?.postMessage(message);
  }

  function beginSubtitleMonitorSession({
    modeLabel: nextModeLabel = modeLabel,
    statusDetail: nextStatusDetail = statusDetail
  }: {
    modeLabel?: string;
    statusDetail?: string;
  } = {}) {
    const nextSessionId = createSubtitleMonitorSessionId();
    const snapshot: SubtitleMonitorSnapshot = {
      sessionId: nextSessionId,
      items: [],
      isTranslating: false,
      modeLabel: nextModeLabel,
      statusDetail: nextStatusDetail
    };

    subtitleMonitorSessionIdRef.current = nextSessionId;
    latestSubtitleMonitorSnapshotRef.current = snapshot;
    setSubtitleMonitorSessionId(nextSessionId);
    postSubtitleMonitorMessage({
      type: "session-reset",
      sessionId: nextSessionId,
      modeLabel: nextModeLabel,
      statusDetail: nextStatusDetail
    });
    postSubtitleMonitorMessage({
      type: "snapshot",
      snapshot
    });
  }

  async function resetSessionState() {
    translationAbortRef.current?.abort();
    mockSourceRef.current?.reset();
    beginSubtitleMonitorSession({
      statusDetail: "Standby"
    });
    await stopRealtimeSource(cloudSourceRef.current);
    dispatch({
      type: "SESSION_RESET"
    });
    setPlaybackStatus("idle");
    setIsTranslating(false);
    setIsPreviewTranslating(false);
    setActiveTranslationId(null);
    setBlockedTranslationKey(null);
    setBlockedPreviewTranslationKey(null);
    setTranslationError(null);
    setRealtimeError(null);
    setAudioChunkCount(0);
    setProviderEventCount(0);
    setAudioLevelPercent(0);
    setSummaryStatus("idle");
    setSummaryData(null);
    setSummaryError(null);
    setMonitorErrorMessage(null);
  }

  async function handleModeChange(mode: InputMode) {
    if (mode === inputMode) {
      return;
    }

    await resetSessionState();
    setInputMode(mode);
  }

  async function handleStart() {
    setRealtimeError(null);

    if (inputMode === "mock") {
      mockSourceRef.current?.start((event) => {
        dispatch({
          type: "TRANSCRIPT_RECEIVED",
          event
        });
      });
      setPlaybackStatus("playing");
      return;
    }

    beginSubtitleMonitorSession({
      statusDetail: "Connecting"
    });
    dispatch({
      type: "SESSION_RESET"
    });
    setAudioChunkCount(0);
    setProviderEventCount(0);
    setAudioLevelPercent(0);
    setIsTranslating(false);
    setIsPreviewTranslating(false);
    setActiveTranslationId(null);
    setBlockedTranslationKey(null);
    setBlockedPreviewTranslationKey(null);

    setPlaybackStatus("starting");

    try {
      const source = createCloudAsrSource(resolveCloudAsrInputKind(inputMode));
      cloudSourceRef.current = source;
      let startupInterrupted = false;

      await source.start({
        onInputActivity: (chunk) => {
          setAudioChunkCount((count) => count + 1);
          setAudioLevelPercent(
            Math.max(
              0,
              Math.min(100, Math.round((chunk.rmsLevel ?? 0) * 100))
            )
          );
        },
        onProviderActivity: () => {
          setProviderEventCount((count) => count + 1);
        },
        onEvent: (event) => {
          dispatch({
            type: "TRANSCRIPT_RECEIVED",
            event
          });
        },
        onError: (error) => {
          startupInterrupted = true;
          setRealtimeError(resolveRealtimeErrorMessage(error));
          setPlaybackStatus("paused");
          void stopRealtimeSource(source);
        }
      });

      if (cloudSourceRef.current === source && !startupInterrupted) {
        setPlaybackStatus("playing");
      }
    } catch (error) {
      await stopRealtimeSource(cloudSourceRef.current);
      setRealtimeError(resolveRealtimeErrorMessage(error));
      setPlaybackStatus("idle");
    }
  }

  async function handlePause() {
    if (inputMode === "mock") {
      mockSourceRef.current?.pause();
    } else {
      await stopRealtimeSource(cloudSourceRef.current);
    }

    setPlaybackStatus("paused");
  }

  async function handleReset() {
    await resetSessionState();
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

  const sourceLabel =
    inputMode === "mock"
      ? "Mock Transcript Source"
      : inputMode === "cloud-asr-tab"
        ? "Browser Tab Audio + Cloud ASR"
        : "Browser Mic + Cloud ASR";
  const modeLabel =
    inputMode === "mock"
      ? "Mock Mode"
      : inputMode === "cloud-asr-tab"
        ? "Cloud ASR Tab Audio Mode"
        : "Cloud ASR Mic Mode";
  const statusDetail =
    playbackStatus === "playing"
      ? inputMode === "mock"
        ? "Playing"
        : "Listening"
      : playbackStatus === "starting"
        ? "Connecting"
        : playbackStatus === "paused"
          ? "Paused"
          : "Standby";

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(SUBTITLE_MONITOR_CHANNEL_NAME);
    subtitleMonitorChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;

      if (!isSubtitleMonitorMessage(message)) {
        return;
      }

      if (
        message.type !== "monitor-ready" &&
        message.type !== "request-snapshot"
      ) {
        return;
      }

      const snapshot =
        latestSubtitleMonitorSnapshotRef.current ?? {
          sessionId: subtitleMonitorSessionIdRef.current,
          items: recentWindow,
          isTranslating: isTranslating || isPreviewTranslating,
          modeLabel,
          statusDetail
        };

      latestSubtitleMonitorSnapshotRef.current = snapshot;
      channel.postMessage({
        type: "snapshot",
        snapshot
      });
    };

    return () => {
      channel.close();
      if (subtitleMonitorChannelRef.current === channel) {
        subtitleMonitorChannelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const snapshot: SubtitleMonitorSnapshot = {
      sessionId: subtitleMonitorSessionId,
      items: recentWindow,
      isTranslating: isTranslating || isPreviewTranslating,
      modeLabel,
      statusDetail
    };

    latestSubtitleMonitorSnapshotRef.current = snapshot;
    postSubtitleMonitorMessage({
      type: "snapshot",
      snapshot
    });
  }, [
    isPreviewTranslating,
    isTranslating,
    modeLabel,
    recentWindow,
    subtitleMonitorSessionId,
    statusDetail
  ]);

  return (
    <div className="grid gap-6 px-6 py-6 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
      <div className="flex flex-col gap-6">
        <SourceStatus
          sourceLabel={sourceLabel}
          statusDetail={statusDetail}
          modeLabel={modeLabel}
          errorMessage={realtimeError}
          audioChunkCount={audioChunkCount}
          providerEventCount={providerEventCount}
          audioLevelPercent={audioLevelPercent}
          showTabAudioHandoff={inputMode === "cloud-asr-tab"}
        />
        <ControlBar
          inputMode={inputMode}
          onModeChange={(mode) => {
            void handleModeChange(mode);
          }}
          onStart={() => {
            void handleStart();
          }}
          onPause={() => {
            void handlePause();
          }}
          onReset={() => {
            void handleReset();
          }}
          onGenerateSummary={() => {
            void handleGenerateSummary();
          }}
          onOpenSubtitleMonitor={() => {
            if (typeof window === "undefined") {
              return;
            }

            const monitorWindow = window.open(
              SUBTITLE_MONITOR_WINDOW_PATH,
              "subtitle-monitor",
              "popup=yes,width=520,height=720,resizable=yes,scrollbars=yes"
            );

            if (!monitorWindow) {
              setMonitorErrorMessage("字幕窗被浏览器拦截，请允许弹窗后重试。");
              return;
            }

            setMonitorErrorMessage(null);
            monitorWindow.focus();
            const snapshot =
              latestSubtitleMonitorSnapshotRef.current ?? {
                sessionId: subtitleMonitorSessionIdRef.current,
                items: recentWindow,
                isTranslating: isTranslating || isPreviewTranslating,
                modeLabel,
                statusDetail
              };

            latestSubtitleMonitorSnapshotRef.current = snapshot;
            postSubtitleMonitorMessage({
              type: "snapshot",
              snapshot
            });
          }}
          onRetry={() => {
            void handleStart();
          }}
          canStart={playbackStatus !== "playing" && playbackStatus !== "starting"}
          canPause={playbackStatus === "playing" || playbackStatus === "starting"}
          canRetry={inputMode !== "mock" && realtimeError !== null}
          isSummaryLoading={summaryStatus === "loading"}
          isRealtimeStarting={inputMode !== "mock" && playbackStatus === "starting"}
          monitorErrorMessage={monitorErrorMessage}
        />
        <SubtitleWorkspace
          items={recentWindow}
          isTranslating={isTranslating || isPreviewTranslating}
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

function resolveCloudAsrInputKind(inputMode: InputMode): CloudAsrInputKind {
  return inputMode === "cloud-asr-tab"
    ? "browser-tab-audio"
    : "browser-microphone";
}

function resolveRealtimeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("NEXT_PUBLIC_CLOUD_ASR_ADAPTER_URL")) {
      return "Cloud ASR 模式尚未配置适配层地址，请先设置 NEXT_PUBLIC_CLOUD_ASR_ADAPTER_URL。";
    }

    if (error.message.includes("NEXT_PUBLIC_FUNASR_WEBSOCKET_URL")) {
      return "Cloud ASR 模式尚未配置适配层地址，请先设置 NEXT_PUBLIC_CLOUD_ASR_ADAPTER_URL。";
    }

    return error.message || "真实输入连接失败，请重试。";
  }

  return "真实输入连接失败，请重试。";
}

function createTranslationRequestKey(item: { id: string; text: string }) {
  return `${item.id}:${item.text}`;
}

async function runDraftPreviewTranslation(options: {
  candidate: {
    id: string;
    text: string;
  };
  controller: AbortController;
  onApplied: (item: { id: string; chinese: string }) => void;
  onError: (error: unknown) => void;
  onStart: () => void;
  onFinish: () => void;
}) {
  const { candidate, controller, onApplied, onError, onStart, onFinish } = options;

  onStart();

  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [candidate]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("Translation request failed");
    }

    const result = translationResponseSchema.parse(await response.json());
    result.items.forEach(onApplied);
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    onError(error);
  } finally {
    onFinish();
  }
}
