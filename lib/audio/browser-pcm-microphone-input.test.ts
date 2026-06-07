import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AudioInputError,
  BrowserPcmMicrophoneInput
} from "./browser-pcm-microphone-input";

class MockScriptProcessorNode {
  onaudioprocess:
    | ((event: { inputBuffer: { getChannelData: (channel: number) => Float32Array } }) => void)
    | null = null;
  connectedTo: unknown[] = [];
  disconnected = false;

  connect(target: unknown) {
    this.connectedTo.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  emitSamples(samples: Float32Array) {
    this.onaudioprocess?.({
      inputBuffer: {
        getChannelData: () => samples
      }
    });
  }
}

class MockMediaStreamSourceNode {
  connectedTo: unknown[] = [];
  disconnected = false;

  connect(target: unknown) {
    this.connectedTo.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }
}

class MockAudioContext {
  readonly destination = { kind: "destination" };
  readonly mediaStreamSource = new MockMediaStreamSourceNode();
  readonly processorNode = new MockScriptProcessorNode();
  closed = false;

  constructor(readonly sampleRate: number) {}

  createMediaStreamSource(_stream: MediaStream) {
    return this.mediaStreamSource;
  }

  createScriptProcessor() {
    return this.processorNode;
  }

  async close() {
    this.closed = true;
  }
}

describe("BrowserPcmMicrophoneInput", () => {
  const getUserMediaMock = vi.fn();
  const stopTrackMock = vi.fn();
  const mediaStream = {
    getTracks: () => [{ stop: stopTrackMock }]
  } as unknown as MediaStream;
  let audioContext: MockAudioContext;

  beforeEach(() => {
    getUserMediaMock.mockReset();
    stopTrackMock.mockReset();
    getUserMediaMock.mockResolvedValue(mediaStream);
    audioContext = new MockAudioContext(16_000);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: getUserMediaMock
        }
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emits sequenced pcm16 mono chunks for cloud asr", async () => {
    const input = new BrowserPcmMicrophoneInput({
      getUserMedia: getUserMediaMock,
      createAudioContext: () => audioContext as unknown as AudioContext
    });
    const onChunk = vi.fn();

    await input.start(onChunk);

    audioContext.processorNode.emitSamples(
      new Float32Array([0, 0.5, -0.5, 1, -1])
    );

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0]?.[0]).toMatchObject({
      sequence: 0,
      mimeType: "audio/pcm"
    });

    const blob = onChunk.mock.calls[0]?.[0].blob as Blob;
    expect(blob.size).toBe(10);
  });

  it("stops tracks and closes the audio context", async () => {
    const input = new BrowserPcmMicrophoneInput({
      getUserMedia: getUserMediaMock,
      createAudioContext: () => audioContext as unknown as AudioContext
    });

    await input.start(vi.fn());
    input.stop();

    expect(audioContext.mediaStreamSource.disconnected).toBe(true);
    expect(audioContext.processorNode.disconnected).toBe(true);
    expect(audioContext.closed).toBe(true);
    expect(stopTrackMock).toHaveBeenCalledTimes(1);
  });

  it("fails cleanly when audio context support is unavailable", async () => {
    const input = new BrowserPcmMicrophoneInput({
      getUserMedia: getUserMediaMock,
      createAudioContext: undefined
    });

    vi.stubGlobal("AudioContext", undefined);

    await expect(input.start(vi.fn())).rejects.toEqual(
      expect.objectContaining<AudioInputError>({
        code: "not-supported"
      })
    );
  });
});
