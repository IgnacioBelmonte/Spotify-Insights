"use client";

import { t } from "@/src/lib/i18n";

interface SpotifyPlaybackControlsProps {
  compact?: boolean;
  isPlaying: boolean;
  disabled?: boolean;
  positionMs: number;
  durationMs: number;
  volumePercent: number;
  onTogglePlay: () => void;
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

export function SpotifyPlaybackControls({
  compact = false,
  isPlaying,
  disabled = false,
  positionMs,
  durationMs,
  volumePercent,
  onTogglePlay,
  onPreviousTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
}: SpotifyPlaybackControlsProps) {
  const progressMs = Math.min(positionMs, durationMs);
  const buttonSize = compact ? "h-9 w-9" : "h-10 w-10";
  const iconSize = compact ? "text-xs" : "text-sm";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
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
          className={`${buttonSize} inline-flex items-center justify-center rounded-full bg-[#14f1b2] text-lg font-bold text-[#0a261f] shadow-md shadow-emerald-400/40 transition hover:bg-[#5bf2c6] disabled:cursor-not-allowed disabled:bg-[#28463f] disabled:text-slate-400 disabled:shadow-none`}
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

