"use client";

import { t } from "@/src/lib/i18n";

type RepeatMode = "off" | "context" | "track";

interface SpotifyPlaybackControlsProps {
  compact?: boolean;
  isPlaying: boolean;
  shuffleEnabled?: boolean;
  repeatMode?: RepeatMode;
  disabled?: boolean;
  positionMs: number;
  durationMs: number;
  volumePercent: number;
  onTogglePlay: () => void;
  onToggleShuffle?: () => void;
  onCycleRepeat?: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onSeek: (positionMs: number) => void;
  onVolumeChange: (volumePercent: number) => void;
}

function formatMilliseconds(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getRepeatLabel(mode: RepeatMode): string {
  if (mode === "track") {
    return "1";
  }

  if (mode === "context") {
    return "all";
  }

  return "off";
}

export function SpotifyPlaybackControls({
  compact = false,
  isPlaying,
  shuffleEnabled = false,
  repeatMode = "off",
  disabled = false,
  positionMs,
  durationMs,
  volumePercent,
  onTogglePlay,
  onToggleShuffle,
  onCycleRepeat,
  onPreviousTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
}: SpotifyPlaybackControlsProps) {
  const progressMs = Math.min(positionMs, durationMs);
  const buttonSize = compact ? "h-8 w-8" : "h-10 w-10";
  const iconSize = compact ? "text-xs" : "text-sm";
  const modeButtonSize = compact ? "h-8 min-w-8 px-2" : "h-10 min-w-10 px-3";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleShuffle}
          disabled={disabled || !onToggleShuffle}
          className={`${modeButtonSize} inline-flex items-center justify-center gap-1 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-45 ${
            shuffleEnabled
              ? "border-[#47be9a] bg-[#11382e] text-[#bcf8e7]"
              : "border-[#365c5e] bg-[#10272c] text-slate-300 hover:border-[#47be9a] hover:text-white"
          }`}
          aria-label={t("player.shuffle")}
          title={t("player.shuffle")}
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M2.5 5.8h2.9c1.2 0 2.3.5 3.1 1.4l5 5.6c.7.8 1.8 1.2 2.9 1.2h1.1M13.8 4.2h3.7v3.7M2.5 14.2h2.9c1.2 0 2.3-.5 3.1-1.4l1.6-1.8M13.8 15.8h3.7v-3.7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={onPreviousTrack}
          disabled={disabled}
          className={`${buttonSize} inline-flex items-center justify-center rounded-full border border-[#365c5e] bg-[#10272c] text-slate-200 transition hover:border-[#47be9a] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${iconSize}`}
          aria-label={t("player.previous")}
        >
          {"<<"}
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled}
          className={`${buttonSize} inline-flex items-center justify-center rounded-full text-lg font-bold transition disabled:cursor-not-allowed disabled:bg-[#28463f] disabled:text-slate-400 disabled:shadow-none ${
            isPlaying
              ? "bg-[#14f1b2] text-[#0a261f] shadow-md shadow-emerald-400/40 hover:bg-[#5bf2c6]"
              : "border border-[#365c5e] bg-[#10272c] text-[#d6efe9] hover:border-[#47be9a] hover:text-white"
          }`}
          aria-label={isPlaying ? t("player.pause") : t("player.play")}
        >
          {isPlaying ? "||" : ">"}
        </button>

        <button
          type="button"
          onClick={onNextTrack}
          disabled={disabled}
          className={`${buttonSize} inline-flex items-center justify-center rounded-full border border-[#365c5e] bg-[#10272c] text-slate-200 transition hover:border-[#47be9a] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${iconSize}`}
          aria-label={t("player.next")}
        >
          {">>"}
        </button>

        <button
          type="button"
          onClick={onCycleRepeat}
          disabled={disabled || !onCycleRepeat}
          className={`${modeButtonSize} inline-flex items-center justify-center gap-1 rounded-full border text-[10px] font-semibold uppercase tracking-[0.04em] transition disabled:cursor-not-allowed disabled:opacity-45 ${
            repeatMode !== "off"
              ? "border-[#47be9a] bg-[#11382e] text-[#bcf8e7]"
              : "border-[#365c5e] bg-[#10272c] text-slate-300 hover:border-[#47be9a] hover:text-white"
          }`}
          aria-label={t("player.repeat")}
          title={`${t("player.repeat")}: ${getRepeatLabel(repeatMode)}`}
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M4 6h9.2c1.8 0 3.2 1.4 3.2 3.2V10M16 14H6.8C5 14 3.6 12.6 3.6 10.8V10M15 4.6L16.8 6 15 7.4M5 12.6L3.2 14 5 15.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{getRepeatLabel(repeatMode)}</span>
        </button>

        <div className="ml-1 flex min-w-0 flex-1 items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(durationMs, 1)}
            step={500}
            value={progressMs}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={disabled}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#26444a] accent-[#19d8a9] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="w-[84px] text-right text-xs text-slate-300">
            {formatMilliseconds(progressMs)} / {formatMilliseconds(durationMs)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">{t("player.volume")}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.min(Math.max(volumePercent, 0), 100)}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          disabled={disabled}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#26444a] accent-[#19d8a9] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={t("player.volume")}
        />
        <span className="w-10 text-right text-xs text-slate-300">{Math.round(volumePercent)}%</span>
      </div>
    </div>
  );
}
