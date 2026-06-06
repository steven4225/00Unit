import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const SEGMENT_ONE_FINAL = "Today I want to talk about small language models.";
const SEGMENT_TWO_FINAL =
  "The first idea is that smaller systems can still feel fast.";
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

function getControlButtons() {
  const [startButton, pauseButton, resetButton, summaryButton] =
    screen.getAllByRole("button");

  return {
    startButton,
    pauseButton,
    resetButton,
    summaryButton
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the phase-1 workbench shell areas", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4);
    expect(screen.getAllByRole("button")).toHaveLength(4);
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

    render(<HomePage />);

    fireEvent.click(getControlButtons().startButton);

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByText("Today I want to talk about small language")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(4000);
      await flushAsyncWork();
    });

    expect(screen.getByText(`ZH:${SEGMENT_THREE_CORRECTED}`)).toBeInTheDocument();
    expect(screen.getByText(`ZH:${SEGMENT_TWO_CORRECTED}`)).toBeInTheDocument();
    expect(screen.queryByText(`ZH:${SEGMENT_ONE_FINAL}`)).not.toBeInTheDocument();
  });

  it("ignores stale translation results after a newer correction arrives", async () => {
    let resolveStaleRequest: ((value: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (!url.endsWith("/api/translate")) {
        throw new Error(`Unexpected request: ${url}`);
      }

      const body = JSON.parse(String(init?.body ?? "{}"));
      const firstItem = body.items[0] as { id: string; text: string };

      if (firstItem.text === SEGMENT_TWO_FINAL) {
        return new Promise<Response>((resolve) => {
          resolveStaleRequest = resolve;
        });
      }

      return Promise.resolve(
        createJsonResponse({
          items: body.items.map((item: { id: string; text: string }) => ({
            id: item.id,
            chinese: `ZH:${item.text}`
          }))
        })
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage />);

    fireEvent.click(getControlButtons().startButton);

    await act(async () => {
      vi.advanceTimersByTime(3200);
      await flushAsyncWork();
    });

    expect(fetchMock).toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(800);
      await flushAsyncWork();
    });

    expect(screen.getByText(`ZH:${SEGMENT_TWO_CORRECTED}`)).toBeInTheDocument();
    await act(async () => {
      resolveStaleRequest?.(
        createJsonResponse({
          items: [
            {
              id: "seg-2",
              chinese: "ZH:STALE"
            }
          ]
        })
      );
      await flushAsyncWork();
    });

    expect(screen.getByText(`ZH:${SEGMENT_TWO_CORRECTED}`)).toBeInTheDocument();
    expect(screen.queryByText("ZH:STALE")).not.toBeInTheDocument();
  });

  it("pauses playback and resets the session state", async () => {
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

    render(<HomePage />);

    const { startButton, pauseButton, resetButton } = getControlButtons();

    fireEvent.click(startButton);

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByText("Today I want to talk about small language")).toBeInTheDocument();

    fireEvent.click(pauseButton);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText(SEGMENT_TWO_FINAL)).not.toBeInTheDocument();

    fireEvent.click(resetButton);

    expect(
      screen.queryByText("Today I want to talk about small language")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(`ZH:${SEGMENT_ONE_FINAL}`)).not.toBeInTheDocument();
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

    render(<HomePage />);

    const { startButton, summaryButton } = getControlButtons();

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
