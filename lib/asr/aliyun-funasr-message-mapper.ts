import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";

interface AliyunFunAsrHeader {
  task_id?: string;
  event?: string;
  error_code?: string;
  error_message?: string;
  attributes?: Record<string, unknown>;
}

interface AliyunFunAsrWord {
  begin_time?: number;
  end_time?: number;
  text?: string;
  punctuation?: string;
}

interface AliyunFunAsrSentence {
  begin_time?: number;
  end_time?: number;
  text?: string;
  heartbeat?: boolean;
  sentence_end?: boolean;
  sentence_id?: number;
  words?: AliyunFunAsrWord[];
}

export interface AliyunFunAsrServerEvent {
  header?: AliyunFunAsrHeader;
  payload?: {
    output?: {
      sentence?: AliyunFunAsrSentence;
    };
    usage?: {
      duration?: number;
    } | null;
  };
}

export interface AliyunFunAsrMessageMapper {
  map(message: AliyunFunAsrServerEvent): CloudAsrSegmentUpdate[];
}

interface RevisionState {
  nextRevision: number;
}

export function createAliyunFunAsrMessageMapper(): AliyunFunAsrMessageMapper {
  let nextSequence = 1;
  const revisions = new Map<string, RevisionState>();

  const resolveRevision = (continuityKey: string) => {
    const state = revisions.get(continuityKey) ?? {
      nextRevision: 0
    };
    const revision = state.nextRevision;
    state.nextRevision += 1;
    revisions.set(continuityKey, state);
    return revision;
  };

  return {
    map(message) {
      if (message.header?.event !== "result-generated") {
        return [];
      }

      const sentence = message.payload?.output?.sentence;
      const text = sentence?.text?.trim();
      if (!sentence || !text || sentence.heartbeat) {
        return [];
      }

      const taskId = message.header.task_id ?? "active";
      const startMs = sentence.begin_time ?? 0;
      const endMs = sentence.end_time ?? startMs;
      const sentenceIdentity =
        sentence.sentence_id ?? `${startMs}-${endMs}`;
      const continuityKey = `aliyun:${taskId}:sentence:${String(sentenceIdentity)}`;

      return [
        {
          continuityKey,
          text,
          isFinal: sentence.sentence_end === true,
          startMs,
          endMs,
          sequence: nextSequence++,
          revision: resolveRevision(continuityKey)
        }
      ];
    }
  };
}
