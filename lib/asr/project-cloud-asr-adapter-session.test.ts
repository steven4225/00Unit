import { describe, expect, it, vi } from "vitest";
import type {
  CloudAsrProviderClient,
  CloudAsrProviderConnection
} from "./cloud-asr-provider";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";
import { ProjectCloudAsrAdapterSession } from "./project-cloud-asr-adapter-session";

function createProviderHarness() {
  let handlers:
    | {
        onEvent: (event: CloudAsrSegmentUpdate) => void;
        onError?: (error: unknown) => void;
      }
    | undefined;

  const connection: CloudAsrProviderConnection = {
    sendAudioChunk: vi.fn(async () => {}),
    close: vi.fn(async () => {})
  };

  const provider: CloudAsrProviderClient<CloudAsrSegmentUpdate> = {
    connect: vi.fn(async (nextHandlers) => {
      handlers = nextHandlers;
      return connection;
    })
  };

  return {
    provider,
    connection,
    emitEvent(event: CloudAsrSegmentUpdate) {
      handlers?.onEvent(event);
    },
    emitError(error: unknown) {
      handlers?.onError?.(error);
    }
  };
}

describe("ProjectCloudAsrAdapterSession", () => {
  it("forwards browser audio frames to the provider connection", async () => {
    const browserSocket = {
      send: vi.fn(),
      close: vi.fn()
    };
    const harness = createProviderHarness();
    const session = new ProjectCloudAsrAdapterSession(browserSocket, harness.provider);

    await session.start();
    await session.handleBinaryMessage(Buffer.from("frame-a"));
    await session.handleBinaryMessage(Buffer.from("frame-b"));

    expect(harness.connection.sendAudioChunk).toHaveBeenCalledTimes(2);
    expect(harness.connection.sendAudioChunk).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sequence: 0 })
    );
    expect(harness.connection.sendAudioChunk).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sequence: 1 })
    );
  });

  it("serializes provider updates back to the browser socket", async () => {
    const browserSocket = {
      send: vi.fn(),
      close: vi.fn()
    };
    const harness = createProviderHarness();
    const session = new ProjectCloudAsrAdapterSession(browserSocket, harness.provider);

    await session.start();

    harness.emitEvent({
      continuityKey: "segment-1",
      text: "adapter partial",
      isFinal: false,
      startMs: 0,
      endMs: 400,
      sequence: 1
    });

    expect(browserSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        continuityKey: "segment-1",
        text: "adapter partial",
        isFinal: false,
        startMs: 0,
        endMs: 400,
        sequence: 1
      })
    );
  });

  it("closes the browser socket when the provider reports an error", async () => {
    const browserSocket = {
      send: vi.fn(),
      close: vi.fn()
    };
    const harness = createProviderHarness();
    const session = new ProjectCloudAsrAdapterSession(browserSocket, harness.provider);

    await session.start();
    harness.emitError(new Error("FunASR handshake failed"));

    expect(browserSocket.close).toHaveBeenCalledWith(1011, "FunASR handshake failed");
    await Promise.resolve();
    expect(harness.connection.close).toHaveBeenCalledTimes(1);
  });

  it("closes the provider connection when the browser session stops", async () => {
    const browserSocket = {
      send: vi.fn(),
      close: vi.fn()
    };
    const harness = createProviderHarness();
    const session = new ProjectCloudAsrAdapterSession(browserSocket, harness.provider);

    await session.start();
    await session.stop();

    expect(harness.connection.close).toHaveBeenCalledTimes(1);
  });

  it("serializes provider audio sends to preserve frame order", async () => {
    const browserSocket = {
      send: vi.fn(),
      close: vi.fn()
    };
    let releaseFirstChunk: (() => void) | undefined;
    const firstChunkSent = new Promise<void>((resolve) => {
      releaseFirstChunk = resolve;
    });
    const seenSequences: number[] = [];
    const connection: CloudAsrProviderConnection = {
      sendAudioChunk: vi.fn(async (chunk) => {
        seenSequences.push(chunk.sequence);
        if (chunk.sequence === 0) {
          await firstChunkSent;
        }
      }),
      close: vi.fn(async () => {})
    };
    const provider: CloudAsrProviderClient<CloudAsrSegmentUpdate> = {
      connect: vi.fn(async () => connection)
    };
    const session = new ProjectCloudAsrAdapterSession(browserSocket, provider);

    await session.start();
    const firstSend = session.handleBinaryMessage(Buffer.from("frame-a"));
    const secondSend = session.handleBinaryMessage(Buffer.from("frame-b"));
    await Promise.resolve();

    expect(connection.sendAudioChunk).toHaveBeenCalledTimes(1);
    releaseFirstChunk?.();
    await Promise.all([firstSend, secondSend]);

    expect(seenSequences).toEqual([0, 1]);
  });
});
