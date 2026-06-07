import type {
  AudioInputChunk,
  AudioInputChunkHandler,
  AudioInputLifecycleCallbacks,
  AudioInputSource
} from "./audio-input-source";
import { AudioInputError } from "./browser-microphone-input";

type AudioContextLike = {
  readonly state?: "suspended" | "running" | "closed";
  readonly sampleRate: number;
  readonly destination: unknown;
  createMediaStreamSource(stream: MediaStream): MediaStreamSourceNodeLike;
  createScriptProcessor(
    bufferSize: number,
    numberOfInputChannels: number,
    numberOfOutputChannels: number
  ): ScriptProcessorNodeLike;
  resume?(): Promise<void>;
  close(): Promise<void>;
};

type MediaStreamSourceNodeLike = {
  connect(target: unknown): void;
  disconnect(): void;
};

type ScriptProcessorNodeLike = {
  onaudioprocess:
    | ((event: { inputBuffer: { getChannelData: (channel: number) => Float32Array } }) => void)
    | null;
  connect(target: unknown): void;
  disconnect(): void;
};

type BrowserTabAudioInputOptions = {
  targetSampleRate?: number;
  bufferSize?: number;
  getDisplayMedia?: typeof navigator.mediaDevices.getDisplayMedia;
  createAudioContext?: () => AudioContextLike;
};

export class BrowserTabAudioInput implements AudioInputSource {
  private readonly targetSampleRate: number;
  private readonly bufferSize: number;
  private readonly getDisplayMediaImpl?: typeof navigator.mediaDevices.getDisplayMedia;
  private readonly createAudioContextImpl?: () => AudioContextLike;

  private audioContext: AudioContextLike | null = null;
  private mediaStreamSource: MediaStreamSourceNodeLike | null = null;
  private processorNode: ScriptProcessorNodeLike | null = null;
  private stream: MediaStream | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private sequence = 0;

  constructor(options: BrowserTabAudioInputOptions = {}) {
    this.targetSampleRate = options.targetSampleRate ?? 16_000;
    this.bufferSize = options.bufferSize ?? 4096;
    this.getDisplayMediaImpl = options.getDisplayMedia;
    this.createAudioContextImpl = options.createAudioContext;
  }

