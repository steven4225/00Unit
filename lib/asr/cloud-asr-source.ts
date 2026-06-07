import type {
  AudioInputSource,
  AudioInputChunk
} from "../audio/audio-input-source";
import type { TranscriptEvent } from "../schemas/transcript";
import type {
  CloudAsrProviderClient,
  CloudAsrProviderConnection
} from "./cloud-asr-provider";

export type CloudAsrEventNormalizer<TRawEvent = unknown> = (
  event: TRawEvent
) => TranscriptEvent[];

export interface CloudAsrSourceCallbacks {
  onEvent: (event: TranscriptEvent) => void;
  onError?: (error: unknown) => void;
  onInputActivity?: (chunk: AudioInputChunk) => void;
  onProviderActivity?: () => void;
}

export interface CloudAsrSourceOptions<TRawEvent = unknown> {
  audioInput: AudioInputSource;
  provider: CloudAsrProviderClient<TRawEvent>;
  normalizeEvent: CloudAsrEventNormalizer<TRawEvent>;
}

export class CloudAsrSource<TRawEvent = unknown> {
  private readonly audioInput: AudioInputSource;
  private readonly provider: CloudAsrProviderClient<TRawEvent>;
  private readonly normalizeEvent: CloudAsrEventNormalizer<TRawEvent>;
  private connection: CloudAsrProviderConnection | null = null;
  private callbacks: CloudAsrSourceCallbacks | null = null;

  constructor(options: CloudAsrSourceOptions<TRawEvent>) {
    this.audioInput = options.audioInput;
    this.provider = options.provider;
    this.normalizeEvent = options.normalizeEvent;
  }

  async start(callbacks: CloudAsrSourceCallbacks): Promise<void> {
    if (this.connection) {
      throw new Error("CloudAsrSource is already running.");
    }

    this.callbacks = callbacks;
    this.connection = await this.provider.connect({
      onEvent: (event) => {
        this.callbacks?.onProviderActivity?.();
        for (const normalizedEvent of this.normalizeEvent(event)) {
          this.callbacks?.onEvent(normalizedEvent);
        }
      },
      onError: (error) => {
        this.callbacks?.onError?.(error);
      }
    });

    try {
      await this.audioInput.start(
        (chunk) => {
          this.forwardChunk(chunk);
        },
        {
          onEnded: (reason) => {
            void this.handleAudioInputEnded(reason);
          }
        }
      );
    } catch (error) {
      await this.connection.close();
      this.connection = null;
      this.callbacks = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.audioInput.stop();

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    this.callbacks = null;
  }

  private forwardChunk(chunk: AudioInputChunk) {
    this.callbacks?.onInputActivity?.(chunk);
    void this.connection
      ?.sendAudioChunk(chunk)
      .catch((error) => this.callbacks?.onError?.(error));
  }

  private async handleAudioInputEnded(reason: unknown) {
    const activeCallbacks = this.callbacks;

    try {
      await this.stop();
    } catch (error) {
      activeCallbacks?.onError?.(error);
      return;
    }

    activeCallbacks?.onError?.(
      reason ?? new Error("The active audio input session ended unexpectedly.")
    );
  }
}
