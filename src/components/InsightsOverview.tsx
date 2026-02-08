"use client";

import { useEffect, useState } from "react";
import type { InsightsOverviewDTO } from "@/src/lib/insights/insights.service";
import DailyListeningChart from "./charts/DailyListeningChart";
import { SyncWidget } from "./SyncWidget";
import { t } from "@/src/lib/i18n";
import { SpotifyPlaybackModal } from "./tracks/SpotifyPlaybackModal";
import { TrackCard, type TrackCardData } from "./tracks/TrackCard";

interface InsightsOverviewProps {
  isPremium: boolean;
}

export function InsightsOverview({ isPremium }: InsightsOverviewProps) {
  const [insights, setInsights] = useState<InsightsOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackCardData | null>(null);
  const [timeZone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  });

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

  const { stats, topTracks, dailyActivity, lastSyncedAt } = insights;
  const maxPlays = topTracks.reduce((max, track) => Math.max(max, track.playCount), 1);
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

        <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="bg-[#0f1b24]/85 border border-[#1b3a40] rounded-2xl p-6 shadow-lg shadow-emerald-500/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">{t("dashboard.topTracks.title")}</h2>
              <span className="text-xs text-slate-400 uppercase tracking-wide">
                {t("dashboard.topTracks.subtitle")}
              </span>
            </div>
            <div className="space-y-4">
              {topTracks.length > 0 ? (
                topTracks.map((track, idx) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    rank={idx + 1}
                    maxPlays={maxPlays}
                    isPremium={isPremium}
                    onOpenPlayback={setSelectedTrack}
                  />
                ))
              ) : (
                <p className="text-slate-400 text-center py-4">
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
                plays: day.plays ?? [],
              }))}
              variant="embedded"
            />
          </div>
        </section>
      </div>

      <SpotifyPlaybackModal
        isOpen={Boolean(selectedTrack)}
        isPremium={isPremium}
        track={selectedTrack}
        onClose={() => setSelectedTrack(null)}
      />
    </main>
  );
}
