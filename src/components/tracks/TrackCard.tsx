"use client";

import Image from "next/image";
import { useMemo } from "react";
import { t } from "@/src/lib/i18n";
import type { PlaybackTrack } from "@/src/components/tracks/playback.types";

export interface TrackCardData {
  id: string;
  name: string;
  artistName: string;
  playCount: number;
  totalMinutesListened: number;
  albumImageUrl: string | null;
  primaryArtist: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
}

interface TrackCardProps {
  track: TrackCardData;
  rank: number;
  maxPlays: number;
  isPremium: boolean;
  onOpenPlayback: (track: PlaybackTrack) => void;
}

export function TrackCard({ track, rank, maxPlays, isPremium, onOpenPlayback }: TrackCardProps) {
  const dominancePercent = useMemo(() => {
    if (maxPlays <= 0) {
      return 0;
    }
    return Math.max(8, Math.round((track.playCount / maxPlays) * 100));
  }, [maxPlays, track.playCount]);

  const artistLabel = track.primaryArtist?.name ?? track.artistName;
  const actionLabel = isPremium
    ? t("dashboard.topTracks.openPlayer")
    : t("dashboard.topTracks.premiumOnly");

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-[#1b3a40] bg-[#0f1f2a]/80 p-4 shadow-lg shadow-emerald-500/10 transition duration-300 hover:-translate-y-1 hover:border-[#2f6268]">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 opacity-70" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-[#1e4950] bg-[#0b1820] shadow-xl shadow-emerald-500/20">
          {track.albumImageUrl ? (
            <Image
              src={track.albumImageUrl}
              alt={track.name}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#15323f] via-[#112531] to-[#0a161d] text-2xl text-[#86b7b1]">
              {track.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute left-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-black/70 px-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/40">
            #{rank}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              {t("dashboard.topTracks.playsLabel")} · {track.playCount}
            </p>
            <h3 className="truncate text-xl font-semibold text-white">{track.name}</h3>
          </div>

          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#2b4f55] bg-[#12252f]/90 px-3 py-1.5">
            {track.primaryArtist?.imageUrl ? (
              <Image
                src={track.primaryArtist.imageUrl}
                alt={artistLabel}
                width={20}
                height={20}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1d3d48] text-[10px] font-semibold text-[#bfe8da]">
                {artistLabel.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm text-[#cfe8e2]">{artistLabel}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1d4046] bg-[#0b1820]/80 p-3">
            <div className="text-xs text-slate-400">
              {track.totalMinutesListened} {t("dashboard.topTracks.minutesLabel")}
            </div>
            <button
              type="button"
              onClick={() =>
                onOpenPlayback({
                  id: track.id,
                  name: track.name,
                  artistName: track.artistName,
                  albumImageUrl: track.albumImageUrl,
                })
              }
              disabled={!isPremium}
              className="inline-flex items-center gap-2 rounded-full border border-[#2c6665] bg-[#102a2f] px-4 py-2 text-sm font-semibold text-[#d5f2eb] transition hover:border-[#47be9a] hover:text-white disabled:cursor-not-allowed disabled:border-[#385054] disabled:bg-[#1a2f32] disabled:text-slate-400"
            >
              {isPremium ? (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#1be18d]" />
              ) : (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#7a8e91]" />
              )}
              {actionLabel}
            </button>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-[#12323a]">
            <div
              className="h-full rounded-full bg-linear-to-r from-emerald-400 via-[#26d8a7] to-cyan-400 transition-all duration-500"
              style={{ width: `${dominancePercent}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
