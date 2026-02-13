"use client";

import { useEffect } from "react";
import { t } from "@/src/lib/i18n";
import { CompactPlaybackTrackItem } from "@/src/components/tracks/CompactPlaybackTrackItem";
import type { PlaybackTrack } from "@/src/components/tracks/playback.types";

export interface PlaylistTrackEntry {
  entryId: string;
  id: string;
  name: string;
  artistName: string;
  albumImageUrl: string | null;
}

interface PlaylistTracksPanelProps {
  playlistName: string;
  tracks: PlaylistTrackEntry[];
  isLoading: boolean;
  error: string | null;
  isPremium: boolean;
  onOpenPlayback: (track: PlaybackTrack) => void;
  onClose: () => void;
}

export function PlaylistTracksPanel({
  playlistName,
  tracks,
  isLoading,
  error,
  isPremium,
  onOpenPlayback,
  onClose,
}: PlaylistTracksPanelProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t("dashboard.live.playlists.tracksPanelTitle", { playlist: playlistName })}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-[#02070b]/75 backdrop-blur-[2px]"
        aria-label={t("dashboard.live.playlists.closeTracks")}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-[#21444d] bg-[#0a1c25] p-3 sm:max-w-2xl sm:rounded-2xl sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {t("dashboard.live.playlists.tracksPanelTitle", { playlist: playlistName })}
            </p>
            <p className="text-xs text-slate-400">{t("dashboard.live.playlists.tracksPanelHint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2d5560] bg-[#102631] text-[#9cd7ca] transition-colors hover:border-[#31a78a] hover:text-[#dff7f2]"
            aria-label={t("dashboard.live.playlists.closeTracks")}
            title={t("dashboard.live.playlists.closeTracks")}
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <p className="rounded-lg border border-[#23464d] bg-[#0c2029] px-3 py-4 text-sm text-slate-300">
            {t("dashboard.live.playlists.loadingTracks")}
          </p>
        ) : null}

        {!isLoading && error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-4 text-sm text-red-200">{error}</p>
        ) : null}

        {!isLoading && !error && tracks.length === 0 ? (
          <p className="rounded-lg border border-[#23464d] bg-[#0c2029] px-3 py-4 text-sm text-slate-300">
            {t("dashboard.live.playlists.noTracks")}
          </p>
        ) : null}

        {!isLoading && !error && tracks.length > 0 ? (
          <div className="max-h-[calc(92vh-90px)] space-y-2 overflow-y-auto pr-1">
            {tracks.map((track) => (
              <CompactPlaybackTrackItem
                key={track.entryId}
                track={{
                  id: track.id,
                  name: track.name,
                  artistName: track.artistName,
                  albumImageUrl: track.albumImageUrl,
                }}
                subtitle={track.artistName}
                isPremium={isPremium}
                onOpenPlayback={onOpenPlayback}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
