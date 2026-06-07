import { afterEach, describe, expect, it, vi } from "vitest";

const createChatCompletionMock = vi.fn();
const getSummarizeModelMock = vi.fn();

vi.mock("./client", () => ({
  createChatCompletion: (...args: unknown[]) => createChatCompletionMock(...args),
  getSummarizeModel: () => getSummarizeModelMock()
}));

import { summarizeTranscript } from "./summarize";

describe("summarizeTranscript", () => {
  afterEach(() => {
    createChatCompletionMock.mockReset();
    getSummarizeModelMock.mockReset();
  });

  it("uses an auto-detect source-language summary prompt for generic chat models", async () => {
    getSummarizeModelMock.mockReturnValue("gpt-4o-mini");
    createChatCompletionMock.mockResolvedValue(
      JSON.stringify({
        summary: "这段内容总结了日语讲解里的核心观点。",
        keywords: ["旅行", "准备"],
        uncertainTerms: ["road trip"]
      })
    );

    const result = await summarizeTranscript({
      fullText: "旅行の準備について説明します。"
    });

    expect(result).toEqual({
      summary: "这段内容总结了日语讲解里的核心观点。",
      keywords: ["旅行", "准备"],
      uncertainTerms: ["road trip"]
    });
    expect(createChatCompletionMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining(
            "Automatically identify the source language"
          )
        }),
        expect.objectContaining({
          role: "user"
        })
      ]),
      expect.objectContaining({
        model: "gpt-4o-mini"
      })
    );
  });
});
