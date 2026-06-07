import type { SubtitleItem } from "../schemas/transcript";

export const SUBTITLE_MONITOR_CHANNEL_NAME = "subtitle-monitor";
export const SUBTITLE_MONITOR_WINDOW_PATH = "/subtitle-monitor";

export type SubtitleMonitorSnapshot = {
  items: SubtitleItem[];
  isTranslating: boolean;
  modeLabel: string;
  statusDetail: string;
};
