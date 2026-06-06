import { z } from "zod";

export const summaryRequestSchema = z.object({
  fullText: z.string().trim().min(1)
});

export const summaryResponseSchema = z.object({
  summary: z.string().min(1),
  keywords: z.array(z.string().min(1)),
  uncertainTerms: z.array(z.string().min(1))
});

export type SummaryRequest = z.infer<typeof summaryRequestSchema>;
export type SummaryResponse = z.infer<typeof summaryResponseSchema>;
