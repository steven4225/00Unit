import type { TranscriptEvent } from "../schemas/transcript";

export interface CloudAsrSegmentUpdate {
  continuityKey: string;
  text: string;
  isFinal: boolean;
  startMs: number;
  endMs: number;
  sequence: number;
  revision?: number;
}

interface SegmentState {
  transcriptId: string;
  lastSequence: number;
  lastRevision: number;
  lastText: string;
  lastIsFinal: boolean;
  lastStartMs: number;
  lastEndMs: number;
}

export interface CloudAsrTranscriptNormalizerOptions {
  idPrefix?: string;
}

export type CloudAsrTranscriptNormalizer = (
  update: CloudAsrSegmentUpdate
) => TranscriptEvent[];

export function createCloudAsrTranscriptNormalizer(
  options: CloudAsrTranscriptNormalizerOptions = {}
): CloudAsrTranscriptNormalizer {
  const idPrefix = options.idPrefix ?? "cloud-asr-seg";
  const segmentStates = new Map<string, SegmentState>();
  let nextId = 1;

  return (update) => {
    const text = update.text.trim();
    if (!text) {
      return [];
    }

    const existingState = segmentStates.get(update.continuityKey);
    const revision = update.revision ?? 0;

    if (existingState) {
      const isOlderSequence = update.sequence < existingState.lastSequence;
      const isSameSequenceWithOlderRevision =
        update.sequence === existingState.lastSequence &&
        revision < existingState.lastRevision;

      if (isOlderSequence || isSameSequenceWithOlderRevision) {
        return [];
      }

      const isDuplicate =
        update.sequence === existingState.lastSequence &&
        revision === existingState.lastRevision &&
        text === existingState.lastText &&
        update.isFinal === existingState.lastIsFinal &&
        update.startMs === existingState.lastStartMs &&
        update.endMs === existingState.lastEndMs;

      if (isDuplicate) {
        return [];
      }

      existingState.lastSequence = update.sequence;
      existingState.lastRevision = revision;
      existingState.lastText = text;
      existingState.lastIsFinal = update.isFinal;
      existingState.lastStartMs = update.startMs;
      existingState.lastEndMs = update.endMs;

      return [
        {
          id: existingState.transcriptId,
          text,
          isFinal: update.isFinal,
          startMs: update.startMs,
          endMs: update.endMs,
          source: "cloud-asr"
        }
      ];
    }

    const transcriptId = `${idPrefix}-${nextId++}`;
    segmentStates.set(update.continuityKey, {
      transcriptId,
      lastSequence: update.sequence,
      lastRevision: revision,
      lastText: text,
      lastIsFinal: update.isFinal,
      lastStartMs: update.startMs,
      lastEndMs: update.endMs
    });

    return [
      {
        id: transcriptId,
        text,
        isFinal: update.isFinal,
        startMs: update.startMs,
        endMs: update.endMs,
        source: "cloud-asr"
      }
    ];
  };
}