  async start(
    onChunk: AudioInputChunkHandler,
    callbacks?: AudioInputLifecycleCallbacks
  ) {
    if (this.audioContext) {
      return;
    }

    const getDisplayMedia = this.resolveGetDisplayMedia();
    const createAudioContext = this.resolveAudioContextFactory();

    let stream: MediaStream | null = null;
    let audioContext: AudioContextLike | null = null;

    try {
      stream = await getDisplayMedia({
        video: true,
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const audioTrack =
        typeof stream.getAudioTracks === "function"
          ? stream.getAudioTracks()[0] ?? null
          : null;

      if (!audioTrack) {
        throw new AudioInputError(
          "device-unavailable",
          "No readable browser tab audio track is available from the current share."
        );
      }

      audioContext = createAudioContext();
      const activeAudioContext = audioContext;
      const mediaStreamSource = activeAudioContext.createMediaStreamSource(stream);
      const processorNode = activeAudioContext.createScriptProcessor(
        this.bufferSize,
        1,
        1
      );

      processorNode.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleToTargetRate(
          input,
          activeAudioContext.sampleRate,
          this.targetSampleRate
        );
        const pcm16 = encodePcm16(downsampled);
        const rmsLevel = calculateRmsLevel(downsampled);

        if (pcm16.byteLength === 0) {
          return;
        }

        const chunk: AudioInputChunk = {
          sequence: this.sequence,
          mimeType: "audio/pcm",
          rmsLevel,
          blob: new Blob(
            [
              new Uint8Array(
                pcm16.buffer,
                pcm16.byteOffset,
                pcm16.byteLength
              )
            ],
            { type: "audio/pcm" }
          )
        };

        this.sequence += 1;
        onChunk(chunk);
      };

      mediaStreamSource.connect(processorNode);
      processorNode.connect(activeAudioContext.destination);

      if (
        typeof activeAudioContext.resume === "function" &&
        activeAudioContext.state !== "running"
      ) {
        await activeAudioContext.resume();
      }

      audioTrack.onended = () => {
        const shareEndedError = new AudioInputError(
          "device-unavailable",
          "Browser tab audio sharing ended. Start a new share to continue."
        );
        this.stop();
        callbacks?.onEnded?.(shareEndedError);
      };

      this.stream = stream;
      this.audioTrack = audioTrack;
      this.audioContext = audioContext;
      this.mediaStreamSource = mediaStreamSource;
      this.processorNode = processorNode;
    } catch (error) {
      if (audioContext) {
        void audioContext.close();
      }

      if (stream) {
        this.stopTracks(stream);
      }

      throw this.mapStartError(error);
    }
  }

  stop() {
    if (this.audioTrack) {
      this.audioTrack.onended = null;
    }

    this.processorNode?.disconnect();
    this.mediaStreamSource?.disconnect();

    if (this.audioContext) {
      void this.audioContext.close();
    }

    if (this.stream) {
      this.stopTracks(this.stream);
    }

    this.processorNode = null;
    this.mediaStreamSource = null;
    this.audioContext = null;
    this.stream = null;
    this.audioTrack = null;
    this.sequence = 0;
  }

  private resolveGetDisplayMedia() {
    const mediaDevices = globalThis.navigator?.mediaDevices;
    const getDisplayMedia =
      this.getDisplayMediaImpl ?? mediaDevices?.getDisplayMedia;

    if (!getDisplayMedia) {
      throw new AudioInputError(
        "not-supported",
        "Browser tab audio capture is not available in this environment."
      );
    }

    return mediaDevices ? getDisplayMedia.bind(mediaDevices) : getDisplayMedia;
  }

  private resolveAudioContextFactory() {
    if (this.createAudioContextImpl) {
      return this.createAudioContextImpl;
    }

    const AudioContextCtor =
      globalThis.AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextCtor) {
      throw new AudioInputError(
        "not-supported",
        "AudioContext is not available in this environment."
      );
    }

    return () => new AudioContextCtor() as unknown as AudioContextLike;
  }

  private stopTracks(stream: MediaStream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  private mapStartError(error: unknown) {
    if (error instanceof AudioInputError) {
      return error;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      typeof error.name === "string"
    ) {
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        return new AudioInputError(
          "permission-denied",
          "Browser tab sharing permission was denied."
        );
      }

      if (
        error.name === "NotFoundError" ||
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        return new AudioInputError(
          "device-unavailable",
          "No readable browser tab audio is currently available."
        );
      }
    }

    return new AudioInputError(
      "start-failed",
      "Browser tab audio input could not be started."
    );
  }
}

function downsampleToTargetRate(
  input: Float32Array,
  inputRate: number,
  targetRate: number
) {
  if (targetRate <= 0 || inputRate <= 0) {
    return new Float32Array();
  }

  if (inputRate === targetRate) {
    return input;
  }

  const ratio = inputRate / targetRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  let inputOffset = 0;

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const nextOffset = Math.min(
      input.length,
      Math.round((outputIndex + 1) * ratio)
    );
    let sum = 0;
    let count = 0;

    for (let index = inputOffset; index < nextOffset; index += 1) {
      sum += input[index] ?? 0;
      count += 1;
    }

    output[outputIndex] = count > 0 ? sum / count : input[inputOffset] ?? 0;
    inputOffset = nextOffset;
  }

  return output;
}

function encodePcm16(input: Float32Array) {
  const output = new Int16Array(input.length);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    output[index] =
      sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }

  return output;
}

function calculateRmsLevel(input: Float32Array) {
  if (input.length === 0) {
    return 0;
  }

  let sumSquares = 0;

  for (let index = 0; index < input.length; index += 1) {
    const sample = input[index] ?? 0;
    sumSquares += sample * sample;
  }

  return Math.min(1, Math.sqrt(sumSquares / input.length));
}
