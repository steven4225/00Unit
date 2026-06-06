import type {
  AudioInputChunk,
  AudioInputChunkHandler,
  AudioInputSource
} from "./audio-input-source";

type AudioInputErrorCode =
  | "permission-denied"
  | "device-unavailable"
  | "not-supported"
  | "start-failed";

type BrowserMicrophoneInputOptions = {
  mimeType?: string;
  timesliceMs?: number;
  getUserMedia?: typeof navigator.mediaDevices.getUserMedia;
  createRecorder?: (
    stream: MediaStream,
    options?: MediaRecorderOptions
  ) => MediaRecorder;
};

export class AudioInputError extends Error {
  readonly code: AudioInputErrorCode;

  constructor(code: AudioInputErrorCode, message: string) {
    super(message);
    this.name = "AudioInputError";
    this.code = code;
  }
}

export class BrowserMicrophoneInput implements AudioInputSource {
  private readonly mimeType: string;
  private readonly timesliceMs: number;
  private readonly getUserMediaImpl?: typeof navigator.mediaDevices.getUserMedia;
  private readonly createRecorderImpl?: (
    stream: MediaStream,
    options?: MediaRecorderOptions
  ) => MediaRecorder;

  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private sequence = 0;

  constructor(options: BrowserMicrophoneInputOptions = {}) {
    this.mimeType = options.mimeType ?? "audio/webm";
    this.timesliceMs = options.timesliceMs ?? 500;
    this.getUserMediaImpl = options.getUserMedia;
    this.createRecorderImpl = options.createRecorder;
  }

  async start(onChunk: AudioInputChunkHandler) {
    if (this.recorder) {
      return;
    }

    const getUserMedia = this.resolveGetUserMedia();
    const createRecorder = this.resolveRecorderFactory();

    let stream: MediaStream | null = null;

    try {
      stream = await getUserMedia({
        audio: true
      });

      const recorder = createRecorder(stream, {
        mimeType: this.mimeType
      });

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) {
          return;
        }

        const chunk: AudioInputChunk = {
          sequence: this.sequence,
          mimeType: event.data.type || this.mimeType,
          blob: event.data
        };

        this.sequence += 1;
        onChunk(chunk);
      };

      recorder.start(this.timesliceMs);
      this.stream = stream;
      this.recorder = recorder;
    } catch (error) {
      if (stream) {
        this.stopTracks(stream);
      }

      throw this.mapStartError(error);
    }
  }

  stop() {
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }

    if (this.stream) {
      this.stopTracks(this.stream);
      this.stream = null;
    }

    this.sequence = 0;
  }

  private resolveGetUserMedia() {
    const getUserMedia =
      this.getUserMediaImpl ?? globalThis.navigator?.mediaDevices?.getUserMedia;

    if (!getUserMedia) {
      throw new AudioInputError(
        "not-supported",
        "Browser microphone capture is not available in this environment."
      );
    }

    return getUserMedia.bind(globalThis.navigator.mediaDevices);
  }

  private resolveRecorderFactory() {
    if (this.createRecorderImpl) {
      return this.createRecorderImpl;
    }

    const Recorder = globalThis.MediaRecorder;

    if (!Recorder) {
      throw new AudioInputError(
        "not-supported",
        "MediaRecorder is not available in this environment."
      );
    }

    return (stream: MediaStream, options?: MediaRecorderOptions) =>
      new Recorder(stream, options);
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
          "Microphone permission was denied."
        );
      }

      if (
        error.name === "NotFoundError" ||
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        return new AudioInputError(
          "device-unavailable",
          "No readable microphone input is currently available."
        );
      }
    }

    return new AudioInputError(
      "start-failed",
      "Browser microphone input could not be started."
    );
  }
}
