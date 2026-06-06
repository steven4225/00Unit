import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AudioInputError,
  BrowserMicrophoneInput
} from "./browser-microphone-input";

type DataAvailableHandler = ((event: { data: Blob }) => void) | null;

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];

  readonly stream: MediaStream;
  readonly mimeType: string;
  ondataavailable: DataAvailableHandler = null;
  startedWith: number | null = null;
  stopCalled = false;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "audio/webm";
    MockMediaRecorder.instances.push(this);
  }

  start(timeslice?: number) {
    this.startedWith = timeslice ?? null;
  }

  stop() {
    this.stopCalled = true;
  }

  emitChunk(text: string) {
    this.ondataavailable?.({
      data: new Blob([text], { type: this.mimeType })
    });
  }
}

describe("BrowserMicrophoneInput", () => {
  const getUserMediaMock = vi.fn();
  const stopTrackMock = vi.fn();
  const mediaStream = {
    getTracks: () => [{ stop: stopTrackMock }]
  } as unknown as MediaStream;

  beforeEach(() => {
    MockMediaRecorder.instances = [];
    getUserMediaMock.mockReset();
    stopTrackMock.mockReset();
    getUserMediaMock.mockResolvedValue(mediaStream);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: getUserMediaMock
        }
      }
    });

    vi.stubGlobal("MediaRecorder", MockMediaRecorder as unknown as typeof MediaRecorder);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests microphone access and emits sequenced audio chunks", async () => {
    const input = new BrowserMicrophoneInput({
      timesliceMs: 320
    });
    const onChunk = vi.fn();

    await input.start(onChunk);

    expect(getUserMediaMock).toHaveBeenCalledWith({
      audio: true
    });
    expect(MockMediaRecorder.instances).toHaveLength(1);
    expect(MockMediaRecorder.instances[0]?.startedWith).toBe(320);

    MockMediaRecorder.instances[0]?.emitChunk("chunk-1");
    MockMediaRecorder.instances[0]?.emitChunk("chunk-2");

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk.mock.calls[0]?.[0]).toMatchObject({
      sequence: 0,
      mimeType: "audio/webm"
    });
    expect(onChunk.mock.calls[1]?.[0]).toMatchObject({
      sequence: 1,
      mimeType: "audio/webm"
    });
  });

  it("stops the recorder and underlying media tracks", async () => {
    const input = new BrowserMicrophoneInput();

    await input.start(vi.fn());
    input.stop();

    expect(MockMediaRecorder.instances[0]?.stopCalled).toBe(true);
    expect(stopTrackMock).toHaveBeenCalledTimes(1);
  });

  it("maps permission denial into a readable AudioInputError", async () => {
    getUserMediaMock.mockRejectedValue(
      Object.assign(new Error("Permission denied"), {
        name: "NotAllowedError"
      })
    );

    const input = new BrowserMicrophoneInput();

    await expect(input.start(vi.fn())).rejects.toEqual(
      expect.objectContaining<AudioInputError>({
        code: "permission-denied"
      })
    );
  });

  it("fails cleanly when browser media APIs are unavailable", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {}
    });

    const input = new BrowserMicrophoneInput();

    await expect(input.start(vi.fn())).rejects.toEqual(
      expect.objectContaining<AudioInputError>({
        code: "not-supported"
      })
    );
  });
});
