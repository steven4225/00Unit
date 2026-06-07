import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createChatCompletion,
  getLlmApiKey,
  getLlmBaseUrl,
  getSummarizeModel,
  getTranslateModel
} from "./client";

const originalEnv = {
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  LLM_TRANSLATE_MODEL: process.env.LLM_TRANSLATE_MODEL,
  LLM_SUMMARIZE_MODEL: process.env.LLM_SUMMARIZE_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_TRANSLATE_MODEL: process.env.OPENAI_TRANSLATE_MODEL
};

describe("llm client config", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  it("prefers generic llm env vars for base url, key, and models", async () => {
    process.env.LLM_API_KEY = "llm-key";
    process.env.LLM_BASE_URL = "https://example.com/compatible/v1";
    process.env.LLM_TRANSLATE_MODEL = "qwen-translate";
    process.env.LLM_SUMMARIZE_MODEL = "qwen-summarize";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"ok\":true}"
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    expect(getLlmApiKey()).toBe("llm-key");
    expect(getLlmBaseUrl()).toBe("https://example.com/compatible/v1");
    expect(getTranslateModel()).toBe("qwen-translate");
    expect(getSummarizeModel()).toBe("qwen-summarize");

    await createChatCompletion(
      [
        {
          role: "user",
          content: "hello"
        }
      ],
      {
        model: getTranslateModel()
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/compatible/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer llm-key"
        }),
        body: JSON.stringify({
          model: "qwen-translate",
          messages: [
            {
              role: "user",
              content: "hello"
            }
          ],
          temperature: 0.2
        })
      })
    );
  });

  it("falls back to existing openai env vars for backward compatibility", () => {
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.OPENAI_TRANSLATE_MODEL = "gpt-4o-mini-translate";

    expect(getLlmApiKey()).toBe("openai-key");
    expect(getLlmBaseUrl()).toBe("https://api.openai.com/v1");
    expect(getTranslateModel()).toBe("gpt-4o-mini-translate");
    expect(getSummarizeModel()).toBe("gpt-4o-mini");
  });
});

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
