import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const summarizeTranscriptMock = vi.fn();

vi.mock("../../../lib/openai/summarize", () => ({
  summarizeTranscript: (...args: unknown[]) => summarizeTranscriptMock(...args)
}));

describe("POST /api/summarize", () => {
  afterEach(() => {
    summarizeTranscriptMock.mockReset();
  });

  it("returns structured summary output", async () => {
    summarizeTranscriptMock.mockResolvedValue({
      summary: "这段演讲解释了小型模型在真实产品中的优势。",
      keywords: ["small models", "product", "latency"],
      uncertainTerms: ["retrieval-augmented generation"]
    });

    const response = await POST(
      new Request("http://localhost/api/summarize", {
        method: "POST",
        body: JSON.stringify({
          fullText:
            "Today I want to explain why small models can still be valuable in production."
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: "这段演讲解释了小型模型在真实产品中的优势。",
      keywords: ["small models", "product", "latency"],
      uncertainTerms: ["retrieval-augmented generation"]
    });
  });

  it("rejects invalid summary payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/summarize", {
        method: "POST",
        body: JSON.stringify({
          fullText: ""
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid summary request"
    });
  });
});
