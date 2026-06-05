import { describe, expect, it } from "vitest";
import {
  subtitleItemSchema,
  transcriptEventSchema
} from "./transcript";

describe("transcript schemas", () => {
  it("accepts a valid transcript event", () => {
    const parsed = transcriptEventSchema.parse({
      id: "seg-1",
      text: "Today we will look at small language models.",
      isFinal: true,
      startMs: 0,
      endMs: 2300,
      source: "mock"
    });

    expect(parsed.id).toBe("seg-1");
    expect(parsed.source).toBe("mock");
  });

  it("rejects an unknown transcript source", () => {
    expect(() =>
      transcriptEventSchema.parse({
        id: "seg-1",
        text: "Invalid source",
        isFinal: false,
        startMs: 0,
        endMs: 500,
        source: "browser"
      })
    ).toThrow();
  });

  it("accepts a corrected subtitle item", () => {
    const parsed = subtitleItemSchema.parse({
      id: "seg-2",
      english: "The model corrected the previous phrase.",
      chinese: "模型修正了上一句的表达。",
      status: "corrected",
      startMs: 2300,
      endMs: 4600
    });

    expect(parsed.status).toBe("corrected");
  });
});
