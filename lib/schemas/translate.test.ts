import { describe, expect, it } from "vitest";
import {
  translationRequestSchema,
  translationResponseSchema
} from "./translate";

describe("translation schemas", () => {
  it("accepts a translation request with one changed segment", () => {
    const parsed = translationRequestSchema.parse({
      items: [
        {
          id: "seg-1",
          text: "Today we will look at small language models.",
          previousText: "Today we will look at small language"
        }
      ]
    });

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.id).toBe("seg-1");
  });

  it("rejects requests with more than two segments", () => {
    expect(() =>
      translationRequestSchema.parse({
        items: [
          { id: "seg-1", text: "One" },
          { id: "seg-2", text: "Two" },
          { id: "seg-3", text: "Three" }
        ]
      })
    ).toThrow();
  });

  it("accepts structured translation responses keyed by id", () => {
    const parsed = translationResponseSchema.parse({
      items: [
        {
          id: "seg-1",
          chinese: "今天我们会看看小型语言模型。"
        }
      ]
    });

    expect(parsed.items[0]?.chinese).toContain("语言模型");
  });
});
