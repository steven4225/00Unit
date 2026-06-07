import React from "react";

type SourceStatusProps = {
  sourceLabel: string;
  statusDetail: string;
  modeLabel: string;
  errorMessage: string | null;
  audioChunkCount?: number;
  providerEventCount?: number;
  audioLevelPercent?: number;
  showTabAudioHandoff?: boolean;
};

export function SourceStatus({
  sourceLabel,
  statusDetail,
  modeLabel,
  errorMessage,
  audioChunkCount = 0,
  providerEventCount = 0,
  audioLevelPercent = 0,
  showTabAudioHandoff = false
}: SourceStatusProps) {
  return (
    <section
      aria-labelledby="source-status-title"
      className="rounded-[24px] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-sky-50 p-5"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2
              id="source-status-title"
              className="text-lg font-semibold text-slate-900"
            >
              输入源状态
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              支持 mock、浏览器麦克风和浏览器标签页音频三种输入模式，并复用同一条 cloud asr 链路。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>{modeLabel}</span>
            <span className="text-slate-400">·</span>
            <span>{sourceLabel}</span>
            <span className="text-slate-400">·</span>
            <span>{statusDetail}</span>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-white/80 px-3 py-1">
            音频块: {audioChunkCount}
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1">
            音频能量: {audioLevelPercent}%
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1">
            ASR事件: {providerEventCount}
          </span>
        </div>

        {showTabAudioHandoff ? (
          <div
            role="note"
            aria-label="Tab audio verification handoff"
            className="rounded-[18px] border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-slate-700"
          >
            <p className="font-semibold text-slate-900">标签页音频验收提示</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>使用 Chromium 浏览器，把工作台和英文音频内容放在两个不同标签页。</li>
              <li>点击共享标签页音频，选择正在播放英文语音的标签页，并勾选共享音频。</li>
              <li>先看音频块和音频能量是否增长，再看 ASR事件是否增长。</li>
              <li>主字幕出现英文识别和中文翻译后，再点击生成总结验证完整链路。</li>
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
