import { describe, expect, it } from "vitest";
import { createFunAsrMessageMapper } from "./funasr-message-mapper";

describe("createFunAsrMessageMapper", () => {
  it("maps partial output into a non-final segment update", () => {
    const mapper = createFunAsrMessageMapper();

    const updates = mapper.map({
      partial: "small language",
      partial_id: "live-1",
      partial_start_ms: 0,
      partial_end_ms: 600,
      sequence: 1
    });

    expect(updates).toEqual([
      expect.objectContaining({
        continuityKey: "partial:live-1",
        text: "small language",
        isFinal: false,
        startMs: 0,
        endMs: 600,
        sequence: 1
      })
    ]);
  });

  it("maps finalized sentence output into final segment updates", () => {
    const mapper = createFunAsrMessageMapper();

    const updates = mapper.map({
      sentences: [
        {
          segment_id: "s-1",
          text: "small language models",
          start_ms: 0,
          end_ms: 1200,
          revision: 4
        }
      ]
    });

    expect(updates).toEqual([
      expect.objectContaining({
        continuityKey: "sentence:s-1",
        text: "small language models",
        isFinal: true,
        startMs: 0,
        endMs: 1200,
        revision: 4
      })
    ]);
  });

  it("assigns fallback continuity keys and sequences when provider fields are sparse", () => {
    const mapper = createFunAsrMessageMapper();

    const first = mapper.map({
      sentences: [
        {
          text: "first finalized sentence",
          start: 100,
          end: 900
        }
      ]
    });
    const second = mapper.map({
      sentences: [
        {
          text: "second finalized sentence",
          begin_time: 1000,
          end_time: 1800
        }
      ]
    });

    expect(first[0]).toMatchObject({
      continuityKey: "sentence:100-900",
      sequence: 1
    });
    expect(second[0]).toMatchObject({
      continuityKey: "sentence:1000-1800",
      sequence: 2
    });
  });

  it("ignores empty sentence text", () => {
    const mapper = createFunAsrMessageMapper();

    const updates = mapper.map({
      sentences: [
        {
          segment_id: "s-2",
          text: "   ",
          start_ms: 0,
          end_ms: 200
        }
      ]
    });

    expect(updates).toEqual([]);
  });
});
