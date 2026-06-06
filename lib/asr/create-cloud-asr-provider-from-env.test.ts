import { describe, expect, it, vi } from "vitest";
import { createCloudAsrProviderFromEnv } from "./create-cloud-asr-provider-from-env";

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
    const socket = {
      readyState: 0,
      binaryType: "blob",
      addEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn()
    };
    const createAliyunSocket = vi.fn(() => socket);

    const provider = createCloudAsrProviderFromEnv({
      env: {
        CLOUD_ASR_PROVIDER: "aliyun-funasr",
        DASHSCOPE_API_KEY: "test-key",
        ALIYUN_FUNASR_MODEL: "fun-asr-realtime-2026-02-28",
        ALIYUN_FUNASR_LANGUAGE_HINT: "en"
      },
      createAliyunSocket
    });

    void provider.connect({
      onEvent: vi.fn()
    });

    expect(createAliyunSocket).toHaveBeenCalledWith(
      "wss://dashscope.aliyuncs.com/api-ws/v1/inference",
      {
        headers: {
          Authorization: "Bearer test-key"
        }
      }
    );
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
