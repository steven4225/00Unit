import { randomUUID } from "node:crypto";
import type { AudioInputChunk } from "../audio/audio-input-source";
import type {
  CloudAsrProviderClient,
  CloudAsrProviderConnection
} from "./cloud-asr-provider";
import {
  createAliyunFunAsrMessageMapper,
  type AliyunFunAsrMessageMapper,
  type AliyunFunAsrServerEvent
} from "./aliyun-funasr-message-mapper.ts";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";

type WebSocketLike = {
  readyState: number;
  binaryType: string;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(
    type: "message",
    listener: (event: { data: string | ArrayBuffer | Blob }) => void
  ): void;
  addEventListener(type: "error", listener: (event: unknown) => void): void;
  send(data: string | ArrayBufferLike | Blob): void;
  close(): void;
};

type WebSocketFactory = (
  url: string,
  options: { headers: Record<string, string> }
) => WebSocketLike;

export interface AliyunFunAsrRealtimeProviderOptions {
  apiKey: string;
  model: string;
  url?: string;
  workspaceId?: string;
  languageHints?: Array<"zh" | "en" | "ja">;
  format?: "pcm" | "wav" | "mp3" | "opus" | "speex" | "aac" | "amr";
  sampleRate?: 8000 | 16000;
  semanticPunctuationEnabled?: boolean;
  maxSentenceSilence?: number;
  heartbeat?: boolean;
  mapper?: AliyunFunAsrMessageMapper;
  createWebSocket?: WebSocketFactory;
  createTaskId?: () => string;
}

const DEFAULT_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference";

export class AliyunFunAsrRealtimeProvider
  implements CloudAsrProviderClient<CloudAsrSegmentUpdate>
{
  private readonly apiKey: string;
  private readonly model: string;
  private readonly url: string;
  private readonly workspaceId?: string;
  private readonly languageHints?: Array<"zh" | "en" | "ja">;
  private readonly format: NonNullable<AliyunFunAsrRealtimeProviderOptions["format"]>;
  private readonly sampleRate: NonNullable<AliyunFunAsrRealtimeProviderOptions["sampleRate"]>;
  private readonly semanticPunctuationEnabled?: boolean;
  private readonly maxSentenceSilence?: number;
  private readonly heartbeat?: boolean;
  private readonly mapper: AliyunFunAsrMessageMapper;
  private readonly createWebSocket: WebSocketFactory;
  private readonly createTaskId: () => string;

  constructor(options: AliyunFunAsrRealtimeProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.url = options.url ?? DEFAULT_URL;
    this.workspaceId = options.workspaceId;
    this.languageHints = options.languageHints;
    this.format = options.format ?? "pcm";
    this.sampleRate = options.sampleRate ?? 16000;
    this.semanticPunctuationEnabled = options.semanticPunctuationEnabled;
    this.maxSentenceSilence = options.maxSentenceSilence;
    this.heartbeat = options.heartbeat;
    this.mapper = options.mapper ?? createAliyunFunAsrMessageMapper();
    this.createWebSocket = options.createWebSocket ?? defaultCreateWebSocket;
    this.createTaskId = options.createTaskId ?? (() => randomUUID());
  }

  async connect(handlers: {
    onEvent: (event: CloudAsrSegmentUpdate) => void;
    onError?: (error: unknown) => void;
  }): Promise<CloudAsrProviderConnection> {
    const taskId = this.createTaskId();
    const socket = this.createWebSocket(this.url, {
      headers: buildHeaders(this.apiKey, this.workspaceId)
    });
    socket.binaryType = "arraybuffer";

    return new Promise<CloudAsrProviderConnection>((resolve, reject) => {
      let opened = false;
      let started = false;
      let settled = false;

      socket.addEventListener("open", () => {
        opened = true;
        socket.send(
          JSON.stringify(
            buildRunTaskMessage({
              taskId,
              model: this.model,
              format: this.format,
              sampleRate: this.sampleRate,
              languageHints: this.languageHints,
              semanticPunctuationEnabled: this.semanticPunctuationEnabled,
              maxSentenceSilence: this.maxSentenceSilence,
              heartbeat: this.heartbeat
            })
          )
        );
      });

      socket.addEventListener("message", async (event) => {
        try {
          const payload = await resolveMessageData(event.data);
          if (!payload) {
            return;
          }

          const message = JSON.parse(payload) as AliyunFunAsrServerEvent;
          const type = message.header?.event;

          if (type === "task-started") {
            started = true;
            settled = true;
            resolve({
              sendAudioChunk: async (chunk: AudioInputChunk) => {
                socket.send(await readBlobAsArrayBuffer(chunk.blob));
              },
              close: async () => {
                if (socket.readyState === 1) {
                  socket.send(JSON.stringify(buildFinishTaskMessage(taskId)));
                }
                socket.close();
              }
            });
            return;
          }

          if (type === "task-failed") {
            const error = new Error(
              message.header?.error_message ??
                "Aliyun Fun-ASR realtime task failed."
            );
            if (!settled) {
              settled = true;
              reject(error);
              return;
            }

            handlers.onError?.(error);
            return;
          }

          for (const update of this.mapper.map(message)) {
            handlers.onEvent(update);
          }
        } catch (error) {
          if (!settled && !started) {
            settled = true;
            reject(error);
            return;
          }

          handlers.onError?.(error);
        }
      });

      socket.addEventListener("error", (error) => {
        if (!settled && !opened) {
          settled = true;
          reject(new Error("Failed to connect to the Aliyun Fun-ASR realtime websocket provider."));
          return;
        }

        handlers.onError?.(error);
      });
    });
  }
}

function buildHeaders(apiKey: string, workspaceId?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`
  };

  if (workspaceId) {
    headers["X-DashScope-WorkSpace"] = workspaceId;
  }

  return headers;
}

function buildRunTaskMessage(options: {
  taskId: string;
  model: string;
  format: string;
  sampleRate: number;
  languageHints?: string[];
  semanticPunctuationEnabled?: boolean;
  maxSentenceSilence?: number;
  heartbeat?: boolean;
}) {
  const parameters: Record<string, unknown> = {
    format: options.format,
    sample_rate: options.sampleRate
  };

  if (options.languageHints?.length) {
    parameters.language_hints = options.languageHints;
  }

  if (typeof options.semanticPunctuationEnabled === "boolean") {
    parameters.semantic_punctuation_enabled =
      options.semanticPunctuationEnabled;
  }

  if (typeof options.maxSentenceSilence === "number") {
    parameters.max_sentence_silence = options.maxSentenceSilence;
  }

  if (typeof options.heartbeat === "boolean") {
    parameters.heartbeat = options.heartbeat;
  }

  return {
    header: {
      action: "run-task",
      task_id: options.taskId,
      streaming: "duplex"
    },
    payload: {
      task_group: "audio",
      task: "asr",
      function: "recognition",
      model: options.model,
      parameters,
      input: {}
    }
  };
}

function buildFinishTaskMessage(taskId: string) {
  return {
    header: {
      action: "finish-task",
      task_id: taskId,
      streaming: "duplex"
    },
    payload: {
      input: {}
    }
  };
}

function defaultCreateWebSocket(
  _url: string,
  _options: { headers: Record<string, string> }
): WebSocketLike {
  throw new Error(
    "AliyunFunAsrRealtimeProvider requires a custom createWebSocket implementation."
  );
}

async function resolveMessageData(
  data: string | ArrayBuffer | Blob
): Promise<string> {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof Blob) {
    return data.text();
  }

  return new TextDecoder().decode(data);
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Response(blob).arrayBuffer();
}
