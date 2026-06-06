import { describe, expect, it } from "vitest";
import {
  audioInputChunkSchema,
  audioInputKindSchema
} from "./audio-input-source";

describe("audio input source schemas", () => {
  it("accepts browser microphone as the active phase-2 input kind", () => {
    expect(audioInputKindSchema.parse("browser-microphone")).toBe(
      "browser-microphone"
    );
  });

  it("validates raw audio chunk metadata", () => {
    expect(
      audioInputChunkSchema.parse({
        sequence: 0,
        mimeType: "audio/webm",
        blob: new Blob(["test"], { type: "audio/webm" })
      })
    ).toMatchObject({
      sequence: 0,
      mimeType: "audio/webm"
    });
  });
});
