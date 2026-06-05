import { describe, expect, it } from "vitest";
import type { TranscriptEvent } from "../schemas/transcript";
import {
  createInitialSubtitleSessionState,
  subtitleSessionReducer
} from "./reducer";
import {
  selectRecentSubtitleWindow,
  selectSegmentsPendingTranslation
} from "./selectors";

function buildEvent(
  overrides: Partial<TranscriptEvent> & Pick<TranscriptEvent, "id" | "text">
): TranscriptEvent {
  return {
    id: overrides.id,
    text: overrides.text,
    isFinal: overrides.isFinal ?? false,
    startMs: overrides.startMs ?? 0,
    endMs: overrides.endMs ?? 1000,
    source: overrides.source ?? "mock"
  };
}

describe("subtitleSessionReducer", () => {
  it("creates a draft subtitle item for a new interim event", () => {
    const state = subtitleSessionReducer(createInitialSubtitleSessionState(), {
      type: "TRANSCRIPT_RECEIVED",
      event: buildEvent({
        id: "seg-1",
        text: "Today I want to talk about small language",
        isFinal: false
      })
    });

    expect(state.itemsById["seg-1"]).toMatchObject({
      id: "seg-1",
      english: "Today I want to talk about small language",
      status: "draft"
    });
    expect(selectSegmentsPendingTranslation(state)).toEqual([]);
  });

  it("marks a segment final and queues it for translation", () => {
    const draftState = subtitleSessionReducer(
      createInitialSubtitleSessionState(),
      {
        type: "TRANSCRIPT_RECEIVED",
        event: buildEvent({
          id: "seg-1",
          text: "Today I want to talk about small language",
          isFinal: false
        })
      }
    );

    const finalState = subtitleSessionReducer(draftState, {
      type: "TRANSCRIPT_RECEIVED",
      event: buildEvent({
        id: "seg-1",
        text: "Today I want to talk about small language models.",
        isFinal: true,
        endMs: 2200
      })
    });

    expect(finalState.itemsById["seg-1"]).toMatchObject({
      status: "final",
      english: "Today I want to talk about small language models."
    });
    expect(selectSegmentsPendingTranslation(finalState)).toEqual(["seg-1"]);
  });

  it("marks a segment corrected when final text changes after finalization", () => {
    const finalState = subtitleSessionReducer(
      createInitialSubtitleSessionState(),
      {
        type: "TRANSCRIPT_RECEIVED",
        event: buildEvent({
          id: "seg-2",
          text: "The first idea is that smaller systems can still feel fast.",
          isFinal: true,
          startMs: 2200,
          endMs: 4400
        })
      }
    );

    const correctedState = subtitleSessionReducer(finalState, {
      type: "TRANSCRIPT_RECEIVED",
      event: buildEvent({
        id: "seg-2",
        text: "The first idea is that smaller systems can still feel surprisingly fast.",
        isFinal: true,
        startMs: 2200,
        endMs: 4600
      })
    });

    expect(correctedState.itemsById["seg-2"]).toMatchObject({
      status: "corrected",
      english:
        "The first idea is that smaller systems can still feel surprisingly fast."
    });
    expect(selectSegmentsPendingTranslation(correctedState)).toEqual(["seg-2"]);
  });

  it("keeps only the most recent two segments in the visible rolling window", () => {
    const events = [
      buildEvent({ id: "seg-1", text: "Segment one", isFinal: true }),
      buildEvent({ id: "seg-2", text: "Segment two", isFinal: true }),
      buildEvent({ id: "seg-3", text: "Segment three", isFinal: true })
    ];

    const state = events.reduce(
      (currentState, event) =>
        subtitleSessionReducer(currentState, {
          type: "TRANSCRIPT_RECEIVED",
          event
        }),
      createInitialSubtitleSessionState()
    );

    expect(selectRecentSubtitleWindow(state).map((item) => item.id)).toEqual([
      "seg-2",
      "seg-3"
    ]);
  });

  it("applies translated text and clears that segment from the pending queue", () => {
    const state = subtitleSessionReducer(createInitialSubtitleSessionState(), {
      type: "TRANSCRIPT_RECEIVED",
      event: buildEvent({
        id: "seg-3",
        text: "We also want the recent subtitle to remain readable.",
        isFinal: true
      })
    });

    const translatedState = subtitleSessionReducer(state, {
      type: "TRANSLATION_APPLIED",
      id: "seg-3",
      chinese: "我们也希望最近一句字幕保持可读。"
    });

    expect(translatedState.itemsById["seg-3"]?.chinese).toBe(
      "我们也希望最近一句字幕保持可读。"
    );
    expect(selectSegmentsPendingTranslation(translatedState)).toEqual([]);
  });

  it("resets the subtitle session state", () => {
    const populatedState = subtitleSessionReducer(
      createInitialSubtitleSessionState(),
      {
        type: "TRANSCRIPT_RECEIVED",
        event: buildEvent({
          id: "seg-4",
          text: "Reset me.",
          isFinal: true
        })
      }
    );

    const resetState = subtitleSessionReducer(populatedState, {
      type: "SESSION_RESET"
    });

    expect(resetState).toEqual(createInitialSubtitleSessionState());
  });
});
