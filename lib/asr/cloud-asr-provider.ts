import type { AudioInputChunk } from "../audio/audio-input-source";

export type CloudAsrProviderEventHandler<TRawEvent = unknown> = (
  event: TRawEvent
) => void;

export type CloudAsrProviderErrorHandler = (error: unknown) => void;

export interface CloudAsrProviderConnection {
  sendAudioChunk(chunk: AudioInputChunk): Promise<void>;
  close(): Promise<void>;
}

export interface CloudAsrProviderClient<TRawEvent = unknown> {
  connect(handlers: {
    onEvent: CloudAsrProviderEventHandler<TRawEvent>;
    onError?: CloudAsrProviderErrorHandler;
  }): Promise<CloudAsrProviderConnection>;
}
