import type { AudioInputChunk } from "../audio/audio-input-source";
import type {
  CloudAsrProviderClient,
  CloudAsrProviderConnection
} from "./cloud-asr-provider";
import type { CloudAsrSegmentUpdate } from "./cloud-asr-transcript-normalizer";

export type AdapterBrowserSocket = {
  send(data: string | ArrayBufferLike | Blob): void;
  close(code?: number, reason?: string): void;
};

export class ProjectCloudAsrAdapterSession {
  private providerConnection: CloudAsrProviderConnection | null = null;
  private browserClosed = false;
  private sequence = 0;
  private sendChain = Promise.resolve();
  private stopPromise: Promise<void> | null = null;

  constructor(
    private readonly browserSocket: AdapterBrowserSocket,
    private readonly provider: CloudAsrProviderClient<CloudAsrSegmentUpdate>
  ) {}

  async start() {
    this.providerConnection = await this.provider.connect({
      onEvent: (event) => {
        if (this.browserClosed) {
          return;
        }

        this.browserSocket.send(JSON.stringify(event));
      },
      onError: (error) => {
        if (this.browserClosed) {
          return;
        }

        const reason =
          error instanceof Error
            ? error.message
            : "The cloud-asr adapter session failed.";

        void this.stop();
        this.browserSocket.close(1011, reason);
      }
    });
  }

  async handleBinaryMessage(data: ArrayBuffer | ArrayBufferView | Buffer) {
    if (!this.providerConnection) {
      throw new Error("ProjectCloudAsrAdapterSession is not started.");
    }

    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const chunk: AudioInputChunk = {
      sequence: this.sequence,
      mimeType: "application/octet-stream",
      blob: new globalThis.Blob([arrayBuffer])
    };
    this.sequence += 1;

    const sendPromise = this.sendChain.then(() =>
      this.providerConnection?.sendAudioChunk(chunk)
    );
    this.sendChain = sendPromise.catch(() => {});

    await sendPromise;
  }

  async stop() {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.stopPromise = (async () => {
      this.browserClosed = true;

      const connection = this.providerConnection;
      this.providerConnection = null;

      if (connection) {
        await connection.close();
      }
    })();

    await this.stopPromise;
  }
}
