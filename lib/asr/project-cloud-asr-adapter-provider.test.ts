import { describe, expect, it, vi } from "vitest";
import { ProjectCloudAsrAdapterProvider } from "./project-cloud-asr-adapter-provider";

type ListenerMap = {
  open?: () => void;
  message?: (event: { data: string | ArrayBuffer | Blob }) => void;
  error?: (event: unknown) => void;
};

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = 0;
  binaryType = "blob";
  sent: Array<string | ArrayBufferLike | Blob> = [];
  listeners: ListenerMap = {};
  closeCalled = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: keyof ListenerMap, listener: ListenerMap[typeof type]) {
    this.listeners[type] = listener;
  }

  send(data: string | ArrayBufferLike | Blob) {
    this.sent.push(data);
  }

  close() {
    this.closeCalled = true;
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    this.listeners.open?.();
  }

  emitMessage(data: string | ArrayBuffer | Blob) {
    this.listeners.message?.({ data });
  }
}

describe("ProjectCloudAsrAdapterProvider", () => {
  it("opens a websocket connection without provider-specific startup payloads", async () => {
    MockWebSocket.instances = [];
    const provider = new ProjectCloudAsrAdapterProvider({
      url: "wss://adapter.example/ws",
      createWebSocket: (url) => new MockWebSocket(url)
    });

    const connectionPromise = provider.connect({
      onEvent: vi.fn()
    });

    const socket = MockWebSocket.instances[0];
    expect(socket?.url).toBe("wss://adapter.example/ws");

    socket?.open();
    await connectionPromise;

    expect(socket?.binaryType).toBe("arraybuffer");
    expect(socket?.sent).toHaveLength(0);
  });

  it("forwards audio chunks as binary frames", async () => {
    MockWebSocket.instances = [];
    const provider = new ProjectCloudAsrAdapterProvider({
      url: "wss://adapter.example/ws",
      createWebSocket: (url) => new MockWebSocket(url)
    });

    const connectionPromise = provider.connect({
      onEvent: vi.fn()
    });
    const socket = MockWebSocket.instances[0];
    socket?.open();
    const connection = await connectionPromise;

    await connection.sendAudioChunk({
      sequence: 1,
      mimeType: "audio/webm",
      blob: new Blob(["audio-frame"], { type: "audio/webm" })
    });

    expect(socket?.sent[0]).toBeInstanceOf(ArrayBuffer);
  });

  it("maps adapter messages into cloud asr segment updates", async () => {
    MockWebSocket.instances = [];
    const onEvent = vi.fn();
    const provider = new ProjectCloudAsrAdapterProvider({
      url: "wss://adapter.example/ws",
      createWebSocket: (url) => new MockWebSocket(url)
    });

    const connectionPromise = provider.connect({ onEvent });
    const socket = MockWebSocket.instances[0];
    socket?.open();
    await connectionPromise;

    socket?.emitMessage(
      JSON.stringify({
        continuityKey: "segment-1",
        text: "adapter partial",
        isFinal: false,
        startMs: 0,
        endMs: 480,
        sequence: 1
      })
    );
    await Promise.resolve();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        continuityKey: "segment-1",
        text: "adapter partial",
        isFinal: false
      })
    );
  });

  it("reports invalid adapter payloads through onError", async () => {
    MockWebSocket.instances = [];
    const onError = vi.fn();
    const provider = new ProjectCloudAsrAdapterProvider({
      url: "wss://adapter.example/ws",
      createWebSocket: (url) => new MockWebSocket(url)
    });

    const connectionPromise = provider.connect({
      onEvent: vi.fn(),
      onError
    });
    const socket = MockWebSocket.instances[0];
    socket?.open();
    await connectionPromise;

    socket?.emitMessage(JSON.stringify({ bad: true }));
    await Promise.resolve();

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
