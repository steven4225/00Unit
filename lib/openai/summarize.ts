import {
  summaryRequestSchema,
  summaryResponseSchema,
  type SummaryRequest,
  type SummaryResponse
} from "../schemas/summarize";
import { createChatCompletion } from "./client";

function buildSummaryMessages(input: SummaryRequest) {
  return [
    {
      role: "system" as const,
      content:
        "You summarize English speech transcripts into Chinese. Return strict JSON in the shape {\"summary\":\"...\",\"keywords\":[\"...\"],\"uncertainTerms\":[\"...\"]}. Keep the result concise and do not add commentary outside JSON."
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        task: "summarize_transcript",
        fullText: input.fullText
      })
    }
  ];
}

export async function summarizeTranscript(
  rawInput: SummaryRequest
): Promise<SummaryResponse> {
  const input = summaryRequestSchema.parse(rawInput);
  const content = await createChatCompletion(buildSummaryMessages(input));

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("OpenAI summary response was not valid JSON");
  }

  return summaryResponseSchema.parse(parsedJson);
}
