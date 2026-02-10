"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  isPremium: boolean;
  onOpenPlayback: (track: PlaybackTrack) => void;
}

export function TrackCard({ track, rank, isPremium, onOpenPlayback }: TrackCardProps) {
  const [playBurst, setPlayBurst] = useState<{ x: number; y: number; key: number } | null>(null);
  const burstTimeoutRef = useRef<number | null>(null);

  const artistLabel = track.primaryArtist?.name ?? track.artistName;
  const playHintLabel = isPremium
    ? t("dashboard.topTracks.openPlayer")
    : t("dashboard.topTracks.premiumOnly");
  const rankBadgeClasses =
    rank === 1
      ? "bg-gradient-to-br from-[#f6d56a] to-[#c89b2a] text-[#2d2108] ring-[#ffe8ab]/70"
      : rank === 2
        ? "bg-gradient-to-br from-[#d8e0e8] to-[#98a8b8] text-[#182330] ring-[#edf3f9]/60"
        : rank === 3
          ? "bg-gradient-to-br from-[#f3c18b] to-[#bf7e42] text-[#2e1a0f] ring-[#ffd9b8]/65"
          : "bg-[#102732] text-[#d7ece6] ring-[#2e5862]/70";

  const cardToneClasses =
    rank === 1
      ? "border-[#d5ad4f]/45 shadow-amber-400/15"
      : rank === 2
        ? "border-[#8ea5bb]/40 shadow-slate-300/10"
        : rank === 3
          ? "border-[#ca8851]/40 shadow-orange-300/10"
          : "border-[#1d3e46] shadow-emerald-500/5";

  const topTierLine =
    rank === 1
      ? "from-[#f6d56a] via-[#dfb65a] to-transparent"
      : rank === 2
        ? "from-[#d8e0e8] via-[#b8c6d5] to-transparent"
        : rank === 3
          ? "from-[#f3c18b] via-[#d59657] to-transparent"
          : "from-[#2f5660] via-[#254852] to-transparent";
  const isBursting = playBurst !== null;

  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current !== null) {
        window.clearTimeout(burstTimeoutRef.current);
      }
    };
  }, []);

  const handleCardPlay = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isPremium) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    setPlayBurst({ x, y, key: Date.now() });

    if (burstTimeoutRef.current !== null) {
      window.clearTimeout(burstTimeoutRef.current);
    }
    burstTimeoutRef.current = window.setTimeout(() => {
      setPlayBurst(null);
    }, 700);

    onOpenPlayback({
      id: track.id,
      name: track.name,
      artistName: track.artistName,
      albumImageUrl: track.albumImageUrl,
    });
  };

  return (
    <button
      type="button"
      onClick={handleCardPlay}
      disabled={!isPremium}
      title={playHintLabel}
      aria-label={`${playHintLabel}: ${track.name}`}
      className={`group relative w-full overflow-hidden rounded-2xl border ${cardToneClasses} bg-[#0c1a23]/88 p-3 text-left shadow-lg transition duration-300 animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${isPremium ? "cursor-pointer hover:-translate-y-1 hover:border-[#3b7781]" : "cursor-not-allowed opacity-85"}`}
      style={{ animationDelay: `${Math.min(rank, 10) * 55}ms` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/12 via-transparent to-cyan-500/10 opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,rgba(142,240,207,0.42),rgba(53,199,225,0.06),rgba(142,240,207,0.42))] blur-[1px] transition-all duration-500 ${isPremium ? "opacity-35 group-hover:opacity-65" : "opacity-10"} ${isBursting ? "scale-125 animate-spin" : "scale-100"}`}
      />
      <div
        className={`pointer-events-none absolute inset-0 bg-linear-to-tr from-emerald-300/20 via-transparent to-cyan-300/20 transition-opacity duration-300 ${isBursting ? "opacity-100" : "opacity-0"}`}
      />
      {playBurst ? (
        <>
          <span
            key={`${playBurst.key}-outer`}
            className="pointer-events-none absolute h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/80 bg-emerald-200/15 animate-[ping_700ms_ease-out]"
            style={{ left: playBurst.x, top: playBurst.y }}
          />
          <span
            key={`${playBurst.key}-inner`}
            className="pointer-events-none absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/80 bg-cyan-200/15 animate-[ping_520ms_ease-out]"
            style={{ left: playBurst.x, top: playBurst.y }}
          />
        </>
      ) : null}
      <div className={`pointer-events-none absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r ${topTierLine}`} />

      <div className="relative flex flex-col gap-2.5">
        <div className="relative h-24 w-full overflow-hidden rounded-xl border border-[#21424a] bg-[#0b1820]">
          {track.albumImageUrl ? (
            <Image
              src={track.albumImageUrl}
              alt={track.name}
              fill
              sizes="(min-width: 1024px) 180px, (min-width: 640px) 220px, 100vw"
              className={`object-cover transition-transform duration-500 ${isBursting ? "scale-110" : "group-hover:scale-105"}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#15323f] via-[#112531] to-[#0a161d] text-2xl text-[#86b7b1]">
              {track.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#041015]/80 via-transparent to-transparent" />
          <div
            className={`absolute left-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-extrabold ring-1 backdrop-blur-sm shadow-lg shadow-black/30 ${rankBadgeClasses}`}
          >
            {rank}
          </div>
          <div className="absolute right-2 top-2 rounded-full border border-[#2f5a62] bg-[#0a1e27]/88 px-2 py-0.5 text-[11px] font-semibold text-[#cde8e1]">
            {track.totalMinutesListened} {t("dashboard.topTracks.minutesLabel")}
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#82e7c8]/70 bg-[#07161d]/75 backdrop-blur-sm shadow-xl transition-all duration-300 ${isPremium ? "opacity-92 group-hover:scale-110 group-hover:opacity-100" : "opacity-55"} ${isBursting ? "scale-110" : ""}`}
            >
              <span
                className={`absolute -inset-2 rounded-full border border-[#8ef0cf]/55 ${isBursting ? "animate-ping" : "animate-pulse"}`}
              />
              <svg viewBox="0 0 20 20" className="relative h-5 w-5 text-[#cffff1]" aria-hidden="true">
                <path
                  d="M7.2 5.5L14.8 10l-7.6 4.5V5.5z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          <div className={`absolute bottom-2 right-2 inline-flex items-end gap-0.5 rounded-md border border-[#2f6164] bg-[#07161d]/85 px-2 py-1 transition-opacity duration-300 ${isPremium ? "opacity-90 group-hover:opacity-100" : "opacity-55"}`}>
            <span className={`w-0.5 rounded-full bg-[#8ef0cf] ${isBursting ? "h-4 animate-pulse" : "h-2"}`} />
            <span className={`w-0.5 rounded-full bg-[#8ef0cf] ${isBursting ? "h-3 animate-pulse" : "h-3"}`} />
            <span className={`w-0.5 rounded-full bg-[#8ef0cf] ${isBursting ? "h-5 animate-pulse" : "h-2.5"}`} />
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <h3 className="truncate text-sm font-semibold text-white">{track.name}</h3>
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#2a4c53] bg-[#10232d]/90 px-2 py-1">
            {track.primaryArtist?.imageUrl ? (
              <Image
                src={track.primaryArtist.imageUrl}
                alt={artistLabel}
                width={16}
                height={16}
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1d3d48] text-[9px] font-semibold text-[#bfe8da]">
                {artistLabel.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-xs text-[#cfe8e2]">{artistLabel}</span>
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] leading-tight text-slate-400 sm:text-[11px]">
            {track.playCount} {t("dashboard.topTracks.playsLabel")}
          </p>
          <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border ${isPremium ? "border-[#3d8a72] bg-[#103327] text-[#bff5e3]" : "border-[#4a5f63] bg-[#17272a] text-[#9db0b3]"}`}>
            {isPremium ? (
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M7.2 5.5L14.8 10l-7.6 4.5V5.5z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
                <rect
                  x="6.2"
                  y="9.2"
                  width="7.6"
                  height="5.8"
                  rx="1.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M8 9V7.8a2 2 0 114 0V9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}
