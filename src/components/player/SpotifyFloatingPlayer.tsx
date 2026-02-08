"use client";

import Image from "next/image";
import { t } from "@/src/lib/i18n";
import { SpotifyPlaybackControls } from "./SpotifyPlaybackControls";

interface FloatingTrack {
  id: string;
  name: string;
  artistName: string;
  albumImageUrl: string | null;
}

interface SpotifyFloatingPlayerProps {
  visible: boolean;
  track: FloatingTrack | null;
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
  onOpenModal: () => void;
}

export function SpotifyFloatingPlayer({
  visible,
  track,
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
  onOpenModal,
}: SpotifyFloatingPlayerProps) {
  if (!visible || !track) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-[#2b5960] bg-[#0b1820]/95 shadow-2xl shadow-emerald-500/30 backdrop-blur">
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onOpenModal}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#2d5960] bg-[#10222c]"
          aria-label={t("player.openPlayer")}
        >
          {track.albumImageUrl ? (
            <Image
              src={track.albumImageUrl}
              alt={track.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#8ec7bd]">
              {track.name.charAt(0).toUpperCase()}
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{track.name}</p>
          <p className="truncate text-xs text-slate-400">{track.artistName}</p>
          <div className="mt-3">
            <SpotifyPlaybackControls
              compact
              isPlaying={isPlaying}
              disabled={disabled}
              positionMs={positionMs}
              durationMs={durationMs}
              volumePercent={volumePercent}
              onTogglePlay={onTogglePlay}
              onPreviousTrack={onPreviousTrack}
              onNextTrack={onNextTrack}
              onSeek={onSeek}
              onVolumeChange={onVolumeChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

