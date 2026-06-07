const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export function getLlmApiKey() {
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing LLM_API_KEY or OPENAI_API_KEY");
  }

  return apiKey;
}

export function getLlmBaseUrl() {
  const baseUrl = process.env.LLM_BASE_URL ?? DEFAULT_OPENAI_BASE_URL;
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function getTranslateModel() {
  return process.env.LLM_TRANSLATE_MODEL ?? process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-4o-mini";
}

export function getSummarizeModel() {
  return process.env.LLM_SUMMARIZE_MODEL ?? process.env.OPENAI_SUMMARIZE_MODEL ?? "gpt-4o-mini";
}

export async function createChatCompletion(
  messages: {
    role: "system" | "user" | "assistant";
    content: string;
  }[],
  options: {
    model: string;
  }
) {
  const response = await fetch(`${getLlmBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getLlmApiKey()}`
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`LLM chat completion request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("LLM chat completion response did not include content");
  }

  return content;
}
