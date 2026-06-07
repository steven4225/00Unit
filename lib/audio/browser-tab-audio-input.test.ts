import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioInputError } from "./browser-microphone-input";
import { BrowserTabAudioInput } from "./browser-tab-audio-input";

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
  resumed = false;
  state: "suspended" | "running" = "suspended";

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

  async resume() {
    this.resumed = true;
    this.state = "running";
  }
}

describe("BrowserTabAudioInput", () => {
  const getDisplayMediaMock = vi.fn();
  const stopTrackMock = vi.fn();
  const mediaStream = {
    getTracks: () => [{ stop: stopTrackMock }],
    getAudioTracks: () => [{ kind: "audio" }]
  } as unknown as MediaStream;
  let audioContext: MockAudioContext;

  beforeEach(() => {
    getDisplayMediaMock.mockReset();
    stopTrackMock.mockReset();
    getDisplayMediaMock.mockResolvedValue(mediaStream);
    audioContext = new MockAudioContext(16_000);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getDisplayMedia: getDisplayMediaMock
        }
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests tab sharing and emits sequenced pcm16 chunks", async () => {
    const input = new BrowserTabAudioInput({
      getDisplayMedia: getDisplayMediaMock,
      createAudioContext: () => audioContext as unknown as AudioContext
    });
    const onChunk = vi.fn();

    await input.start(onChunk);

    expect(getDisplayMediaMock).toHaveBeenCalledWith({
      video: true,
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    expect(audioContext.resumed).toBe(true);

    audioContext.processorNode.emitSamples(
      new Float32Array([0, 0.5, -0.5, 1, -1])
    );
    audioContext.processorNode.emitSamples(
      new Float32Array([0.25, -0.25, 0.25, -0.25])
    );

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk.mock.calls[0]?.[0]).toMatchObject({
      sequence: 0,
      mimeType: "audio/pcm"
    });
    expect(onChunk.mock.calls[0]?.[0].rmsLevel).toBeGreaterThan(0);
    expect(onChunk.mock.calls[1]?.[0]).toMatchObject({
      sequence: 1,
      mimeType: "audio/pcm"
    });
    expect(onChunk.mock.calls[0]?.[0].blob.size).toBe(10);
    expect(onChunk.mock.calls[0]?.[0].blob.type).toBe("audio/pcm");
  });

  it("stops tracks and closes the audio context", async () => {
    const input = new BrowserTabAudioInput({
      getDisplayMedia: getDisplayMediaMock,
      createAudioContext: () => audioContext as unknown as AudioContext
    });

    await input.start(vi.fn());
    input.stop();

    expect(audioContext.mediaStreamSource.disconnected).toBe(true);
    expect(audioContext.processorNode.disconnected).toBe(true);
    expect(audioContext.closed).toBe(true);
    expect(stopTrackMock).toHaveBeenCalledTimes(1);
  });

  it("fails cleanly when no audio track is available from the current share", async () => {
    getDisplayMediaMock.mockResolvedValue({
      getTracks: () => [{ stop: stopTrackMock }],
      getAudioTracks: () => []
    } as unknown as MediaStream);

    const input = new BrowserTabAudioInput({
      getDisplayMedia: getDisplayMediaMock,
      createAudioContext: () => audioContext as unknown as AudioContext
    });

    await expect(input.start(vi.fn())).rejects.toEqual(
      expect.objectContaining<AudioInputError>({
        code: "device-unavailable"
      })
    );
  });

  it("maps permission denial into a readable AudioInputError", async () => {
    getDisplayMediaMock.mockRejectedValue(
      Object.assign(new Error("Permission denied"), {
        name: "NotAllowedError"
      })
    );

    const input = new BrowserTabAudioInput({
      getDisplayMedia: getDisplayMediaMock,
      createAudioContext: () => audioContext as unknown as AudioContext
    });

    await expect(input.start(vi.fn())).rejects.toEqual(
      expect.objectContaining<AudioInputError>({
        code: "permission-denied"
      })
    );
  });
});
