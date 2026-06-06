const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export function getOpenAiApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  return apiKey;
}

export function getTranslateModel() {
  return process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-4o-mini";
}

export async function createChatCompletion(messages: {
  role: "system" | "user" | "assistant";
  content: string;
}[]) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAiApiKey()}`
    },
    body: JSON.stringify({
      model: getTranslateModel(),
      messages,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI translation request failed with ${response.status}`);
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
    throw new Error("OpenAI translation response did not include content");
  }

  return content;
}
