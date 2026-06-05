import type { SubtitleItem } from "../schemas/transcript";
import type { SubtitleSessionState } from "./reducer";

export function selectRecentSubtitleWindow(
  state: SubtitleSessionState
): SubtitleItem[] {
  return state.orderedSegmentIds
    .slice(-2)
    .map((id) => state.itemsById[id])
    .filter(Boolean);
}

export function selectSegmentsPendingTranslation(
  state: SubtitleSessionState
): string[] {
  return state.pendingTranslationIds;
}
