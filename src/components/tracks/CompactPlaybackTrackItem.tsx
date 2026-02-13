"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { t } from "@/src/lib/i18n";
import type { PlaybackTrack } from "@/src/components/tracks/playback.types";

interface CompactPlaybackTrackItemProps {
  track: PlaybackTrack;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  isPremium: boolean;
  onOpenPlayback: (track: PlaybackTrack) => void;
}

export function CompactPlaybackTrackItem({
  track,
  subtitle,
  leading,
  trailing,
  isPremium,
  onOpenPlayback,
}: CompactPlaybackTrackItemProps) {
  const canPlay = isPremium;

  return (
    <button
      type="button"
      onClick={() => onOpenPlayback(track)}
      disabled={!canPlay}
      title={canPlay ? t("dashboard.topTracks.openPlayer") : t("dashboard.topTracks.premiumOnly")}
      aria-label={`${canPlay ? t("dashboard.topTracks.openPlayer") : t("dashboard.topTracks.premiumOnly")}: ${track.name}`}
      className="group w-full rounded-xl border border-[#254751] bg-[#0c2029] px-3 py-2 text-left transition-colors hover:border-[#3b7482] hover:bg-[#102734] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="flex items-center gap-2.5">
        {leading ? <div className="shrink-0">{leading}</div> : null}

        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[#2c5860] bg-[#10232d]">
          {track.albumImageUrl ? (
            <Image src={track.albumImageUrl} alt={track.name} fill sizes="40px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#15323f] via-[#112531] to-[#0a161d] text-xs font-semibold text-[#9bcfc4]">
              {track.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{track.name}</p>
          <p className="truncate text-xs text-slate-400">{subtitle ?? track.artistName}</p>
        </div>

        {trailing ? <div className="shrink-0">{trailing}</div> : null}

        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#2a605f] bg-[#102a2f] text-[#d7f2eb] transition-colors group-hover:border-[#43ba98] group-hover:text-white">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 translate-x-[0.5px]" aria-hidden="true">
            <path d="M6 4.8v10.4a.8.8 0 0 0 1.2.68l8.1-5.2a.8.8 0 0 0 0-1.36l-8.1-5.2A.8.8 0 0 0 6 4.8z" fill="currentColor" />
          </svg>
        </span>
      </div>
    </button>
  );
}
