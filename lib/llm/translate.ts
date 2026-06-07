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
  const model = getTranslateModel();

  if (isQwenMtModel(model)) {
    const items = await Promise.all(
      input.items.map(async (item) => ({
        id: item.id,
        chinese: await createChatCompletion(
          [
            {
              role: "user",
              content: item.text
            }
          ],
          {
            model,
            extraBody: {
              translation_options: {
                source_lang: "auto",
                target_lang: "Chinese"
              }
            }
          }
        )
      }))
    );

    return translationResponseSchema.parse({
      items
    });
  }

  const content = await createChatCompletion(buildTranslationMessages(input), {
    model
  });

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("LLM translation response was not valid JSON");
  }

  return translationResponseSchema.parse(parsedJson);
}

function isQwenMtModel(model: string) {
  return model.startsWith("qwen-mt-");
}
