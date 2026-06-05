import { z } from "zod";

export const transcriptSourceSchema = z.enum([
  "mock",
  "cloud-asr",
  "windows-live-captions"
]);

export const transcriptEventSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  isFinal: z.boolean(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  source: transcriptSourceSchema
});

export const subtitleStatusSchema = z.enum(["draft", "final", "corrected"]);

export const subtitleItemSchema = z.object({
  id: z.string().min(1),
  english: z.string(),
  chinese: z.string(),
  status: subtitleStatusSchema,
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative()
});

export type TranscriptSource = z.infer<typeof transcriptSourceSchema>;
export type TranscriptEvent = z.infer<typeof transcriptEventSchema>;
export type SubtitleStatus = z.infer<typeof subtitleStatusSchema>;
export type SubtitleItem = z.infer<typeof subtitleItemSchema>;
