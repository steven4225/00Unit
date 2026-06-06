import { WebSocketServer, type RawData, WebSocket } from "ws";
import { ProjectCloudAsrAdapterSession } from "./project-cloud-asr-adapter-session";
import type {
  CloudAsrProviderClient
} from "./cloud-asr-provider";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";

export interface ProjectCloudAsrAdapterSessionLike {
  start(): Promise<void>;
  handleBinaryMessage(data: ArrayBuffer | ArrayBufferView | Buffer): Promise<void>;
  stop(): Promise<void>;
}

interface BrowserSocketLike {
  send(data: string | ArrayBufferLike | Blob): void;
  close(code?: number, reason?: string): void;
}

interface ProjectCloudAsrAdapterServerOptions {
  port: number;
  path: string;
  createProvider: () => CloudAsrProviderClient<CloudAsrSegmentUpdate>;
  createSession?: (
    browserSocket: BrowserSocketLike,
    provider: CloudAsrProviderClient<CloudAsrSegmentUpdate>
  ) => ProjectCloudAsrAdapterSessionLike;
}

export function createProjectCloudAsrAdapterServer(
  options: ProjectCloudAsrAdapterServerOptions
) {
  const createSession =
    options.createSession ??
    ((browserSocket, provider) =>
      new ProjectCloudAsrAdapterSession(browserSocket, provider));
  const activeSessions = new Map<WebSocket, ProjectCloudAsrAdapterSessionLike>();
  const server = new WebSocketServer({
    port: options.port,
    path: options.path
  });

  server.on("connection", async (socket) => {
    const session = createSession(
      {
        send(data) {
          socket.send(data);
        },
        close(code, reason) {
          socket.close(code, reason);
        }
      },
      options.createProvider()
    );
    activeSessions.set(socket, session);

    try {
      await session.start();
    } catch (error) {
      activeSessions.delete(socket);
      await session.stop();
      const reason =
        error instanceof Error
          ? error.message
          : "Failed to start the project cloud-asr adapter session.";
      socket.close(1011, reason);
      return;
    }

    socket.on("message", async (data, isBinary) => {
      if (!isBinary) {
        return;
      }

      try {
        await session.handleBinaryMessage(normalizeRawData(data));
      } catch (error) {
        const reason =
          error instanceof Error
            ? error.message
            : "Failed to forward browser audio to the cloud-asr provider.";
        socket.close(1011, reason);
      }
    });

    socket.on("close", () => {
      activeSessions.delete(socket);
      void session.stop();
    });

    socket.on("error", () => {
      activeSessions.delete(socket);
      void session.stop();
    });
  });

  return {
    server,
    async shutdown() {
      const sockets = Array.from(activeSessions.keys());
      const sessions = Array.from(activeSessions.values());
      activeSessions.clear();

      for (const socket of sockets) {
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close(1001, "Project cloud-asr adapter shutting down.");
        }
      }

      await Promise.allSettled(sessions.map((session) => session.stop()));
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

export function normalizeRawData(
  data: RawData
): ArrayBuffer | ArrayBufferView | Buffer {
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }

  return data;
}
