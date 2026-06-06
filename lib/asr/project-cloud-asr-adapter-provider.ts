import type { AudioInputChunk } from "../audio/audio-input-source";
import type {
  CloudAsrProviderClient,
  CloudAsrProviderConnection
} from "./cloud-asr-provider";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";

type WebSocketLike = {
  readyState: number;
  binaryType: string;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(
    type: "message",
    listener: (event: { data: string | ArrayBuffer | Blob }) => void
  ): void;
  addEventListener(type: "error", listener: (event: unknown) => void): void;
  send(data: string | ArrayBufferLike | Blob): void;
  close(): void;
};

export interface ProjectCloudAsrAdapterProviderOptions {
  url: string;
  createWebSocket?: (url: string) => WebSocketLike;
}

export class ProjectCloudAsrAdapterProvider
  implements CloudAsrProviderClient<CloudAsrSegmentUpdate>
{
  private readonly url: string;
  private readonly createWebSocket: (url: string) => WebSocketLike;

  constructor(options: ProjectCloudAsrAdapterProviderOptions) {
    this.url = options.url;
    this.createWebSocket = options.createWebSocket ?? defaultCreateWebSocket;
  }

  async connect(handlers: {
    onEvent: (event: CloudAsrSegmentUpdate) => void;
    onError?: (error: unknown) => void;
  }): Promise<CloudAsrProviderConnection> {
    const socket = this.createWebSocket(this.url);
    socket.binaryType = "arraybuffer";

    return new Promise<CloudAsrProviderConnection>((resolve, reject) => {
      let settled = false;

      socket.addEventListener("open", () => {
        settled = true;

        resolve({
          sendAudioChunk: async (chunk: AudioInputChunk) => {
            socket.send(await readBlobAsArrayBuffer(chunk.blob));
          },
          close: async () => {
            socket.close();
          }
        });
      });

      socket.addEventListener("message", async (event) => {
        try {
          const payload = await resolveMessageData(event.data);
          if (!payload) {
            return;
          }

          const parsed = JSON.parse(payload) as unknown;
          for (const update of normalizeAdapterPayload(parsed)) {
            handlers.onEvent(update);
          }
        } catch (error) {
          handlers.onError?.(error);
        }
      });

      socket.addEventListener("error", (error) => {
        if (!settled) {
          reject(new Error("Failed to connect to the project cloud-asr adapter."));
          return;
        }

        handlers.onError?.(error);
      });
    });
  }
}

function defaultCreateWebSocket(url: string): WebSocketLike {
  return new WebSocket(url);
}

async function resolveMessageData(
  data: string | ArrayBuffer | Blob
): Promise<string> {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof Blob) {
    return data.text();
  }

  return new TextDecoder().decode(data);
}

function normalizeAdapterPayload(payload: unknown): CloudAsrSegmentUpdate[] {
  const updates = Array.isArray(payload) ? payload : [payload];

  return updates.map((entry) => {
    if (!isCloudAsrSegmentUpdate(entry)) {
      throw new Error("Received an invalid cloud-asr adapter payload.");
    }

    return entry;
  });
}

function isCloudAsrSegmentUpdate(
  value: unknown
): value is CloudAsrSegmentUpdate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.continuityKey === "string" &&
    typeof candidate.text === "string" &&
    typeof candidate.isFinal === "boolean" &&
    typeof candidate.startMs === "number" &&
    typeof candidate.endMs === "number" &&
    typeof candidate.sequence === "number" &&
    (candidate.revision === undefined || typeof candidate.revision === "number")
  );
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Response(blob).arrayBuffer();
}
