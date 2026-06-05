import type { TranscriptEvent, SubtitleItem } from "../schemas/transcript";

export type SubtitleSessionAction =
  | {
      type: "TRANSCRIPT_RECEIVED";
      event: TranscriptEvent;
    }
  | {
      type: "TRANSLATION_APPLIED";
      id: string;
      chinese: string;
    }
  | {
      type: "SESSION_RESET";
    };

export type SubtitleSessionState = {
  itemsById: Record<string, SubtitleItem>;
  orderedSegmentIds: string[];
  pendingTranslationIds: string[];
};

export function createInitialSubtitleSessionState(): SubtitleSessionState {
  return {
    itemsById: {},
    orderedSegmentIds: [],
    pendingTranslationIds: []
  };
}

export function subtitleSessionReducer(
  state: SubtitleSessionState,
  action: SubtitleSessionAction
): SubtitleSessionState {
  switch (action.type) {
    case "TRANSCRIPT_RECEIVED":
      return applyTranscriptEvent(state, action.event);
    case "TRANSLATION_APPLIED":
      return applyTranslation(state, action.id, action.chinese);
    case "SESSION_RESET":
      return createInitialSubtitleSessionState();
    default:
      return state;
  }
}

function applyTranscriptEvent(
  state: SubtitleSessionState,
  event: TranscriptEvent
): SubtitleSessionState {
  const existingItem = state.itemsById[event.id];
  const englishChanged = existingItem?.english !== event.text;
  const nextStatus = resolveStatus(existingItem, event, englishChanged);

  const nextItem: SubtitleItem = {
    id: event.id,
    english: event.text,
    chinese: existingItem?.chinese ?? "",
    status: nextStatus,
    startMs: event.startMs,
    endMs: event.endMs
  };

  return {
    itemsById: {
      ...state.itemsById,
      [event.id]: nextItem
    },
    orderedSegmentIds: ensureSegmentOrder(state.orderedSegmentIds, event.id),
    pendingTranslationIds: event.isFinal
      ? queuePendingTranslation(state.pendingTranslationIds, event.id)
      : state.pendingTranslationIds
  };
}

function applyTranslation(
  state: SubtitleSessionState,
  id: string,
  chinese: string
): SubtitleSessionState {
  const existingItem = state.itemsById[id];

  if (!existingItem) {
    return state;
  }

  return {
    ...state,
    itemsById: {
      ...state.itemsById,
      [id]: {
        ...existingItem,
        chinese
      }
    },
    pendingTranslationIds: state.pendingTranslationIds.filter(
      (pendingId) => pendingId !== id
    )
  };
}

function resolveStatus(
  existingItem: SubtitleItem | undefined,
  event: TranscriptEvent,
  englishChanged: boolean
): SubtitleItem["status"] {
  if (!event.isFinal) {
    return "draft";
  }

  if (
    existingItem &&
    (existingItem.status === "final" || existingItem.status === "corrected") &&
    englishChanged
  ) {
    return "corrected";
  }

  return "final";
}

function ensureSegmentOrder(orderedIds: string[], id: string) {
  return orderedIds.includes(id) ? orderedIds : [...orderedIds, id];
}

function queuePendingTranslation(pendingIds: string[], id: string) {
  const deduped = pendingIds.filter((pendingId) => pendingId !== id);
  return [...deduped, id].slice(-2);
}
