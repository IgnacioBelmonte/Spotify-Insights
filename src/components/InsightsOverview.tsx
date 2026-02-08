"use client";

import { useEffect, useState } from "react";
import type { InsightsOverviewDTO } from "@/src/lib/insights/insights.service";
import DailyListeningChart from "./charts/DailyListeningChart";
import { SyncWidget } from "./SyncWidget";

export function InsightsOverview() {
  const [insights, setInsights] = useState<InsightsOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        throw new Error(`Failed to fetch insights: ${res.status}`);
      }
      return res.json();
    }

    fetchInsights()
      .then((data) => {
        if (active) setInsights(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unknown error");
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
      throw new Error(`Failed to refresh insights: ${res.status}`);
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
            <p className="text-slate-300">Loading insights...</p>
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
            Error: {error}
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
            No insights data available
          </div>
        </div>
      </main>
    );
  }

  const { stats, topTracks, dailyActivity, lastSyncedAt } = insights;
  const maxPlays = topTracks.reduce((max, track) => Math.max(max, track.playCount), 1);
  const statCards = [
    {
      label: "Total Minutes",
      value: stats.totalMinutesListened.toLocaleString(),
      caption: "min listened",
    },
    {
      label: "Total Plays",
      value: stats.totalPlays.toLocaleString(),
      caption: "plays tracked",
    },
    {
      label: "Unique Tracks",
      value: stats.distinctTracksCount.toLocaleString(),
      caption: "songs discovered",
    },
    {
      label: "Unique Artists",
      value: stats.distinctArtistsCount.toLocaleString(),
      caption: "artists explored",
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
              Dashboard
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Your listening, amplified
              <span className="block text-emerald-300">every single day.</span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg max-w-xl">
              A living snapshot of your Spotify habits. Track momentum, discover patterns, and stay in control.
            </p>
          </div>

          <SyncWidget
            variant="hero"
            initialLastSyncedAt={lastSyncedAt}
            onSynced={refreshInsights}
            title="Sincronizacion inteligente"
            description="Actualiza tus reproducciones recientes para mantener el dashboard al dia."
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
              <h2 className="text-2xl font-semibold">Top Tracks</h2>
              <span className="text-xs text-slate-400 uppercase tracking-wide">Your repeaters</span>
            </div>
            <div className="space-y-3">
              {topTracks.length > 0 ? (
                topTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="rounded-xl border border-transparent bg-[#12222c]/70 p-4 transition hover:border-[#1b3a40] hover:bg-[#162a35]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-emerald-200 font-semibold">#{idx + 1}</p>
                        <p className="font-semibold text-white">{track.name}</p>
                        <p className="text-sm text-slate-400">{track.artistName}</p>
                      </div>
                      <div className="text-right text-sm text-slate-300">
                        <p>{track.playCount} plays</p>
                        <p className="text-xs text-slate-500">{track.totalMinutesListened} min</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-[#0b1820] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                        style={{ width: `${Math.round((track.playCount / maxPlays) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-4">No tracks available</p>
              )}
            </div>
          </div>

          <div className="bg-[#0f1b24]/85 border border-[#1b3a40] rounded-2xl p-6 shadow-lg shadow-emerald-500/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Daily Activity</h2>
              <span className="text-xs text-slate-400 uppercase tracking-wide">Time spent</span>
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
    </main>
  );
}
