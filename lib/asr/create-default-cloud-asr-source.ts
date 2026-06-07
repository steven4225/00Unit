import { BrowserPcmMicrophoneInput } from "../audio/browser-pcm-microphone-input";
import { BrowserTabAudioInput } from "../audio/browser-tab-audio-input";
import {
  CloudAsrSource,
  type CloudAsrSourceCallbacks
} from "./cloud-asr-source";
import {
  createCloudAsrTranscriptNormalizer,
  type CloudAsrSegmentUpdate
} from "./cloud-asr-transcript-normalizer";
import { ProjectCloudAsrAdapterProvider } from "./project-cloud-asr-adapter-provider";

export interface CloudAsrRuntime {
  start(callbacks: CloudAsrSourceCallbacks): Promise<void>;
  stop(): Promise<void>;
}

export type CloudAsrInputKind = "browser-microphone" | "browser-tab-audio";

type CreateDefaultCloudAsrSourceOptions = {
  inputKind?: CloudAsrInputKind;
};

export function createDefaultCloudAsrSource({
  inputKind = "browser-microphone"
}: CreateDefaultCloudAsrSourceOptions = {}): CloudAsrRuntime {
  const adapterUrl = process.env.NEXT_PUBLIC_CLOUD_ASR_ADAPTER_URL;

  if (!adapterUrl) {
    throw new Error("Missing NEXT_PUBLIC_CLOUD_ASR_ADAPTER_URL");
  }

  const normalizeTranscript = createCloudAsrTranscriptNormalizer({
    idPrefix: "cloud-asr"
  });

  return new CloudAsrSource<CloudAsrSegmentUpdate>({
    audioInput:
      inputKind === "browser-tab-audio"
        ? new BrowserTabAudioInput()
        : new BrowserPcmMicrophoneInput(),
    provider: new ProjectCloudAsrAdapterProvider({
      url: adapterUrl
    }),
    normalizeEvent: (update) => normalizeTranscript(update)
  });
}
