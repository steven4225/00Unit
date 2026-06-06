import { describe, expect, it } from "vitest";
import {
  createCloudAsrTranscriptNormalizer,
  type CloudAsrSegmentUpdate
} from "./cloud-asr-transcript-normalizer";

const createUpdate = (
  overrides: Partial<CloudAsrSegmentUpdate> = {}
): CloudAsrSegmentUpdate => ({
  continuityKey: "provider-seg-1",
  text: "hello world",
  isFinal: false,
  startMs: 0,
  endMs: 800,
  sequence: 1,
  revision: 0,
  ...overrides
});

describe("createCloudAsrTranscriptNormalizer", () => {
  it("keeps a stable transcript id across partial and final updates", () => {
    const normalize = createCloudAsrTranscriptNormalizer();

    const partial = normalize(createUpdate());
    const final = normalize(
      createUpdate({
        text: "hello world today",
        isFinal: true,
        sequence: 2,
        revision: 1
      })
    );

    expect(partial).toHaveLength(1);
    expect(final).toHaveLength(1);
    expect(final[0]?.id).toBe(partial[0]?.id);
    expect(final[0]).toMatchObject({
      text: "hello world today",
      isFinal: true,
      source: "cloud-asr"
    });
  });

  it("emits correction-capable updates with the same transcript id", () => {
    const normalize = createCloudAsrTranscriptNormalizer();

    const firstFinal = normalize(
      createUpdate({
        isFinal: true,
        sequence: 2,
        revision: 1,
        text: "small language model"
      })
    );
    const correctedFinal = normalize(
      createUpdate({
        isFinal: true,
        sequence: 3,
        revision: 2,
        text: "small language models"
      })
    );

    expect(correctedFinal).toHaveLength(1);
    expect(correctedFinal[0]?.id).toBe(firstFinal[0]?.id);
    expect(correctedFinal[0]?.text).toBe("small language models");
  });

  it("drops duplicate jitter updates", () => {
    const normalize = createCloudAsrTranscriptNormalizer();

    const first = normalize(createUpdate());
    const duplicate = normalize(createUpdate());

    expect(first).toHaveLength(1);
    expect(duplicate).toEqual([]);
  });

  it("rejects stale or out-of-order updates", () => {
    const normalize = createCloudAsrTranscriptNormalizer();

    normalize(
      createUpdate({
        text: "current partial",
        sequence: 5,
        revision: 2
      })
    );

    const stale = normalize(
      createUpdate({
        text: "older partial",
        sequence: 4,
        revision: 1
      })
    );

    expect(stale).toEqual([]);
  });

  it("assigns distinct transcript ids to distinct continuity keys", () => {
    const normalize = createCloudAsrTranscriptNormalizer();

    const first = normalize(
      createUpdate({
        continuityKey: "provider-seg-1"
      })
    );
    const second = normalize(
      createUpdate({
        continuityKey: "provider-seg-2",
        text: "second segment",
        startMs: 900,
        endMs: 1600,
        sequence: 1
      })
    );

    expect(first[0]?.id).not.toBe(second[0]?.id);
  });

  it("ignores empty text updates before they reach the workbench", () => {
    const normalize = createCloudAsrTranscriptNormalizer();

    const ignored = normalize(
      createUpdate({
        text: "   "
      })
    );

    expect(ignored).toEqual([]);
  });
});
