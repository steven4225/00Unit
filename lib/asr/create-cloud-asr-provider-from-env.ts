import {
  AliyunFunAsrRealtimeProvider,
  type AliyunFunAsrRealtimeProviderOptions
} from "./aliyun-funasr-realtime-provider";
import type { CloudAsrProviderClient } from "./cloud-asr-provider";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";
import { FunAsrWebSocketProvider } from "./funasr-websocket-provider";
import {
  createNodeAliyunFunAsrSocket,
  createNodeFunAsrSocket
} from "./node-compatible-websocket";

type ProviderName = "funasr" | "aliyun-funasr";

interface CreateCloudAsrProviderFromEnvOptions {
  env?: NodeJS.ProcessEnv;
  createFunAsrSocket?: NonNullable<
    ConstructorParameters<typeof FunAsrWebSocketProvider>[0]["createWebSocket"]
  >;
  createAliyunSocket?: NonNullable<
    AliyunFunAsrRealtimeProviderOptions["createWebSocket"]
  >;
}

export function createCloudAsrProviderFromEnv(
  options: CreateCloudAsrProviderFromEnvOptions = {}
): CloudAsrProviderClient<CloudAsrSegmentUpdate> {
  const env = options.env ?? process.env;
  const providerName = (env.CLOUD_ASR_PROVIDER ?? "funasr") as ProviderName;

  if (providerName === "aliyun-funasr") {
    const apiKey = env.DASHSCOPE_API_KEY ?? env.ALIYUN_DASHSCOPE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing DASHSCOPE_API_KEY for aliyun-funasr cloud-asr provider.");
    }

    const model = env.ALIYUN_FUNASR_MODEL ?? "fun-asr-realtime-2026-02-28";
    const languageHint = env.ALIYUN_FUNASR_LANGUAGE_HINT as
      | "zh"
      | "en"
      | "ja"
      | undefined;
    const languageHints =
      languageHint === "zh" || languageHint === "en" || languageHint === "ja"
        ? [languageHint]
        : undefined;

    return new AliyunFunAsrRealtimeProvider({
      apiKey,
      model,
      url: env.ALIYUN_FUNASR_WEBSOCKET_URL,
      workspaceId: env.ALIYUN_WORKSPACE_ID,
      languageHints,
      createWebSocket: options.createAliyunSocket ?? createNodeAliyunFunAsrSocket
    });
  }

  const funAsrUrl = env.FUNASR_WEBSOCKET_URL;
  if (!funAsrUrl) {
    throw new Error("Missing FUNASR_WEBSOCKET_URL for funasr cloud-asr provider.");
  }

  return new FunAsrWebSocketProvider({
    url: funAsrUrl,
    createWebSocket: options.createFunAsrSocket ?? createNodeFunAsrSocket
  });
}
