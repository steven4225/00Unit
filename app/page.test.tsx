import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkbenchClient } from "../components/workbench-client";
import HomePage from "./page";

const SEGMENT_ONE_FINAL = "Today I want to talk about small language models.";
const SEGMENT_TWO_CORRECTED =
  "The first idea is that smaller systems can still feel surprisingly fast.";
const SEGMENT_THREE_CORRECTED =
  "We also want the recent subtitle to remain readable even after a correction.";

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    resolve,
    reject
  };
}

function getButtons() {
  return {
    startButton: screen.getByRole("button", {
      name: /开始模拟|开始实时输入|共享标签页音频|连接中\.\.\./
    }),
    pauseButton: screen.getByRole("button", { name: "暂停" }),
    resetButton: screen.getByRole("button", { name: "重置" }),
    summaryButton: screen.getByRole("button", { name: /生成总结|生成中\.\.\./ })
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

class FakeCloudAsrSource {
  callbacks:
    | {
        onEvent: (event: {
          id: string;
          text: string;
          isFinal: boolean;
          startMs: number;
          endMs: number;
          source: "cloud-asr";
        }) => void;
        onError?: (error: unknown) => void;
      }
    | undefined;

  readonly start = vi.fn(async (callbacks) => {
    this.callbacks = callbacks;
  });

  readonly stop = vi.fn(async () => {});

  emit(event: {
    id: string;
    text: string;
    isFinal: boolean;
    startMs: number;
    endMs: number;
    source: "cloud-asr";
  }) {
    this.callbacks?.onEvent(event);
  }
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the phase-2 workbench shell areas", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "AI 英文演讲实时字幕翻译助手"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "输入源状态" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始模拟" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cloud ASR (Mic)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cloud ASR (Tab Audio)" })).toBeInTheDocument();
    expect(screen.getByText("主字幕区")).toBeInTheDocument();
    expect(screen.getByText("会后总结")).toBeInTheDocument();
  });

  it("plays mock transcript events and keeps interim updates display-only", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/translate")) {
        const body = JSON.parse(String(init?.body ?? "{}"));

        return createJsonResponse({
          items: body.items.map((item: { id: string; text: string }) => ({
            id: item.id,
            chinese: `ZH:${item.text}`
          }))
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<WorkbenchClient />);

    fireEvent.click(screen.getByRole("button", { name: "开始模拟" }));

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(
      screen.getByText("Today I want to talk about small language")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(4000);
      await flushAsyncWork();
    });

    expect(screen.getByText(`ZH:${SEGMENT_THREE_CORRECTED}`)).toBeInTheDocument();
    expect(screen.getByText(`ZH:${SEGMENT_TWO_CORRECTED}`)).toBeInTheDocument();
    expect(
      screen.queryByText(`ZH:${SEGMENT_ONE_FINAL}`)
    ).not.toBeInTheDocument();
  });

  it("switches into cloud asr mode and displays the current input mode", async () => {
    const cloudSource = new FakeCloudAsrSource();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/translate")) {
        const body = JSON.parse(String(init?.body ?? "{}"));

        return createJsonResponse({
          items: body.items.map((item: { id: string; text: string }) => ({
            id: item.id,
            chinese: `ZH:${item.text}`
          }))
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<WorkbenchClient createCloudAsrSource={() => cloudSource} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cloud ASR (Mic)" }));
      await flushAsyncWork();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始实时输入" }));
      await flushAsyncWork();
    });

    expect(screen.getByText("Cloud ASR Mic Mode")).toBeInTheDocument();
    expect(cloudSource.start).toHaveBeenCalledTimes(1);

    act(() => {
      cloudSource.emit({
        id: "cloud-seg-1",
        text: "real partial phrase",
        isFinal: false,
        startMs: 0,
        endMs: 400,
        source: "cloud-asr"
      });
    });

    expect(screen.getByText("real partial phrase")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      cloudSource.emit({
        id: "cloud-seg-1",
        text: "real final phrase",
        isFinal: true,
        startMs: 0,
        endMs: 900,
        source: "cloud-asr"
      });
      await flushAsyncWork();
    });

    expect(screen.getByText("ZH:real final phrase")).toBeInTheDocument();
  });

  it("creates a tab-audio cloud asr source when tab audio mode starts", async () => {
    const cloudSource = new FakeCloudAsrSource();
    const createCloudAsrSource = vi.fn(() => cloudSource);

    render(<WorkbenchClient createCloudAsrSource={createCloudAsrSource} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cloud ASR (Tab Audio)" }));
      await flushAsyncWork();
    });

    expect(
      screen.getByLabelText("Tab audio verification handoff")
    ).toBeInTheDocument();
    expect(screen.getByText("标签页音频验收提示")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(getButtons().startButton);
      await flushAsyncWork();
    });

    expect(screen.getByText("Cloud ASR Tab Audio Mode")).toBeInTheDocument();
    expect(createCloudAsrSource).toHaveBeenCalledWith("browser-tab-audio");
    expect(cloudSource.start).toHaveBeenCalledTimes(1);
  });

  it("keeps translation and summary wired for tab-audio transcript events", async () => {
    const cloudSource = new FakeCloudAsrSource();
    const createCloudAsrSource = vi.fn(() => cloudSource);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (url.endsWith("/api/translate")) {
        return createJsonResponse({
          items: body.items.map((item: { id: string; text: string }) => ({
            id: item.id,
            chinese: `ZH:${item.text}`
          }))
        });
      }

      if (url.endsWith("/api/summarize")) {
        expect(body.fullText).toContain("tab audio final phrase");

        return createJsonResponse({
          summary: "Tab audio summary",
          keywords: ["tab audio", "cloud asr"],
          uncertainTerms: ["shared audio"]
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<WorkbenchClient createCloudAsrSource={createCloudAsrSource} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cloud ASR (Tab Audio)" }));
      await flushAsyncWork();
    });

    await act(async () => {
      fireEvent.click(getButtons().startButton);
      await flushAsyncWork();
    });

    await act(async () => {
      cloudSource.emit({
        id: "tab-audio-seg-1",
        text: "tab audio final phrase",
        isFinal: true,
        startMs: 0,
        endMs: 1200,
        source: "cloud-asr"
      });
      await flushAsyncWork();
    });

    expect(screen.getByText("ZH:tab audio final phrase")).toBeInTheDocument();

    fireEvent.click(getButtons().summaryButton);

    await act(async () => {
      await flushAsyncWork();
    });

    expect(screen.getByText("Tab audio summary")).toBeInTheDocument();
    expect(screen.getByText("tab audio")).toBeInTheDocument();
    expect(screen.getByText("shared audio")).toBeInTheDocument();
    expect(createCloudAsrSource).toHaveBeenCalledWith("browser-tab-audio");
  });

  it("serializes final-segment translation requests instead of interrupting the in-flight one", async () => {
    const cloudSource = new FakeCloudAsrSource();
    const firstTranslation = createDeferred<Response>();
    const secondTranslation = createDeferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (!url.endsWith("/api/translate")) {
        throw new Error(`Unexpected request: ${url}`);
      }

      if (body.items[0]?.id === "cloud-seg-1") {
        return firstTranslation.promise;
      }

      if (body.items[0]?.id === "cloud-seg-2") {
        return secondTranslation.promise;
      }

      throw new Error(`Unexpected translation payload: ${JSON.stringify(body)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<WorkbenchClient createCloudAsrSource={() => cloudSource} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cloud ASR (Mic)" }));
      await flushAsyncWork();
    });

    await act(async () => {
      fireEvent.click(getButtons().startButton);
      await flushAsyncWork();
    });

    await act(async () => {
      cloudSource.emit({
        id: "cloud-seg-1",
        text: "first final phrase",
        isFinal: true,
        startMs: 0,
        endMs: 700,
        source: "cloud-asr"
      });
      await flushAsyncWork();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      cloudSource.emit({
        id: "cloud-seg-2",
        text: "second final phrase",
        isFinal: true,
        startMs: 800,
        endMs: 1400,
        source: "cloud-asr"
      });
      await flushAsyncWork();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstTranslation.resolve(
        createJsonResponse({
          items: [
            {
              id: "cloud-seg-1",
              chinese: "ZH:first final phrase"
            }
          ]
        })
      );
      await flushAsyncWork();
    });

    expect(screen.getByText("ZH:first final phrase")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondTranslation.resolve(
        createJsonResponse({
          items: [
            {
              id: "cloud-seg-2",
              chinese: "ZH:second final phrase"
            }
          ]
        })
      );
      await flushAsyncWork();
    });

    expect(screen.getByText("ZH:second final phrase")).toBeInTheDocument();
  });

  it("shows preview chinese for a stable draft before final translation overwrites it", async () => {
    const cloudSource = new FakeCloudAsrSource();
    const draftTranslation = createDeferred<Response>();
    const finalTranslation = createDeferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (!url.endsWith("/api/translate")) {
        throw new Error(`Unexpected request: ${url}`);
      }

      if (body.items[0]?.text === "Example two." && fetchMock.mock.calls.length === 1) {
        return draftTranslation.promise;
      }

      if (body.items[0]?.text === "Example two.") {
        return finalTranslation.promise;
      }

      throw new Error(`Unexpected translation payload: ${JSON.stringify(body)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<WorkbenchClient createCloudAsrSource={() => cloudSource} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cloud ASR (Mic)" }));
      await flushAsyncWork();
    });

    await act(async () => {
      fireEvent.click(getButtons().startButton);
      await flushAsyncWork();
    });

    await act(async () => {
      cloudSource.emit({
        id: "cloud-seg-preview",
        text: "Example two.",
        isFinal: false,
        startMs: 0,
        endMs: 900,
        source: "cloud-asr"
      });
      await flushAsyncWork();
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(800);
      await flushAsyncWork();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      draftTranslation.resolve(
        createJsonResponse({
          items: [
            {
              id: "cloud-seg-preview",
              chinese: "PREVIEW: 示例二。"
            }
          ]
        })
      );
      await flushAsyncWork();
    });

    expect(screen.getByText("PREVIEW: 示例二。")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Preview CN")).toBeInTheDocument();

    await act(async () => {
      cloudSource.emit({
        id: "cloud-seg-preview",
        text: "Example two.",
        isFinal: true,
        startMs: 0,
        endMs: 1200,
        source: "cloud-asr"
      });
      await flushAsyncWork();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      finalTranslation.resolve(
        createJsonResponse({
          items: [
            {
              id: "cloud-seg-preview",
              chinese: "FINAL: 示例二。"
            }
          ]
        })
      );
      await flushAsyncWork();
    });

    expect(screen.getByText("FINAL: 示例二。")).toBeInTheDocument();
    expect(screen.getByText("Final CN")).toBeInTheDocument();
  });

  it("re-runs preview translation when the active draft text grows", async () => {
    const cloudSource = new FakeCloudAsrSource();
    const firstPreview = createDeferred<Response>();
    const secondPreview = createDeferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (!url.endsWith("/api/translate")) {
        throw new Error(`Unexpected request: ${url}`);
      }

      if (body.items[0]?.text === "Example two.") {
        return firstPreview.promise;
      }

      if (body.items[0]?.text === "Example two. More detail.") {
        return secondPreview.promise;
      }

      throw new Error(`Unexpected translation payload: ${JSON.stringify(body)}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<WorkbenchClient createCloudAsrSource={() => cloudSource} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cloud ASR (Mic)" }));
      await flushAsyncWork();
    });

    await act(async () => {
      fireEvent.click(getButtons().startButton);
      await flushAsyncWork();
    });

    await act(async () => {
      cloudSource.emit({
        id: "cloud-seg-growing",
        text: "Example two.",
        isFinal: false,
        startMs: 0,
        endMs: 900,
        source: "cloud-asr"
      });
      await flushAsyncWork();
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
      await flushAsyncWork();
    });

    await act(async () => {
      firstPreview.resolve(
        createJsonResponse({
          items: [
            {
              id: "cloud-seg-growing",
              chinese: "PREVIEW: 示例二。"
            }
          ]
        })
      );
      await flushAsyncWork();
    });

    expect(screen.getByText("PREVIEW: 示例二。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Preview CN")).toBeInTheDocument();

    await act(async () => {
      cloudSource.emit({
        id: "cloud-seg-growing",
        text: "Example two. More detail.",
        isFinal: false,
        startMs: 0,
        endMs: 1400,
        source: "cloud-asr"
      });
      await flushAsyncWork();
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
      await flushAsyncWork();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondPreview.resolve(
        createJsonResponse({
          items: [
            {
              id: "cloud-seg-growing",
              chinese: "PREVIEW: 示例二，补充内容。"
            }
          ]
        })
      );
      await flushAsyncWork();
    });

    expect(screen.getByText("PREVIEW: 示例二，补充内容。")).toBeInTheDocument();
  });

  it("surfaces cloud asr startup failures and offers a retry path", async () => {
    const failingFactory = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Missing NEXT_PUBLIC_CLOUD_ASR_ADAPTER_URL");
      })
      .mockImplementation(() => new FakeCloudAsrSource());

    render(<WorkbenchClient createCloudAsrSource={failingFactory} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cloud ASR (Mic)" }));
      await flushAsyncWork();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始实时输入" }));
      await flushAsyncWork();
    });

    expect(
      screen.getByText(
        "Cloud ASR 模式尚未配置适配层地址，请先设置 NEXT_PUBLIC_CLOUD_ASR_ADAPTER_URL。"
      )
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重试连接" }));
      await flushAsyncWork();
    });

    expect(failingFactory).toHaveBeenCalledTimes(2);
  });

  it("keeps the session paused when startup is interrupted by an async runtime error", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/translate")) {
        const body = JSON.parse(String(init?.body ?? "{}"));

        return createJsonResponse({
          items: body.items.map((item: { id: string; text: string }) => ({
            id: item.id,
            chinese: `ZH:${item.text}`
          }))
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const interruptedSource = {
      stop: vi.fn(async () => {}),
      start: vi.fn(async (callbacks: { onError?: (error: unknown) => void }) => {
        callbacks.onError?.(new Error("Adapter handshake failed"));
      })
    };

    render(<WorkbenchClient createCloudAsrSource={() => interruptedSource} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cloud ASR (Mic)" }));
      await flushAsyncWork();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始实时输入" }));
      await flushAsyncWork();
    });

    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Adapter handshake failed")).toBeInTheDocument();
    expect(interruptedSource.stop).toHaveBeenCalledTimes(1);
  });

  it("generates a manual summary from the full retained transcript history", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (url.endsWith("/api/translate")) {
        return createJsonResponse({
          items: body.items.map((item: { id: string; text: string }) => ({
            id: item.id,
            chinese: `ZH:${item.text}`
          }))
        });
      }

      if (url.endsWith("/api/summarize")) {
        expect(body.fullText).toContain(SEGMENT_ONE_FINAL);
        expect(body.fullText).toContain(SEGMENT_TWO_CORRECTED);
        expect(body.fullText).toContain(SEGMENT_THREE_CORRECTED);

        return createJsonResponse({
          summary: "Summary result",
          keywords: ["small models", "correction"],
          uncertainTerms: ["retrieval"]
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<WorkbenchClient />);

    const { startButton, summaryButton } = getButtons();

    fireEvent.click(startButton);

    await act(async () => {
      vi.advanceTimersByTime(6000);
      await flushAsyncWork();
    });

    fireEvent.click(summaryButton);
    await act(async () => {
      await flushAsyncWork();
    });

    expect(screen.getByText("Summary result")).toBeInTheDocument();
    expect(screen.getByText("small models")).toBeInTheDocument();
    expect(screen.getByText("retrieval")).toBeInTheDocument();
  });
});
