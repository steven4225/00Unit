import type { RawData } from "ws";
import { WebSocket } from "ws";
import type { FunAsrWebSocketProviderOptions } from "./funasr-websocket-provider";
import type { AliyunFunAsrRealtimeProviderOptions } from "./aliyun-funasr-realtime-provider";

type FunAsrBrowserSocket = NonNullable<
  FunAsrWebSocketProviderOptions["createWebSocket"]
> extends (url: string) => infer T
  ? T
  : never;

type AliyunBrowserSocket = NonNullable<
  AliyunFunAsrRealtimeProviderOptions["createWebSocket"]
> extends (url: string, options: { headers: Record<string, string> }) => infer T
  ? T
  : never;

export function createNodeFunAsrSocket(url: string): FunAsrBrowserSocket {
  return createNodeCompatibleSocket(url) as FunAsrBrowserSocket;
}

export function createNodeAliyunFunAsrSocket(
  url: string,
  options: { headers: Record<string, string> }
): AliyunBrowserSocket {
  return createNodeCompatibleSocket(url, options) as AliyunBrowserSocket;
}

function createNodeCompatibleSocket(
  url: string,
  options?: { headers: Record<string, string> }
) {
  const socket = new WebSocket(url, {
    headers: options?.headers
  });

  return {
    get readyState() {
      return socket.readyState;
    },
    get binaryType() {
      return socket.binaryType;
    },
    set binaryType(value: string) {
      socket.binaryType = value as "nodebuffer" | "arraybuffer" | "fragments";
    },
    addEventListener(
      type: "open" | "message" | "error",
      listener: (event?: unknown) => void
    ) {
      if (type === "open") {
        socket.on("open", () => listener());
        return;
      }

      if (type === "message") {
        socket.on("message", (data: RawData) => {
          const normalized = normalizeRawData(data);
          listener({
            data:
              typeof normalized === "string"
                ? normalized
                : normalized instanceof ArrayBuffer
                  ? normalized
                  : normalized.buffer.slice(
                      normalized.byteOffset,
                      normalized.byteOffset + normalized.byteLength
                    )
          });
        });
        return;
      }

      socket.on("error", (error) => {
        listener(error);
      });
    },
    send(data: string | ArrayBufferLike | Blob) {
      if (data instanceof Blob) {
        void data.arrayBuffer().then((buffer) => {
          socket.send(Buffer.from(buffer));
        });
        return;
      }

      socket.send(data);
    },
    close() {
      socket.close();
    }
  };
}

function normalizeRawData(
  data: RawData
): ArrayBuffer | ArrayBufferView | Buffer | string {
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }

  return data;
}
