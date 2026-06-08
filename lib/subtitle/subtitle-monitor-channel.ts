import type { SubtitleItem } from "../schemas/transcript";

export const SUBTITLE_MONITOR_CHANNEL_NAME = "subtitle-monitor";
export const SUBTITLE_MONITOR_WINDOW_PATH = "/subtitle-monitor";

export type SubtitleMonitorSessionId = string;

export type SubtitleMonitorSnapshot = {
  sessionId: SubtitleMonitorSessionId;
  items: SubtitleItem[];
  isTranslating: boolean;
  modeLabel: string;
  statusDetail: string;
};

export type SubtitleMonitorMessage =
  | { type: "monitor-ready" }
  | { type: "request-snapshot" }
  | { type: "snapshot"; snapshot: SubtitleMonitorSnapshot }
  | {
      type: "session-reset";
      sessionId: SubtitleMonitorSessionId;
      modeLabel: string;
      statusDetail: string;
    };

let subtitleMonitorSessionCounter = 0;

export function createSubtitleMonitorSessionId() {
  subtitleMonitorSessionCounter += 1;
  return `subtitle-monitor-session-${subtitleMonitorSessionCounter}`;
}

export function isSubtitleMonitorMessage(
  message: unknown
): message is SubtitleMonitorMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof message.type === "string"
  );
}
