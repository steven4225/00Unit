import {
  translationRequestSchema,
  translationResponseSchema,
  type TranslationRequest,
  type TranslationResponse
} from "../schemas/translate";
import { createChatCompletion, getTranslateModel } from "./client";

function buildTranslationMessages(input: TranslationRequest) {
  return [
    {
      role: "system" as const,
      content:
        "You translate finalized English subtitle segments into concise, natural Chinese. Return strict JSON in the shape {\"items\":[{\"id\":\"...\",\"chinese\":\"...\"}]}. Keep the id unchanged. Do not add explanations."
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        task: "translate_changed_segments",
        items: input.items
      })
    }
  ];
}

export async function translateSegments(
  rawInput: TranslationRequest
): Promise<TranslationResponse> {
  const input = translationRequestSchema.parse(rawInput);
  const content = await createChatCompletion(buildTranslationMessages(input), {
    model: getTranslateModel()
  });

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("LLM translation response was not valid JSON");
  }

  return translationResponseSchema.parse(parsedJson);
}
