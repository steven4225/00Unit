import {
  transcriptEventSchema,
  type TranscriptEvent
} from "../schemas/transcript";
import type {
  TranscriptEventHandler,
  TranscriptSource
} from "./transcript-source";

const mockScript = [
  {
    id: "seg-1",
    text: "Today I want to talk about small language",
    isFinal: false,
    startMs: 0,
    endMs: 1400,
    source: "mock"
  },
  {
    id: "seg-1",
    text: "Today I want to talk about small language models.",
    isFinal: true,
    startMs: 0,
    endMs: 2200,
    source: "mock"
  },
  {
    id: "seg-2",
    text: "The first idea is that smaller systems can still feel fast.",
    isFinal: true,
    startMs: 2200,
    endMs: 4400,
    source: "mock"
  },
  {
    id: "seg-2",
    text: "The first idea is that smaller systems can still feel surprisingly fast.",
    isFinal: true,
    startMs: 2200,
    endMs: 4600,
    source: "mock"
  },
  {
    id: "seg-3",
    text: "We also want the recent subtitle to remain readable after a correction.",
    isFinal: true,
    startMs: 4600,
    endMs: 7200,
    source: "mock"
  },
  {
    id: "seg-3",
    text: "We also want the recent subtitle to remain readable even after a correction.",
    isFinal: true,
    startMs: 4600,
    endMs: 7600,
    source: "mock"
  }
] satisfies TranscriptEvent[];

export function createMockTranscriptScript(): TranscriptEvent[] {
  return mockScript.map((event) => transcriptEventSchema.parse(event));
}

export class MockTranscriptSource implements TranscriptSource {
  private readonly script: TranscriptEvent[];
  private readonly tickMs: number;
  private index = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onEvent: TranscriptEventHandler | null = null;

  constructor(script = createMockTranscriptScript(), tickMs = 800) {
    this.script = script;
    this.tickMs = tickMs;
  }

  start(onEvent: TranscriptEventHandler) {
    this.onEvent = onEvent;

    if (this.timer || this.index >= this.script.length) {
      return;
    }

    this.scheduleNext();
  }

  pause() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  reset() {
    this.pause();
    this.index = 0;
  }

  private scheduleNext() {
    if (!this.onEvent || this.index >= this.script.length) {
      this.timer = null;
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      const nextEvent = this.script[this.index];
      this.index += 1;
      this.onEvent?.(nextEvent);
      this.scheduleNext();
    }, this.tickMs);
  }
}
