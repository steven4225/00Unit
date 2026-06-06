import { describe, expect, it, vi } from "vitest";
import type {
  AudioInputChunk,
  AudioInputSource
} from "../audio/audio-input-source";
import type { TranscriptEvent } from "../schemas/transcript";
import { CloudAsrSource } from "./cloud-asr-source";
import type {
  CloudAsrProviderClient,
  CloudAsrProviderConnection
} from "./cloud-asr-provider";

const createAudioChunk = (sequence: number): AudioInputChunk => ({
  sequence,
  mimeType: "audio/webm",
  blob: new Blob([`chunk-${sequence}`], { type: "audio/webm" })
});

const createTranscriptEvent = (id: string): TranscriptEvent => ({
  id,
  text: `event-${id}`,
  isFinal: false,
  startMs: 0,
  endMs: 100,
  source: "cloud-asr"
});

describe("CloudAsrSource", () => {
  it("streams captured audio chunks into the provider connection", async () => {
    let onChunk: ((chunk: AudioInputChunk) => void) | undefined;

    const audioInput: AudioInputSource = {
      start: vi.fn(async (handler) => {
        onChunk = handler;
      }),
      stop: vi.fn()
    };

    const providerConnection: CloudAsrProviderConnection = {
      sendAudioChunk: vi.fn(async () => {}),
      close: vi.fn(async () => {})
    };

    const provider: CloudAsrProviderClient = {
      connect: vi.fn(async () => providerConnection)
    };

    const source = new CloudAsrSource({
      audioInput,
      provider,
      normalizeEvent: () => []
    });

    await source.start({
      onEvent: vi.fn()
    });

    onChunk?.(createAudioChunk(1));

    expect(provider.connect).toHaveBeenCalledTimes(1);
    expect(providerConnection.sendAudioChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        sequence: 1,
        mimeType: "audio/webm"
      })
    );
  });

  it("normalizes provider events before forwarding them downstream", async () => {
    let providerHandlers:
      | Parameters<CloudAsrProviderClient["connect"]>[0]
      | undefined;

    const audioInput: AudioInputSource = {
      start: vi.fn(async () => {}),
      stop: vi.fn()
    };

    const providerConnection: CloudAsrProviderConnection = {
      sendAudioChunk: vi.fn(async () => {}),
      close: vi.fn(async () => {})
    };

    const provider: CloudAsrProviderClient<{ partial: string }> = {
      connect: vi.fn(async (handlers) => {
        providerHandlers = handlers;
        return providerConnection;
      })
    };

    const normalizeEvent = vi.fn(() => [
      createTranscriptEvent("seg-live-1"),
      createTranscriptEvent("seg-live-1")
    ]);
    const onEvent = vi.fn();

    const source = new CloudAsrSource({
      audioInput,
      provider,
      normalizeEvent
    });

    await source.start({
      onEvent
    });

    providerHandlers?.onEvent({
      partial: "hello"
    });

    expect(normalizeEvent).toHaveBeenCalledWith({
      partial: "hello"
    });
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: "seg-live-1",
        source: "cloud-asr"
      })
    );
  });

  it("stops both the audio input and the provider connection", async () => {
    const audioInput: AudioInputSource = {
      start: vi.fn(async () => {}),
      stop: vi.fn()
    };

    const providerConnection: CloudAsrProviderConnection = {
      sendAudioChunk: vi.fn(async () => {}),
      close: vi.fn(async () => {})
    };

    const provider: CloudAsrProviderClient = {
      connect: vi.fn(async () => providerConnection)
    };

    const source = new CloudAsrSource({
      audioInput,
      provider,
      normalizeEvent: () => []
    });

    await source.start({
      onEvent: vi.fn()
    });
    await source.stop();

    expect(audioInput.stop).toHaveBeenCalledTimes(1);
    expect(providerConnection.close).toHaveBeenCalledTimes(1);
  });

  it("closes the provider connection when audio input startup fails", async () => {
    const startupError = new Error("microphone failed");
    const audioInput: AudioInputSource = {
      start: vi.fn(async () => {
        throw startupError;
      }),
      stop: vi.fn()
    };

    const providerConnection: CloudAsrProviderConnection = {
      sendAudioChunk: vi.fn(async () => {}),
      close: vi.fn(async () => {})
    };

    const provider: CloudAsrProviderClient = {
      connect: vi.fn(async () => providerConnection)
    };

    const source = new CloudAsrSource({
      audioInput,
      provider,
      normalizeEvent: () => []
    });

    await expect(
      source.start({
        onEvent: vi.fn()
      })
    ).rejects.toThrow(startupError);

    expect(providerConnection.close).toHaveBeenCalledTimes(1);
  });
});
