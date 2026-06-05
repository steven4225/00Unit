import type { TranscriptEvent } from "../schemas/transcript";

export type TranscriptEventHandler = (event: TranscriptEvent) => void;

export interface TranscriptSource {
  start(onEvent: TranscriptEventHandler): void;
  pause(): void;
  reset(): void;
}
