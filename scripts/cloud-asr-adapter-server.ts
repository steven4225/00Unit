import { WebSocketServer, type RawData, WebSocket } from "ws";
import { loadProjectEnv } from "../lib/env/load-project-env.ts";
import { createCloudAsrProviderFromEnv } from "../lib/asr/create-cloud-asr-provider-from-env.ts";
import {
  createProjectCloudAsrAdapterServer,
  normalizeRawData
} from "../lib/asr/project-cloud-asr-adapter-server.ts";
import {
  createNodeAliyunFunAsrSocket,
  createNodeFunAsrSocket
} from "../lib/asr/node-compatible-websocket.ts";

loadProjectEnv();

const adapterPort = Number(process.env.CLOUD_ASR_ADAPTER_PORT ?? 3210);
const adapterPath = process.env.CLOUD_ASR_ADAPTER_PATH ?? "/cloud-asr-adapter";

const adapterServer = createProjectCloudAsrAdapterServer({
  port: adapterPort,
  path: adapterPath,
  createProvider: () =>
    createCloudAsrProviderFromEnv({
      createFunAsrSocket: createNodeFunAsrSocket,
      createAliyunSocket: createNodeAliyunFunAsrSocket
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
