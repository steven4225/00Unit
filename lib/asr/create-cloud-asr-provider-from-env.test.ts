import { describe, expect, it, vi } from "vitest";
import { createCloudAsrProviderFromEnv } from "./create-cloud-asr-provider-from-env";

function createSocketHarness() {
  const listeners: Record<string, Array<(event?: unknown) => void>> = {
    open: [],
    message: [],
    error: []
  };
  const socket = {
    readyState: 0,
    binaryType: "blob",
    addEventListener(type: "open" | "message" | "error", listener: (event?: unknown) => void) {
      listeners[type].push(listener);
    },
    send: vi.fn(),
    close: vi.fn()
  };

  return {
    socket,
    emitOpen() {
      socket.readyState = 1;
      listeners.open.forEach((listener) => listener());
    }
  };
}

describe("createCloudAsrProviderFromEnv", () => {
  it("defaults to the existing funasr websocket provider", async () => {
    const socket = {
      readyState: 0,
      binaryType: "blob",
      addEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn()
    };
    const createFunAsrSocket = vi.fn(() => socket);

    const provider = createCloudAsrProviderFromEnv({
      env: {
        FUNASR_WEBSOCKET_URL: "ws://127.0.0.1:10095"
      },
      createFunAsrSocket
    });

    void provider.connect({
      onEvent: vi.fn()
    });

    expect(createFunAsrSocket).toHaveBeenCalledWith("ws://127.0.0.1:10095");
  });

  it("creates an aliyun provider when CLOUD_ASR_PROVIDER is aliyun-funasr", async () => {
    const harness = createSocketHarness();
    const createAliyunSocket = vi.fn(() => harness.socket);

    const provider = createCloudAsrProviderFromEnv({
      env: {
        CLOUD_ASR_PROVIDER: "aliyun-funasr",
        DASHSCOPE_API_KEY: "test-key",
        ALIYUN_FUNASR_MODEL: "fun-asr-realtime-2026-02-28",
        ALIYUN_FUNASR_LANGUAGE_HINT: "en",
        ALIYUN_FUNASR_SEMANTIC_PUNCTUATION_ENABLED: "false",
        ALIYUN_FUNASR_MAX_SENTENCE_SILENCE: "700",
        ALIYUN_FUNASR_MULTI_THRESHOLD_MODE_ENABLED: "true"
      },
      createAliyunSocket
    });

    void provider.connect({
      onEvent: vi.fn()
    });
    harness.emitOpen();

    expect(createAliyunSocket).toHaveBeenCalledWith(
      "wss://dashscope.aliyuncs.com/api-ws/v1/inference",
      {
        headers: {
          Authorization: "Bearer test-key"
        }
      }
    );
    const sentRunTaskPayload = JSON.parse(String(harness.socket.send.mock.calls[0]?.[0]));
    expect(sentRunTaskPayload).toMatchObject({
      header: {
        action: "run-task",
        streaming: "duplex"
      },
      payload: {
        task_group: "audio",
        task: "asr",
        function: "recognition",
        model: "fun-asr-realtime-2026-02-28",
        parameters: {
          format: "pcm",
          sample_rate: 16000,
          language_hints: ["en"],
          semantic_punctuation_enabled: false,
          max_sentence_silence: 700,
          multi_threshold_mode_enabled: true
        },
        input: {}
      }
    });
    expect(sentRunTaskPayload.header.task_id).toEqual(expect.any(String));
  });

  it("fails fast when aliyun-funasr is selected without an api key", () => {
    expect(() =>
      createCloudAsrProviderFromEnv({
        env: {
          CLOUD_ASR_PROVIDER: "aliyun-funasr"
        }
      })
    ).toThrow("Missing DASHSCOPE_API_KEY");
  });
});
