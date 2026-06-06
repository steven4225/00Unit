import { WebSocketServer, type RawData, WebSocket } from "ws";
import {
  FunAsrWebSocketProvider,
  type FunAsrWebSocketProviderOptions
} from "../lib/asr/funasr-websocket-provider";
import {
  createProjectCloudAsrAdapterServer,
  normalizeRawData
} from "../lib/asr/project-cloud-asr-adapter-server";

const adapterPort = Number(process.env.CLOUD_ASR_ADAPTER_PORT ?? 3210);
const funAsrUrl = process.env.FUNASR_WEBSOCKET_URL;

if (!funAsrUrl) {
  throw new Error("Missing FUNASR_WEBSOCKET_URL");
}

const adapterPath = process.env.CLOUD_ASR_ADAPTER_PATH ?? "/cloud-asr-adapter";

const adapterServer = createProjectCloudAsrAdapterServer({
  port: adapterPort,
  path: adapterPath,
  createProvider: () =>
    new FunAsrWebSocketProvider({
      url: funAsrUrl,
      createWebSocket: (url) => createNodeCompatibleSocket(url)
    })
});
const { server } = adapterServer;

server.on("listening", () => {
  console.log(
    `Project cloud-asr adapter listening on ws://localhost:${adapterPort}${adapterPath}`
  );
});

process.on("SIGINT", () => {
  void adapterServer.shutdown().finally(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  void adapterServer.shutdown().finally(() => {
    process.exit(0);
  });
});

type FunAsrBrowserSocket = NonNullable<
  FunAsrWebSocketProviderOptions["createWebSocket"]
> extends (url: string) => infer T
  ? T
  : never;

function createNodeCompatibleSocket(url: string): FunAsrBrowserSocket {
  const socket = new WebSocket(url);

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
  } as FunAsrBrowserSocket;
}
