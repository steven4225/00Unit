import { z } from "zod";

export const translationInputItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  previousText: z.string().optional()
});

export const translationRequestSchema = z.object({
  items: z.array(translationInputItemSchema).min(1).max(2)
});

export const translationOutputItemSchema = z.object({
  id: z.string().min(1),
  chinese: z.string().min(1)
});

export const translationResponseSchema = z.object({
  items: z.array(translationOutputItemSchema).min(1).max(2)
});

export type TranslationInputItem = z.infer<typeof translationInputItemSchema>;
export type TranslationRequest = z.infer<typeof translationRequestSchema>;
export type TranslationOutputItem = z.infer<typeof translationOutputItemSchema>;
export type TranslationResponse = z.infer<typeof translationResponseSchema>;
