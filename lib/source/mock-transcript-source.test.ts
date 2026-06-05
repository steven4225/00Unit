import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MockTranscriptSource,
  createMockTranscriptScript
} from "./mock-transcript-source";
import type { TranscriptEvent } from "../schemas/transcript";

describe("MockTranscriptSource", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits scripted transcript events in order when started", () => {
    vi.useFakeTimers();

    const events: TranscriptEvent[] = [];
    const source = new MockTranscriptSource(createMockTranscriptScript(), 50);

    source.start((event) => {
      events.push(event);
    });

    vi.advanceTimersByTime(250);

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.id).toBe("seg-1");
    expect(events[1]?.id).toBe("seg-1");
  });

  it("can pause and reset the playback session", () => {
    vi.useFakeTimers();

    const events: TranscriptEvent[] = [];
    const source = new MockTranscriptSource(createMockTranscriptScript(), 50);

    source.start((event) => {
      events.push(event);
    });

    vi.advanceTimersByTime(120);
    source.pause();
    vi.advanceTimersByTime(500);

    const pausedCount = events.length;

    source.reset();
    source.start((event) => {
      events.push(event);
    });
    vi.advanceTimersByTime(60);

    expect(events.length).toBe(pausedCount + 1);
    expect(events.at(-1)?.id).toBe("seg-1");
  });
});
