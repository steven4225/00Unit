import { WebSocketServer, type RawData, WebSocket } from "ws";
import { createCloudAsrProviderFromEnv } from "../lib/asr/create-cloud-asr-provider-from-env";
import {
  createProjectCloudAsrAdapterServer,
  normalizeRawData
} from "../lib/asr/project-cloud-asr-adapter-server";
import {
  createNodeAliyunFunAsrSocket,
  createNodeFunAsrSocket
} from "../lib/asr/node-compatible-websocket";

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
