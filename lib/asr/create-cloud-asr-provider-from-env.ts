import {
  AliyunFunAsrRealtimeProvider,
  type AliyunFunAsrRealtimeProviderOptions
} from "./aliyun-funasr-realtime-provider.ts";
import type { CloudAsrProviderClient } from "./cloud-asr-provider";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";
import { FunAsrWebSocketProvider } from "./funasr-websocket-provider.ts";
import {
  createNodeAliyunFunAsrSocket,
  createNodeFunAsrSocket
} from "./node-compatible-websocket.ts";

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
    const semanticPunctuationEnabled = parseOptionalBoolean(
      env.ALIYUN_FUNASR_SEMANTIC_PUNCTUATION_ENABLED
    );
    const maxSentenceSilence = parseOptionalInteger(
      env.ALIYUN_FUNASR_MAX_SENTENCE_SILENCE
    );
    const multiThresholdModeEnabled = parseOptionalBoolean(
      env.ALIYUN_FUNASR_MULTI_THRESHOLD_MODE_ENABLED
    );

    return new AliyunFunAsrRealtimeProvider({
      apiKey,
      model,
      url: env.ALIYUN_FUNASR_WEBSOCKET_URL,
      workspaceId: env.ALIYUN_WORKSPACE_ID,
      languageHints,
      semanticPunctuationEnabled,
      maxSentenceSilence,
      multiThresholdModeEnabled,
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

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function parseOptionalInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
