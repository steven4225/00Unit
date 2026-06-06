import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";

export interface FunAsrSentencePayload {
  text?: string;
  id?: string | number;
  segment_id?: string | number;
  start_ms?: number;
  end_ms?: number;
  start?: number;
  end?: number;
  begin_time?: number;
  end_time?: number;
  sequence?: number;
  revision?: number;
}

export interface FunAsrServerMessage {
  partial?: string;
  partial_id?: string | number;
  partial_start_ms?: number;
  partial_end_ms?: number;
  sequence?: number;
  revision?: number;
  sentences?: FunAsrSentencePayload[];
}

export interface FunAsrMessageMapper {
  map(message: FunAsrServerMessage): CloudAsrSegmentUpdate[];
}

interface ContinuityFallbackState {
  nextRevision: number;
}

export function createFunAsrMessageMapper(): FunAsrMessageMapper {
  let nextSequence = 1;
  const fallbackState = new Map<string, ContinuityFallbackState>();

  const resolveRevision = (
    continuityKey: string,
    revision?: number
  ): number => {
    if (typeof revision === "number") {
      const state = fallbackState.get(continuityKey) ?? {
        nextRevision: revision + 1
      };
      state.nextRevision = Math.max(state.nextRevision, revision + 1);
      fallbackState.set(continuityKey, state);
      return revision;
    }

    const state = fallbackState.get(continuityKey) ?? {
      nextRevision: 0
    };
    const nextRevision = state.nextRevision;
    state.nextRevision += 1;
    fallbackState.set(continuityKey, state);
    return nextRevision;
  };

  const resolveSequence = (explicit?: number): number => {
    if (typeof explicit === "number") {
      nextSequence = Math.max(nextSequence, explicit + 1);
      return explicit;
    }

    return nextSequence++;
  };

  const resolveStartMs = (sentence: FunAsrSentencePayload): number =>
    sentence.start_ms ??
    sentence.start ??
    sentence.begin_time ??
    0;

  const resolveEndMs = (sentence: FunAsrSentencePayload, startMs: number): number =>
    sentence.end_ms ??
    sentence.end ??
    sentence.end_time ??
    startMs;

  return {
    map(message) {
      const updates: CloudAsrSegmentUpdate[] = [];

      const partialText = message.partial?.trim();
      if (partialText) {
        const continuityKey = `partial:${String(message.partial_id ?? "active")}`;
        updates.push({
          continuityKey,
          text: partialText,
          isFinal: false,
          startMs: message.partial_start_ms ?? 0,
          endMs: message.partial_end_ms ?? message.partial_start_ms ?? 0,
          sequence: resolveSequence(message.sequence),
          revision: resolveRevision(continuityKey, message.revision)
        });
      }

      for (const sentence of message.sentences ?? []) {
        const text = sentence.text?.trim();
        if (!text) {
          continue;
        }

        const startMs = resolveStartMs(sentence);
        const endMs = resolveEndMs(sentence, startMs);
        const continuityBase =
          sentence.segment_id ??
          sentence.id ??
          `${startMs}-${endMs}`;
        const continuityKey = `sentence:${String(continuityBase)}`;

        updates.push({
          continuityKey,
          text,
          isFinal: true,
          startMs,
          endMs,
          sequence: resolveSequence(sentence.sequence ?? message.sequence),
          revision: resolveRevision(
            continuityKey,
            sentence.revision ?? message.revision
          )
        });
      }

      return updates;
    }
  };
}
