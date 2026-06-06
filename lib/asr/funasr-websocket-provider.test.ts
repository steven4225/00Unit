import { describe, expect, it, vi } from "vitest";
import { FunAsrWebSocketProvider } from "./funasr-websocket-provider";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";

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

  emitError(error: unknown) {
    this.listeners.error?.(error);
  }
}

describe("FunAsrWebSocketProvider", () => {
  it("opens a websocket connection and sends the start payload", async () => {
    MockWebSocket.instances = [];
    const provider = new FunAsrWebSocketProvider({
      url: "wss://funasr.example/ws",
      createWebSocket: (url) => new MockWebSocket(url)
    });

    const connectionPromise = provider.connect({
      onEvent: vi.fn()
    });

    const socket = MockWebSocket.instances[0];
    expect(socket?.url).toBe("wss://funasr.example/ws");

    socket?.open();
    await connectionPromise;

    expect(socket?.binaryType).toBe("arraybuffer");
    expect(socket?.sent[0]).toBe(JSON.stringify({ mode: "2pass" }));
  });

  it("sends audio chunks as binary frames", async () => {
    MockWebSocket.instances = [];
    const provider = new FunAsrWebSocketProvider({
      url: "wss://funasr.example/ws",
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

    expect(socket?.sent[1]).toBeInstanceOf(ArrayBuffer);
  });

  it("maps websocket messages into normalized provider events", async () => {
    MockWebSocket.instances = [];
    const onEvent = vi.fn<(event: CloudAsrSegmentUpdate) => void>();
    const provider = new FunAsrWebSocketProvider({
      url: "wss://funasr.example/ws",
      createWebSocket: (url) => new MockWebSocket(url)
    });

    const connectionPromise = provider.connect({
      onEvent
    });
    const socket = MockWebSocket.instances[0];
    socket?.open();
    await connectionPromise;

    socket?.emitMessage(
      JSON.stringify({
        partial: "small language",
        partial_id: "live-1",
        partial_start_ms: 0,
        partial_end_ms: 500,
        sequence: 1
      })
    );
    await Promise.resolve();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        continuityKey: "partial:live-1",
        text: "small language",
        isFinal: false
      })
    );
  });

  it("reports invalid provider payloads through onError", async () => {
    MockWebSocket.instances = [];
    const onError = vi.fn();
    const provider = new FunAsrWebSocketProvider({
      url: "wss://funasr.example/ws",
      createWebSocket: (url) => new MockWebSocket(url)
    });

    const connectionPromise = provider.connect({
      onEvent: vi.fn(),
      onError
    });
    const socket = MockWebSocket.instances[0];
    socket?.open();
    await connectionPromise;

    socket?.emitMessage("{not-json");
    await Promise.resolve();

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("sends the stop payload before closing the websocket", async () => {
    MockWebSocket.instances = [];
    const provider = new FunAsrWebSocketProvider({
      url: "wss://funasr.example/ws",
      createWebSocket: (url) => new MockWebSocket(url)
    });

    const connectionPromise = provider.connect({
      onEvent: vi.fn()
    });
    const socket = MockWebSocket.instances[0];
    socket?.open();
    const connection = await connectionPromise;

    await connection.close();

    expect(socket?.sent.at(-1)).toBe(JSON.stringify({ is_speaking: false }));
    expect(socket?.closeCalled).toBe(true);
  });
});
