import { describe, expect, it } from "vitest";
import {
  summaryRequestSchema,
  summaryResponseSchema
} from "./summarize";

describe("summary schemas", () => {
  it("accepts a valid summary request with full transcript text", () => {
    const parsed = summaryRequestSchema.parse({
      fullText:
        "Today I want to talk about small language models and why they matter in real products."
    });

    expect(parsed.fullText).toContain("small language models");
  });

  it("rejects an empty summary request", () => {
    expect(() =>
      summaryRequestSchema.parse({
        fullText: ""
      })
    ).toThrow();
  });

  it("accepts structured summary output", () => {
    const parsed = summaryResponseSchema.parse({
      summary: "这段内容讨论了小型语言模型在真实产品中的价值。",
      keywords: ["small language models", "latency", "cost"],
      uncertainTerms: ["retrieval-augmented"]
    });

    expect(parsed.keywords).toHaveLength(3);
    expect(parsed.uncertainTerms[0]).toBe("retrieval-augmented");
  });
});
