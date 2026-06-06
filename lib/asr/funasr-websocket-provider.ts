import type { AudioInputChunk } from "../audio/audio-input-source";
import type {
  CloudAsrProviderClient,
  CloudAsrProviderConnection
} from "./cloud-asr-provider";
import {
  createFunAsrMessageMapper,
  type FunAsrMessageMapper,
  type FunAsrServerMessage
} from "./funasr-message-mapper";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";

type WebSocketLike = {
  readyState: number;
  binaryType: string;
  addEventListener(
    type: "open",
    listener: () => void
  ): void;
  addEventListener(
    type: "message",
    listener: (event: { data: string | ArrayBuffer | Blob }) => void
  ): void;
  addEventListener(type: "error", listener: (event: unknown) => void): void;
  send(data: string | ArrayBufferLike | Blob): void;
  close(): void;
};

export interface FunAsrWebSocketProviderOptions {
  url: string;
  createWebSocket?: (url: string) => WebSocketLike;
  mapper?: FunAsrMessageMapper;
  startMessage?: Record<string, unknown> | null;
  stopMessage?: Record<string, unknown> | null;
}

export class FunAsrWebSocketProvider
  implements CloudAsrProviderClient<CloudAsrSegmentUpdate>
{
  private readonly url: string;
  private readonly createWebSocket: (url: string) => WebSocketLike;
  private readonly mapper: FunAsrMessageMapper;
  private readonly startMessage: Record<string, unknown> | null;
  private readonly stopMessage: Record<string, unknown> | null;

  constructor(options: FunAsrWebSocketProviderOptions) {
    this.url = options.url;
    this.createWebSocket = options.createWebSocket ?? defaultCreateWebSocket;
    this.mapper = options.mapper ?? createFunAsrMessageMapper();
    this.startMessage = options.startMessage ?? {
      mode: "2pass"
    };
    this.stopMessage = options.stopMessage ?? {
      is_speaking: false
    };
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

        if (this.startMessage) {
          socket.send(JSON.stringify(this.startMessage));
        }

        resolve({
          sendAudioChunk: async (chunk: AudioInputChunk) => {
            socket.send(await readBlobAsArrayBuffer(chunk.blob));
          },
          close: async () => {
            if (this.stopMessage && socket.readyState === 1) {
              socket.send(JSON.stringify(this.stopMessage));
            }
            socket.close();
          }
        });
      });

      socket.addEventListener("message", async (event) => {
        try {
          const data = await resolveMessageData(event.data);
          if (!data) {
            return;
          }

          const message = JSON.parse(data) as FunAsrServerMessage;
          for (const update of this.mapper.map(message)) {
            handlers.onEvent(update);
          }
        } catch (error) {
          handlers.onError?.(error);
        }
      });

      socket.addEventListener("error", (error) => {
        if (!settled) {
          reject(new Error("Failed to connect to the FunASR websocket provider."));
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

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Response(blob).arrayBuffer();
}
