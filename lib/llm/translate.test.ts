import { afterEach, describe, expect, it, vi } from "vitest";

const createChatCompletionMock = vi.fn();
const getTranslateModelMock = vi.fn();

vi.mock("./client", () => ({
  createChatCompletion: (...args: unknown[]) => createChatCompletionMock(...args),
  getTranslateModel: () => getTranslateModelMock()
}));

import { translateSegments } from "./translate";

describe("translateSegments", () => {
  afterEach(() => {
    createChatCompletionMock.mockReset();
    getTranslateModelMock.mockReset();
  });

  it("uses the existing structured-json prompt for generic chat models", async () => {
    getTranslateModelMock.mockReturnValue("gpt-4o-mini");
    createChatCompletionMock.mockResolvedValue(
      JSON.stringify({
        items: [
          {
            id: "seg-1",
            chinese: "示例二。"
          }
        ]
      })
    );

    const result = await translateSegments({
      items: [
        {
          id: "seg-1",
          text: "Example two."
        }
      ]
    });

    expect(result).toEqual({
      items: [
        {
          id: "seg-1",
          chinese: "示例二。"
        }
      ]
    });
    expect(createChatCompletionMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: "system"
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

  it("uses qwen-mt translation_options for dedicated translation models", async () => {
    getTranslateModelMock.mockReturnValue("qwen-mt-plus");
    createChatCompletionMock.mockResolvedValueOnce("示例二。");

    const result = await translateSegments({
      items: [
        {
          id: "seg-1",
          text: "Example two."
        }
      ]
    });

    expect(result).toEqual({
      items: [
        {
          id: "seg-1",
          chinese: "示例二。"
        }
      ]
    });
    expect(createChatCompletionMock).toHaveBeenCalledWith(
      [
        {
          role: "user",
          content: "Example two."
        }
      ],
      expect.objectContaining({
        model: "qwen-mt-plus",
        extraBody: {
          translation_options: {
            source_lang: "auto",
            target_lang: "Chinese"
          }
        }
      })
    );
  });
});
