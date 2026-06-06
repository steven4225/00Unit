import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type { CloudAsrProviderClient } from "./cloud-asr-provider";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";
import {
  createProjectCloudAsrAdapterServer,
  type ProjectCloudAsrAdapterSessionLike
} from "./project-cloud-asr-adapter-server";

function createNoopProvider(): CloudAsrProviderClient<CloudAsrSegmentUpdate> {
  return {
    connect: vi.fn(async () => ({
      sendAudioChunk: vi.fn(async () => {}),
      close: vi.fn(async () => {})
    }))
  };
}

async function waitForOpen(socket: WebSocket) {
  if (socket.readyState === WebSocket.OPEN) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
}

async function waitForClose(socket: WebSocket) {
  if (socket.readyState === WebSocket.CLOSED) {
    return;
  }

  await new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
  });
}

describe("createProjectCloudAsrAdapterServer", () => {
  const servers: Array<{ shutdown: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.allSettled(servers.splice(0).map((server) => server.shutdown()));
  });

  it("shuts down active browser sessions and provider sessions together", async () => {
    const stop = vi.fn(async () => {});
    const createSession = vi.fn(
      (): ProjectCloudAsrAdapterSessionLike => ({
        start: vi.fn(async () => {}),
        handleBinaryMessage: vi.fn(async () => {}),
        stop
      })
    );
    const adapterServer = createProjectCloudAsrAdapterServer({
      port: 0,
      path: "/adapter-test",
      createProvider: createNoopProvider,
      createSession
    });
    servers.push(adapterServer);

    const address = adapterServer.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected a bound websocket server address.");
    }

    const client = new WebSocket(`ws://127.0.0.1:${address.port}/adapter-test`);
    await waitForOpen(client);

    await adapterServer.shutdown();

    expect(stop).toHaveBeenCalledTimes(1);
    await waitForClose(client);
  });
});
