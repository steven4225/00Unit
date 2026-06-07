import { z } from "zod";

export const audioInputKindSchema = z.enum([
  "browser-microphone",
  "system-audio"
]);

export const audioInputChunkSchema = z.object({
  sequence: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
  blob: z.instanceof(Blob),
  rmsLevel: z.number().min(0).max(1).optional()
});

export type AudioInputKind = z.infer<typeof audioInputKindSchema>;
export type AudioInputChunk = z.infer<typeof audioInputChunkSchema>;
export type AudioInputChunkHandler = (chunk: AudioInputChunk) => void;

export interface AudioInputSource {
  start(onChunk: AudioInputChunkHandler): Promise<void>;
  stop(): void;
}
