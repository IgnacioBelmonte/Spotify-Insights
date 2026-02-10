"use client";

import Image from "next/image";
import { getLocaleTag, t } from "@/src/lib/i18n";
import type { PlaybackTrack } from "@/src/components/tracks/playback.types";

const localeTag = getLocaleTag();

export interface DailyPlayHistoryItemData {
  trackId: string;
  name: string;
  artistName: string;
  playedAt: string;
  albumImageUrl: string | null;
}

interface DailyPlayHistoryItemProps {
  play: DailyPlayHistoryItemData;
  isPremium: boolean;
  timeZone: string;
  onPlay?: (track: PlaybackTrack) => void;
}

function parsePlayedAtUtc(playedAt: string): Date {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(playedAt)) {
    return new Date(playedAt);
  }

  return new Date(`${playedAt}Z`);
}

function formatPlayedAt(playedAt: string, timeZone: string): string {
  const date = parsePlayedAtUtc(playedAt);
  return date.toLocaleTimeString(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

export function DailyPlayHistoryItem({ play, isPremium, onPlay, timeZone }: DailyPlayHistoryItemProps) {
  const canPlay = isPremium && Boolean(onPlay);

  return (
    <article className="group rounded-2xl border border-[#1d4046] bg-[#0c1c26]/75 px-3 py-2.5 shadow-sm shadow-emerald-500/5 transition-colors hover:border-[#2e6668] hover:bg-[#102532]/80">
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[#234b53] bg-[#0b1820]">
          {play.albumImageUrl ? (
            <Image
              src={play.albumImageUrl}
              alt={play.name}
              fill
              sizes="44px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#15323f] via-[#112531] to-[#0a161d] text-sm font-semibold text-[#9bcfc4]">
              {play.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#e9f7f3]">{play.name}</p>
          <p className="truncate text-xs text-slate-300">{play.artistName}</p>
        </div>

        <span className="rounded-full border border-[#2a5055] bg-[#0f2530] px-2 py-1 text-[11px] font-semibold text-[#9cd7ca]">
          {formatPlayedAt(play.playedAt, timeZone)}
        </span>

        <button
          type="button"
          onClick={() =>
            onPlay?.({
              id: play.trackId,
              name: play.name,
              artistName: play.artistName,
              albumImageUrl: play.albumImageUrl,
            })
          }
          disabled={!canPlay}
          aria-label={t("chart.playTrack", { track: play.name })}
          title={!isPremium ? t("dashboard.topTracks.premiumOnly") : t("chart.playTrack", { track: play.name })}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#2a605f] bg-[#102a2f] text-[#d7f2eb] transition-colors hover:border-[#43ba98] hover:text-white disabled:cursor-not-allowed disabled:border-[#385054] disabled:bg-[#1a2f32] disabled:text-slate-400"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 translate-x-[0.5px]" aria-hidden="true">
            <path d="M6 4.8v10.4a.8.8 0 0 0 1.2.68l8.1-5.2a.8.8 0 0 0 0-1.36l-8.1-5.2A.8.8 0 0 0 6 4.8z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </article>
  );
}
