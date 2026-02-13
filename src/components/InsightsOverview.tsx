"use client";

import { useEffect, useMemo, useState } from "react";
import type { InsightsOverviewDTO } from "@/src/lib/insights/insights.service";
import DailyListeningChart from "./charts/DailyListeningChart";
import { SyncWidget } from "./SyncWidget";
import { t } from "@/src/lib/i18n";
import { SpotifyPlaybackModal } from "./tracks/SpotifyPlaybackModal";
import { TrackCard } from "./tracks/TrackCard";
import type { PlaybackTrack } from "./tracks/playback.types";
import { CompactPlaybackTrackItem } from "./tracks/CompactPlaybackTrackItem";
import { CompactPlaylistItem } from "./playlists/CompactPlaylistItem";
import { PlaylistTracksPanel, type PlaylistTrackEntry } from "./playlists/PlaylistTracksPanel";
import { TimeIntelligenceHeatmap } from "./time/TimeIntelligenceHeatmap";

interface InsightsOverviewProps {
  isPremium: boolean;
}

type DashboardSection = "summary" | "activity" | "live";

function formatDurationFromMs(durationMs: number): string {
  if (durationMs <= 0) return "0m";
  const totalMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatPercent(share: number): string {
  const safeShare = Number.isFinite(share) ? Math.max(0, Math.min(share, 1)) : 0;
  return `${Math.round(safeShare * 100)}%`;
}

function formatHourLabel(hour: number | null): string {
  if (hour === null || !Number.isFinite(hour)) return "--";
  const normalized = ((Math.round(hour) % 24) + 24) % 24;
  return `${String(normalized).padStart(2, "0")}:00`;
}

function getDeltaLabel(delta: number | null, newLabel: string): string {
  if (delta === null) return newLabel;
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return String(delta);
  return "0";
}

function getDeltaClass(delta: number | null): string {
  if (delta === null) return "bg-[#2b3b42] text-[#b6cfd0]";
  if (delta > 0) return "bg-emerald-500/15 text-emerald-300";
  if (delta < 0) return "bg-amber-500/15 text-amber-300";
  return "bg-slate-500/15 text-slate-300";
}

export function InsightsOverview({ isPremium }: InsightsOverviewProps) {
  const [insights, setInsights] = useState<InsightsOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerSeedTrack, setPlayerSeedTrack] = useState<PlaybackTrack | null>(null);
  const [playbackRequestId, setPlaybackRequestId] = useState(0);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistTracksById, setPlaylistTracksById] = useState<Record<string, PlaylistTrackEntry[]>>({});
  const [playlistTracksLoadingId, setPlaylistTracksLoadingId] = useState<string | null>(null);
  const [playlistTracksErrors, setPlaylistTracksErrors] = useState<Record<string, string>>({});
  const [selectedReleaseAlbumId, setSelectedReleaseAlbumId] = useState<string | null>(null);
  const [releaseTracksByAlbumId, setReleaseTracksByAlbumId] = useState<Record<string, PlaylistTrackEntry[]>>({});
  const [releaseTracksLoadingId, setReleaseTracksLoadingId] = useState<string | null>(null);
  const [releaseTracksErrors, setReleaseTracksErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<DashboardSection>("summary");
  const timeZone = useMemo(() => {
    if (typeof window === "undefined") {
      return "UTC";
    }

    try {
      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return localTimeZone && localTimeZone.trim().length > 0 ? localTimeZone : "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const insightsUrl = `/api/insights/overview?tz=${encodeURIComponent(timeZone)}`;

  useEffect(() => {
    let active = true;
    async function fetchInsights() {
      const res = await fetch(insightsUrl, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(t("insights.fetchError", { status: res.status }));
      }
      return res.json();
    }

    fetchInsights()
      .then((data) => {
        if (active) setInsights(data);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : t("errors.fetchInsights"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [insightsUrl]);

  async function refreshInsights() {
    const res = await fetch(insightsUrl, {
      credentials: "same-origin",
    });
    if (!res.ok) {
      throw new Error(t("insights.fetchError", { status: res.status }));
    }
    const data = await res.json();
    setInsights(data);
  }

  function openPlayerForTrack(track: PlaybackTrack) {
    setPlayerSeedTrack(track);
    setPlaybackRequestId((current) => current + 1);
    setIsPlayerModalOpen(true);
  }

  async function openPlaylistTracks(playlistId: string) {
    setSelectedPlaylistId(playlistId);
    setSelectedReleaseAlbumId(null);
    if (playlistTracksById[playlistId] || playlistTracksLoadingId === playlistId) {
      return;
    }

    setPlaylistTracksLoadingId(playlistId);
    setPlaylistTracksErrors((current) => ({
      ...current,
      [playlistId]: "",
    }));

    try {
      const response = await fetch(`/api/spotify/playlists/${encodeURIComponent(playlistId)}/tracks`, {
        credentials: "same-origin",
      });
      const payload = (await response.json()) as { tracks?: PlaylistTrackEntry[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || t("dashboard.live.playlists.tracksError"));
      }

      setPlaylistTracksById((current) => ({
        ...current,
        [playlistId]: Array.isArray(payload.tracks) ? payload.tracks : [],
      }));
    } catch (playlistError) {
      setPlaylistTracksErrors((current) => ({
        ...current,
        [playlistId]:
          playlistError instanceof Error
            ? playlistError.message
            : t("dashboard.live.playlists.tracksError"),
      }));
    } finally {
      setPlaylistTracksLoadingId((current) => (current === playlistId ? null : current));
    }
  }

  async function loadReleaseAlbumTracks(albumId: string): Promise<PlaylistTrackEntry[]> {
    if (releaseTracksByAlbumId[albumId]) {
      return releaseTracksByAlbumId[albumId];
    }

    setReleaseTracksLoadingId(albumId);
    setReleaseTracksErrors((current) => ({
      ...current,
      [albumId]: "",
    }));

    try {
      const response = await fetch(`/api/spotify/albums/${encodeURIComponent(albumId)}/tracks`, {
        credentials: "same-origin",
      });
      const payload = (await response.json()) as { tracks?: PlaylistTrackEntry[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || t("dashboard.live.releases.tracksError"));
      }

      const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
      setReleaseTracksByAlbumId((current) => ({
        ...current,
        [albumId]: tracks,
      }));
      return tracks;
    } catch (albumError) {
      setReleaseTracksErrors((current) => ({
        ...current,
        [albumId]:
          albumError instanceof Error ? albumError.message : t("dashboard.live.releases.tracksError"),
      }));
      return [];
    } finally {
      setReleaseTracksLoadingId((current) => (current === albumId ? null : current));
    }
  }

  async function openReleaseAlbumTracks(albumId: string) {
    setSelectedPlaylistId(null);
    setSelectedReleaseAlbumId(albumId);
    await loadReleaseAlbumTracks(albumId);
  }

  async function playSingleFromRelease(release: {
    id: string;
    primaryTrack: {
      id: string;
      name: string;
      artistName: string;
      albumImageUrl: string | null;
    } | null;
  }) {
    if (release.primaryTrack) {
      openPlayerForTrack({
        id: release.primaryTrack.id,
        name: release.primaryTrack.name,
        artistName: release.primaryTrack.artistName,
        albumImageUrl: release.primaryTrack.albumImageUrl,
      });
      return;
    }

    const tracks = await loadReleaseAlbumTracks(release.id);
    const firstTrack = tracks[0];
    if (firstTrack) {
      openPlayerForTrack({
        id: firstTrack.id,
        name: firstTrack.name,
        artistName: firstTrack.artistName,
        albumImageUrl: firstTrack.albumImageUrl,
      });
      return;
    }

    setSelectedReleaseAlbumId(release.id);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050b10] text-[#e6f3f1] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(29,214,167,0.12),_transparent_55%)]" />
        <div className="absolute -top-48 right-[-10%] h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-48 left-[-10%] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl animate-pulse-soft" />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/80 p-8 text-center shadow-lg shadow-emerald-500/10 animate-fade-up">
            <p className="text-slate-300">{t("insights.loading")}</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#050b10] text-[#e6f3f1] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(29,214,167,0.12),_transparent_55%)]" />
        <div className="absolute -top-48 right-[-10%] h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-48 left-[-10%] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl animate-pulse-soft" />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <div className="bg-red-950/40 border border-red-800 rounded-2xl p-6 text-red-200 shadow-lg animate-fade-up">
            {t("insights.error", { message: error })}
          </div>
        </div>
      </main>
    );
  }

  if (!insights) {
    return (
      <main className="min-h-screen bg-[#050b10] text-[#e6f3f1] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(29,214,167,0.12),_transparent_55%)]" />
        <div className="absolute -top-48 right-[-10%] h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-48 left-[-10%] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl animate-pulse-soft" />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/80 p-8 text-center text-slate-300 shadow-lg animate-fade-up">
            {t("insights.noData")}
          </div>
        </div>
      </main>
    );
  }

  const {
    stats,
    topTracks,
    dailyActivity,
    listeningRhythm,
    discovery,
    consumption,
    spotifyLive,
    lastSyncedAt,
  } = insights;
  const topRankedTracks = topTracks.slice(0, 10);
  const shortTermTracks = spotifyLive?.topWindows.data?.tracks.shortTerm ?? [];
  const shortTermArtists = spotifyLive?.topWindows.data?.artists.shortTerm ?? [];
  const biggestTrackMovers = spotifyLive?.topWindows.data?.biggestTrackMovers ?? [];
  const contextMix = spotifyLive?.contextMix.data?.distribution ?? [];
  const libraryMonthlyAdds = spotifyLive?.library.data?.monthlyAdds ?? [];
  const recentSavedTracks = spotifyLive?.library.data?.recentSaves ?? [];
  const topPlaylists = spotifyLive?.playlists.data?.topPlaylists ?? [];
  const releaseRadar = spotifyLive?.releases.data?.latestReleases ?? [];
  const maxLibraryMonthlyAdd = Math.max(...libraryMonthlyAdds.map((point) => point.count), 1);
  const selectedPlaylist =
    selectedPlaylistId && topPlaylists.length > 0
      ? topPlaylists.find((playlist) => playlist.id === selectedPlaylistId) ?? null
      : null;
  const selectedPlaylistTracks = selectedPlaylistId ? playlistTracksById[selectedPlaylistId] ?? [] : [];
  const selectedPlaylistError = selectedPlaylistId ? playlistTracksErrors[selectedPlaylistId] ?? null : null;
  const selectedReleaseAlbum =
    selectedReleaseAlbumId && releaseRadar.length > 0
      ? releaseRadar.find((release) => release.id === selectedReleaseAlbumId) ?? null
      : null;
  const selectedReleaseAlbumTracks = selectedReleaseAlbumId
    ? releaseTracksByAlbumId[selectedReleaseAlbumId] ?? []
    : [];
  const selectedReleaseAlbumError = selectedReleaseAlbumId
    ? releaseTracksErrors[selectedReleaseAlbumId] ?? null
    : null;
  const statCards = [
    {
      label: t("dashboard.stats.totalMinutes.label"),
      value: stats.totalMinutesListened.toLocaleString(),
      caption: t("dashboard.stats.totalMinutes.caption"),
    },
    {
      label: t("dashboard.stats.totalPlays.label"),
      value: stats.totalPlays.toLocaleString(),
      caption: t("dashboard.stats.totalPlays.caption"),
    },
    {
      label: t("dashboard.stats.uniqueTracks.label"),
      value: stats.distinctTracksCount.toLocaleString(),
      caption: t("dashboard.stats.uniqueTracks.caption"),
    },
    {
      label: t("dashboard.stats.uniqueArtists.label"),
      value: stats.distinctArtistsCount.toLocaleString(),
      caption: t("dashboard.stats.uniqueArtists.caption"),
    },
  ];
  const intelligenceCards = [
    {
      label: t("dashboard.intelligence.activeStreak.label"),
      value: t("dashboard.intelligence.daysValue", {
        days: listeningRhythm.activeStreakDays,
      }),
      caption: t("dashboard.intelligence.activeStreak.caption", {
        days: listeningRhythm.longestStreakDays,
      }),
    },
    {
      label: t("dashboard.intelligence.sessions.label"),
      value: listeningRhythm.sessionCount.toLocaleString(),
      caption: t("dashboard.intelligence.sessions.caption", {
        minutes: listeningRhythm.averageSessionMinutes,
      }),
    },
    {
      label: t("dashboard.intelligence.peakHour.label"),
      value: formatHourLabel(listeningRhythm.peakHourLocal),
      caption: t("dashboard.intelligence.peakHour.caption"),
    },
    {
      label: t("dashboard.intelligence.discovery.label"),
      value: formatPercent(discovery.newTrackShare),
      caption: t("dashboard.intelligence.discovery.caption", {
        newTracks: discovery.newTracks30d,
        uniqueTracks: discovery.uniqueTracks30d,
      }),
    },
    {
      label: t("dashboard.intelligence.repeat.label"),
      value: formatPercent(discovery.repeatShare),
      caption: t("dashboard.intelligence.repeat.caption", {
        repeatPlays: discovery.repeatPlays30d,
      }),
    },
    {
      label: t("dashboard.intelligence.explicit.label"),
      value: formatPercent(consumption.explicitPlayShare),
      caption: t("dashboard.intelligence.explicit.caption", {
        explicitPlays: consumption.explicitPlays,
      }),
    },
    {
      label: t("dashboard.intelligence.avgTrack.label"),
      value: formatDurationFromMs(consumption.averageTrackDurationMs),
      caption: t("dashboard.intelligence.avgTrack.caption"),
    },
  ];
  const sectionTabs: Array<{ key: DashboardSection; title: string; subtitle: string }> = [
    {
      key: "summary",
      title: t("dashboard.sections.summary.title"),
      subtitle: t("dashboard.sections.summary.subtitle"),
    },
    {
      key: "activity",
      title: t("dashboard.sections.activity.title"),
      subtitle: t("dashboard.sections.activity.subtitle"),
    },
    {
      key: "live",
      title: t("dashboard.sections.live.title"),
      subtitle: t("dashboard.sections.live.subtitle"),
    },
  ];

  return (
    <main className="min-h-screen bg-[#050b10] text-[#e6f3f1] relative overflow-hidden" suppressHydrationWarning>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(29,214,167,0.14),_transparent_55%)]" />
      <div className="absolute -top-56 right-[-10%] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-3xl animate-pulse-soft" />
      <div className="absolute -bottom-48 left-[-10%] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl animate-pulse-soft" />

      <div className="relative mx-auto max-w-6xl px-6 py-10 space-y-8">
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] items-center">
          <div className="space-y-5 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
              {t("dashboard.badge")}
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              {t("dashboard.heroTitleLine1")}
              <span className="block text-emerald-300">{t("dashboard.heroTitleLine2")}</span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg max-w-xl">
              {t("dashboard.heroDescription")}
            </p>
          </div>

          <SyncWidget
            variant="hero"
            initialLastSyncedAt={lastSyncedAt}
            onSynced={refreshInsights}
            title={t("dashboard.syncTitle")}
            description={t("dashboard.syncDescription")}
            className="animate-float"
          />
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {sectionTabs.map((section) => {
            const isActive = activeSection === section.key;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1dd6a7]/60 ${
                  isActive
                    ? "border-emerald-400/60 bg-emerald-500/10"
                    : "border-[#1b3a40] bg-[#0f1b24]/80 hover:border-[#2b5f67]"
                }`}
              >
                <p className="text-sm font-semibold text-white">{section.title}</p>
                <p className="mt-1 text-xs text-slate-400">{section.subtitle}</p>
              </button>
            );
          })}
        </section>

        {activeSection === "summary" ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/80 p-6 shadow-lg shadow-emerald-500/5 transition duration-300 hover:-translate-y-1 hover:shadow-emerald-500/20 animate-fade-up"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 opacity-0 transition duration-300 group-hover:opacity-100" />
              <div className="relative">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
                <p className="text-3xl font-semibold text-white mt-3">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-2">{stat.caption}</p>
              </div>
            </div>
          ))}
        </section>
        ) : null}

        {activeSection !== "summary" ? (
        <section className="space-y-6">
          {activeSection === "activity" ? (
          <>
          <div className="bg-[#0f1b24]/85 border border-[#1b3a40] rounded-2xl p-4 sm:p-5 shadow-lg shadow-emerald-500/10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">{t("dashboard.topTracks.title")}</h2>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2b4f55] bg-[#11252f] px-3 py-1">
                <span className="text-[11px] text-slate-400 uppercase tracking-wide">
                  {t("dashboard.topTracks.subtitle")}
                </span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1d3d48] px-1.5 text-[11px] font-semibold text-[#d6efe8]">
                  {topRankedTracks.length}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {topRankedTracks.length > 0 ? (
                topRankedTracks.map((track, idx) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    rank={idx + 1}
                    isPremium={isPremium}
                    onOpenPlayback={openPlayerForTrack}
                  />
                ))
              ) : (
                <p className="col-span-full py-4 text-center text-slate-400">
                  {t("dashboard.topTracks.empty")}
                </p>
              )}
            </div>
          </div>

          <div className="bg-[#0f1b24]/85 border border-[#1b3a40] rounded-2xl p-6 shadow-lg shadow-emerald-500/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">{t("dashboard.dailyActivity.title")}</h2>
              <span className="text-xs text-slate-400 uppercase tracking-wide">
                {t("dashboard.dailyActivity.subtitle")}
              </span>
            </div>
            <DailyListeningChart
              data={dailyActivity.map((day) => ({
                date: day.date,
                durationMs: day.durationMs,
                plays: (day.plays ?? []).map((play) => ({
                  trackId: play.trackId,
                  name: play.name,
                  artistName: play.artistName,
                  playedAt: play.playedAt,
                  albumImageUrl: play.albumImageUrl ?? null,
                })),
              }))}
              variant="embedded"
              isPremium={isPremium}
              onOpenPlayback={openPlayerForTrack}
              timeZone={timeZone}
            />
          </div>

          <div className="bg-[#0f1b24]/85 border border-[#1b3a40] rounded-2xl p-5 shadow-lg shadow-emerald-500/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">{t("dashboard.intelligence.title")}</h2>
              <span className="rounded-full border border-[#28545a] bg-[#102631] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#91d8c7]">
                {t("dashboard.intelligence.subtitle")}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {intelligenceCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-xl border border-[#204148] bg-[#0b1d25]/85 p-4"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#87b7b3]">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{card.caption}</p>
                </article>
              ))}
            </div>
          </div>

          <TimeIntelligenceHeatmap timeZone={timeZone} />
          </>
          ) : null}

          {activeSection === "live" ? (spotifyLive ? (
            <div className="space-y-4">
              {spotifyLive.reconnectRequired ? (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  {t("dashboard.live.limitedNotice")}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 shadow-lg shadow-emerald-500/10">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">{t("dashboard.live.topMomentum.title")}</h3>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      {t("dashboard.live.topMomentum.subtitle")}
                    </span>
                  </div>

                  {spotifyLive.topWindows.data ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        {shortTermTracks.slice(0, 6).map((track) => (
                          <CompactPlaybackTrackItem
                            key={`short-track-${track.id}`}
                            track={{
                              id: track.id,
                              name: track.name,
                              artistName: track.subtitle || t("dashboard.live.unknownArtist"),
                              albumImageUrl: track.imageUrl,
                            }}
                            subtitle={track.subtitle || t("dashboard.live.unknownArtist")}
                            leading={
                              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[#335f65] bg-[#132b35] px-2 text-[11px] font-bold text-[#c6e8df]">
                                {track.rank}
                              </span>
                            }
                            trailing={
                              <span
                                className={`inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${getDeltaClass(track.deltaVsMedium)}`}
                                title={t("dashboard.live.topMomentum.deltaHint")}
                              >
                                {getDeltaLabel(track.deltaVsMedium, t("dashboard.live.deltaNew"))}
                              </span>
                            }
                            isPremium={isPremium}
                            onOpenPlayback={openPlayerForTrack}
                          />
                        ))}
                      </div>

                      <div className="space-y-2">
                        {shortTermArtists.slice(0, 6).map((artist) => (
                          <div
                            key={`short-artist-${artist.id}`}
                            className="flex items-center justify-between rounded-lg border border-[#254751] bg-[#0c2029] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">
                                #{artist.rank} {artist.name}
                              </p>
                              <p className="truncate text-xs text-slate-400">{artist.subtitle}</p>
                            </div>
                            <span
                              className={`ml-3 inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${getDeltaClass(artist.deltaVsMedium)}`}
                              title={t("dashboard.live.topMomentum.deltaHint")}
                            >
                              {getDeltaLabel(artist.deltaVsMedium, t("dashboard.live.deltaNew"))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {spotifyLive.topWindows.message ?? t("dashboard.live.topMomentum.empty")}
                    </p>
                  )}

                  {biggestTrackMovers.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                        {t("dashboard.live.topMomentum.moversTitle")}
                      </p>
                      {biggestTrackMovers.map((track) => (
                        <CompactPlaybackTrackItem
                          key={`mover-${track.id}`}
                          track={{
                            id: track.id,
                            name: track.name,
                            artistName: track.subtitle || t("dashboard.live.unknownArtist"),
                            albumImageUrl: track.imageUrl,
                          }}
                          subtitle={track.subtitle || t("dashboard.live.unknownArtist")}
                          trailing={
                            <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                              {getDeltaLabel(track.deltaVsMedium, t("dashboard.live.deltaNew"))}
                            </span>
                          }
                          isPremium={isPremium}
                          onOpenPlayback={openPlayerForTrack}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 shadow-lg shadow-emerald-500/10">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">{t("dashboard.live.contextMix.title")}</h3>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      {t("dashboard.live.contextMix.subtitle")}
                    </span>
                  </div>

                  {spotifyLive.contextMix.data && contextMix.length > 0 ? (
                    <div className="space-y-2">
                      {contextMix.map((item) => (
                        <div key={`context-${item.label}`} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">{item.label}</span>
                            <span className="text-slate-400">{formatPercent(item.share)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#1f3942]">
                            <div
                              className="h-1.5 rounded-full bg-linear-to-r from-[#1dd6a7] to-[#2ba8ff]"
                              style={{ width: `${Math.max(6, item.share * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {spotifyLive.contextMix.message ?? t("dashboard.live.contextMix.empty")}
                    </p>
                  )}
                </section>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <section className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 shadow-lg shadow-emerald-500/10">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">{t("dashboard.live.library.title")}</h3>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      {t("dashboard.live.library.subtitle")}
                    </span>
                  </div>

                  {spotifyLive.library.data ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[#23434c] bg-[#0c2029] p-3">
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                            {t("dashboard.live.library.totalSaved")}
                          </p>
                          <p className="mt-1 text-xl font-semibold text-white">
                            {spotifyLive.library.data.totalSavedTracks.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#23434c] bg-[#0c2029] p-3">
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                            {t("dashboard.live.library.unplayedSaved")}
                          </p>
                          <p className="mt-1 text-xl font-semibold text-white">
                            {spotifyLive.library.data.unplayedSavedTracks.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {libraryMonthlyAdds.map((point) => (
                          <div key={`month-${point.monthKey}`} className="flex items-center gap-3 text-xs">
                            <span className="w-14 shrink-0 text-slate-400">{point.monthKey}</span>
                            <div className="h-2 flex-1 rounded-full bg-[#1d3740]">
                              <div
                                className="h-2 rounded-full bg-linear-to-r from-[#1dd6a7] to-[#2ba8ff]"
                                style={{
                                  width: `${maxLibraryMonthlyAdd > 0 ? Math.max(4, (point.count / maxLibraryMonthlyAdd) * 100) : 0}%`,
                                }}
                              />
                            </div>
                            <span className="w-8 text-right text-slate-300">{point.count}</span>
                          </div>
                        ))}
                      </div>

                      {recentSavedTracks.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                            {t("dashboard.live.library.recentSongs")}
                          </p>
                          {recentSavedTracks.slice(0, 4).map((track) => (
                            <CompactPlaybackTrackItem
                              key={`saved-track-${track.trackId}-${track.addedAt}`}
                              track={{
                                id: track.trackId,
                                name: track.name,
                                artistName: track.artistName || t("dashboard.live.unknownArtist"),
                                albumImageUrl: track.imageUrl,
                              }}
                              subtitle={track.artistName || t("dashboard.live.unknownArtist")}
                              trailing={
                                <span className="rounded-full border border-[#315f66] bg-[#112b35] px-2 py-1 text-[11px] text-[#bfe5dc]">
                                  {track.addedAt.slice(0, 10)}
                                </span>
                              }
                              isPremium={isPremium}
                              onOpenPlayback={openPlayerForTrack}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {spotifyLive.library.message ?? t("dashboard.live.library.empty")}
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 shadow-lg shadow-emerald-500/10">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">{t("dashboard.live.playlists.title")}</h3>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      {t("dashboard.live.playlists.subtitle")}
                    </span>
                  </div>

                  {spotifyLive.playlists.data ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {topPlaylists.slice(0, 6).map((playlist) => (
                          <CompactPlaylistItem
                            key={`playlist-${playlist.id}`}
                            id={playlist.id}
                            name={playlist.name}
                            imageUrl={playlist.imageUrl}
                            meta={t("dashboard.live.playlists.activityWithCount", {
                              count: playlist.tracksTotal,
                              adds: playlist.recentAdds30d,
                              contributors: playlist.contributorCount,
                            })}
                            isSelected={selectedPlaylistId === playlist.id}
                            onSelect={openPlaylistTracks}
                          />
                        ))}
                      </div>

                      {selectedPlaylist ? (
                        <PlaylistTracksPanel
                          playlistName={selectedPlaylist.name}
                          tracks={selectedPlaylistTracks}
                          isLoading={playlistTracksLoadingId === selectedPlaylist.id}
                          error={selectedPlaylistError}
                          isPremium={isPremium}
                          onOpenPlayback={openPlayerForTrack}
                          onClose={() => setSelectedPlaylistId(null)}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {spotifyLive.playlists.message ?? t("dashboard.live.playlists.empty")}
                    </p>
                  )}
                </section>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 shadow-lg shadow-emerald-500/10">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">{t("dashboard.live.releases.title")}</h3>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      {t("dashboard.live.releases.subtitle")}
                    </span>
                  </div>

                  {spotifyLive.releases.data && releaseRadar.length > 0 ? (
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {releaseRadar.slice(0, 8).map((release) =>
                          release.albumType === "single" ? (
                            <CompactPlaybackTrackItem
                              key={`release-single-${release.id}`}
                              track={{
                                id: release.primaryTrack?.id ?? release.id,
                                name: release.primaryTrack?.name ?? release.name,
                                artistName:
                                  release.primaryTrack?.artistName ??
                                  release.artistName ??
                                  t("dashboard.live.unknownArtist"),
                                albumImageUrl: release.primaryTrack?.albumImageUrl ?? release.imageUrl,
                              }}
                              subtitle={
                                release.primaryTrack?.artistName ??
                                release.artistName ??
                                t("dashboard.live.unknownArtist")
                              }
                              trailing={
                                <span className="rounded-full border border-[#2f6070] bg-[#123142] px-2 py-1 text-[11px] text-[#bee8f1]">
                                  {t("dashboard.live.releases.singleLabel")}
                                </span>
                              }
                              isPremium={isPremium}
                              onOpenPlayback={(track) => {
                                if (release.primaryTrack) {
                                  openPlayerForTrack(track);
                                  return;
                                }
                                void playSingleFromRelease({
                                  id: release.id,
                                  primaryTrack: release.primaryTrack,
                                });
                              }}
                            />
                          ) : (
                            <CompactPlaylistItem
                              key={`release-album-${release.id}`}
                              id={release.id}
                              name={release.name}
                              imageUrl={release.imageUrl}
                              meta={t("dashboard.live.releases.albumMeta", {
                                artist: release.artistName,
                                date: release.releaseDate,
                              })}
                              isSelected={selectedReleaseAlbumId === release.id}
                              onSelect={() => {
                                void openReleaseAlbumTracks(release.id);
                              }}
                            />
                          )
                        )}
                      </div>

                      {selectedReleaseAlbum ? (
                        <PlaylistTracksPanel
                          playlistName={selectedReleaseAlbum.name}
                          tracks={selectedReleaseAlbumTracks}
                          isLoading={releaseTracksLoadingId === selectedReleaseAlbum.id}
                          error={selectedReleaseAlbumError}
                          isPremium={isPremium}
                          onOpenPlayback={openPlayerForTrack}
                          onClose={() => setSelectedReleaseAlbumId(null)}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {spotifyLive.releases.message ?? t("dashboard.live.releases.empty")}
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 shadow-lg shadow-emerald-500/10">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">{t("dashboard.live.playback.title")}</h3>
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      {t("dashboard.live.playback.subtitle")}
                    </span>
                  </div>

                  {spotifyLive.playbackHealth.data ? (
                    <div className="space-y-2 text-sm">
                      <div className="rounded-lg border border-[#23434c] bg-[#0c2029] px-3 py-2">
                        <p className="text-slate-400">{t("dashboard.live.playback.activeDevice")}</p>
                        <p className="font-semibold text-white">
                          {spotifyLive.playbackHealth.data.activeDeviceName ??
                            t("dashboard.live.playback.noActiveDevice")}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[#23434c] bg-[#0c2029] px-3 py-2">
                          <p className="text-xs text-slate-400">{t("dashboard.live.playback.devices")}</p>
                          <p className="text-base font-semibold text-white">
                            {spotifyLive.playbackHealth.data.availableDevices}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#23434c] bg-[#0c2029] px-3 py-2">
                          <p className="text-xs text-slate-400">{t("dashboard.live.playback.queue")}</p>
                          <p className="text-base font-semibold text-white">
                            {spotifyLive.playbackHealth.data.queueLength}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          {
                            label: t("dashboard.live.playback.skipNext"),
                            ok: spotifyLive.playbackHealth.data.canSkipNext,
                          },
                          {
                            label: t("dashboard.live.playback.skipPrevious"),
                            ok: spotifyLive.playbackHealth.data.canSkipPrevious,
                          },
                          {
                            label: t("dashboard.live.playback.seek"),
                            ok: spotifyLive.playbackHealth.data.canSeek,
                          },
                          {
                            label: t("dashboard.live.playback.shuffle"),
                            ok: spotifyLive.playbackHealth.data.canToggleShuffle,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className={`rounded-lg border px-2 py-1.5 ${
                              item.ok
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                            }`}
                          >
                            {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      {spotifyLive.playbackHealth.message ?? t("dashboard.live.playback.empty")}
                    </p>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 shadow-lg shadow-emerald-500/10">
              <p className="text-sm text-slate-400">
                {t("dashboard.live.unavailable")}
              </p>
            </div>
          )) : null}
        </section>
        ) : null}
      </div>

      <SpotifyPlaybackModal
        isOpen={isPlayerModalOpen}
        isPremium={isPremium}
        track={playerSeedTrack}
        playbackRequestId={playbackRequestId}
        onClose={() => setIsPlayerModalOpen(false)}
        onOpen={() => setIsPlayerModalOpen(true)}
      />
    </main>
  );
}
