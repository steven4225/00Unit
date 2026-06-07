import { describe, expect, it, vi } from "vitest";
import { AliyunFunAsrRealtimeProvider } from "./aliyun-funasr-realtime-provider";

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

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
    },
    emitMessage(data: unknown) {
      listeners.message.forEach((listener) => listener({ data }));
    },
    emitError(error: unknown) {
      listeners.error.forEach((listener) => listener(error));
    }
  };
}

describe("AliyunFunAsrRealtimeProvider", () => {
  it("opens a websocket with authorization headers and sends run-task before resolving", async () => {
    const harness = createSocketHarness();
    const createWebSocket = vi.fn(() => harness.socket);
    const provider = new AliyunFunAsrRealtimeProvider({
      apiKey: "test-key",
      model: "fun-asr-realtime-2026-02-28",
      languageHints: ["en"],
      createTaskId: () => "task-123",
      createWebSocket
    });

    const connectionPromise = provider.connect({
      onEvent: vi.fn()
    });

    harness.emitOpen();

    expect(createWebSocket).toHaveBeenCalledWith(
      "wss://dashscope.aliyuncs.com/api-ws/v1/inference",
      {
        headers: {
          Authorization: "Bearer test-key"
        }
      }
    );
    expect(harness.socket.send).toHaveBeenCalledWith(
      JSON.stringify({
        header: {
          action: "run-task",
          task_id: "task-123",
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
            language_hints: ["en"]
          },
          input: {}
        }
      })
    );

    harness.emitMessage(
      JSON.stringify({
        header: {
          task_id: "task-123",
          event: "task-started",
          attributes: {}
        },
        payload: {}
      })
    );

    const connection = await connectionPromise;
    await connection.close();

    expect(harness.socket.send).toHaveBeenLastCalledWith(
      JSON.stringify({
        header: {
          action: "finish-task",
          task_id: "task-123",
          streaming: "duplex"
        },
        payload: {
          input: {}
        }
      })
    );
    expect(harness.socket.close).toHaveBeenCalledTimes(1);
  });

  it("maps result-generated events into normalized segment updates", async () => {
    const harness = createSocketHarness();
    const onEvent = vi.fn();
    const provider = new AliyunFunAsrRealtimeProvider({
      apiKey: "test-key",
      model: "fun-asr-realtime-2026-02-28",
      createTaskId: () => "task-456",
      createWebSocket: () => harness.socket
    });

    const connectionPromise = provider.connect({
      onEvent
    });
    harness.emitOpen();
    harness.emitMessage(
      JSON.stringify({
        header: {
          task_id: "task-456",
          event: "task-started",
          attributes: {}
        },
        payload: {}
      })
    );
    await connectionPromise;

    harness.emitMessage(
      JSON.stringify({
        header: {
          task_id: "task-456",
          event: "result-generated",
          attributes: {}
        },
        payload: {
          output: {
            sentence: {
              sentence_id: 2,
              text: "real time captions",
              begin_time: 80,
              end_time: 620,
              sentence_end: false,
              heartbeat: false
            }
          }
        }
      })
    );
    await flushAsyncWork();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        continuityKey: "aliyun:task-456:sentence:2",
        text: "real time captions",
        isFinal: false,
        startMs: 80,
        endMs: 620
      })
    );
  });

  it("includes optional sentence-boundary tuning parameters in the run-task payload", async () => {
    const harness = createSocketHarness();
    const provider = new AliyunFunAsrRealtimeProvider({
      apiKey: "test-key",
      model: "fun-asr-realtime-2026-02-28",
      semanticPunctuationEnabled: false,
      maxSentenceSilence: 650,
      multiThresholdModeEnabled: true,
      createTaskId: () => "task-boundary",
      createWebSocket: () => harness.socket
    });

    void provider.connect({
      onEvent: vi.fn()
    });

    harness.emitOpen();

    expect(harness.socket.send).toHaveBeenCalledWith(
      JSON.stringify({
        header: {
          action: "run-task",
          task_id: "task-boundary",
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
            semantic_punctuation_enabled: false,
            max_sentence_silence: 650,
            multi_threshold_mode_enabled: true
          },
          input: {}
        }
      })
    );
  });

  it("surfaces task-failed events through the provider error handler", async () => {
    const harness = createSocketHarness();
    const onError = vi.fn();
    const provider = new AliyunFunAsrRealtimeProvider({
      apiKey: "test-key",
      model: "fun-asr-realtime-2026-02-28",
      createTaskId: () => "task-789",
      createWebSocket: () => harness.socket
    });

    const connectionPromise = provider.connect({
      onEvent: vi.fn(),
      onError
    });
    harness.emitOpen();
    harness.emitMessage(
      JSON.stringify({
        header: {
          task_id: "task-789",
          event: "task-started",
          attributes: {}
        },
        payload: {}
      })
    );
    await connectionPromise;

    harness.emitMessage(
      JSON.stringify({
        header: {
          task_id: "task-789",
          event: "task-failed",
          error_code: "CLIENT_ERROR",
          error_message: "request timeout after 23 seconds.",
          attributes: {}
        },
        payload: {}
      })
    );
    await flushAsyncWork();

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "request timeout after 23 seconds."
      })
    );
  });
});
