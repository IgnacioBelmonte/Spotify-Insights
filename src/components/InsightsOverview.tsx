"use client";

import { useEffect, useState } from "react";
import type { InsightsOverviewDTO } from "@/src/lib/insights/insights.service";
import DailyListeningChart from "./charts/DailyListeningChart";

export function InsightsOverview() {
  const [insights, setInsights] = useState<InsightsOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [timeZone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  });

  const insightsUrl = `/api/insights/overview?tz=${encodeURIComponent(timeZone)}`;

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch(insightsUrl, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch insights: ${res.status}`);
        }
        const data = await res.json();
        setInsights(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync/recently-played", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        setSyncMessage(json?.error ?? "Sync failed.");
        return;
      }
      setSyncMessage("Sync completed. Refreshing insights...");
      // Re-fetch insights after sync
      const insightsRes = await fetch(insightsUrl, {
        credentials: "same-origin",
      });
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data);
      }
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-linear-to-b from-[#06151a] via-[#0b1f2a] to-[#0a0f14] text-[#e6f3f1] p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-slate-300">Loading insights...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-linear-to-b from-[#06151a] via-[#0b1f2a] to-[#0a0f14] text-[#e6f3f1] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-950/40 border border-red-800 rounded-lg p-4 text-red-200">
            Error: {error}
          </div>
        </div>
      </main>
    );
  }

  if (!insights) {
    return (
      <main className="min-h-screen bg-linear-to-b from-[#06151a] via-[#0b1f2a] to-[#0a0f14] text-[#e6f3f1] p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-slate-300">No insights data available</p>
        </div>
      </main>
    );
  }

  const { stats, topTracks, dailyActivity } = insights;

  return (
    <main className="min-h-screen bg-linear-to-b from-[#06151a] via-[#0b1f2a] to-[#0a0f14] text-[#e6f3f1] p-6" suppressHydrationWarning>
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0f1b24]/85 border border-[#1b3a40] rounded-lg p-4 shadow-lg shadow-emerald-500/5">
          <div>
            <h2 className="text-lg font-semibold">Actualiza tu base de datos</h2>
            <p className="text-sm text-[#9cc9c4]">Sincroniza tus últimos escuchados desde Spotify.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#14f1b2] hover:bg-[#5bf2c6] text-[#04221d] font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {syncing ? "Actualizando..." : "Actualizar datos"}
            </button>
            <button
              onClick={() => setSyncMessage(null)}
              className="px-3 py-2 border border-[#2b4a50] rounded-md text-sm text-slate-200 hover:border-[#3a5c61]"
            >
              Limpiar
            </button>
          </div>
          {syncMessage ? (
            <div className="sm:col-span-2 text-sm text-[#dff7f2] bg-[#0b1820] border border-[#1b3a40] rounded-md px-3 py-2">
              {syncMessage}
            </div>
          ) : null}
        </section>

        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0f1b24]/80 border border-[#1b3a40] rounded-lg p-6 shadow-lg shadow-emerald-500/5">
            <p className="text-slate-300 text-sm font-medium">Total Minutes</p>
            <p className="text-3xl font-bold text-white mt-2">
              {stats.totalMinutesListened.toLocaleString()}
            </p>
          </div>

          <div className="bg-[#0f1b24]/80 border border-[#1b3a40] rounded-lg p-6 shadow-lg shadow-emerald-500/5">
            <p className="text-slate-300 text-sm font-medium">Total Plays</p>
            <p className="text-3xl font-bold text-white mt-2">
              {stats.totalPlays.toLocaleString()}
            </p>
          </div>

          <div className="bg-[#0f1b24]/80 border border-[#1b3a40] rounded-lg p-6 shadow-lg shadow-emerald-500/5">
            <p className="text-slate-300 text-sm font-medium">Unique Tracks</p>
            <p className="text-3xl font-bold text-white mt-2">
              {stats.distinctTracksCount.toLocaleString()}
            </p>
          </div>

          <div className="bg-[#0f1b24]/80 border border-[#1b3a40] rounded-lg p-6 shadow-lg shadow-emerald-500/5">
            <p className="text-slate-300 text-sm font-medium">Unique Artists</p>
            <p className="text-3xl font-bold text-white mt-2">
              {stats.distinctArtistsCount.toLocaleString()}
            </p>
          </div>
        </section>

        {/* Top Tracks */}
        <section className="bg-[#0f1b24]/85 border border-[#1b3a40] rounded-lg p-6 shadow-lg shadow-emerald-500/5">
          <h2 className="text-2xl font-bold mb-4">Top Tracks</h2>
          <div className="space-y-2">
            {topTracks.length > 0 ? (
              topTracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-3 bg-[#12222c]/70 rounded-lg hover:bg-[#162a35] transition-colors border border-transparent hover:border-[#1b3a40]"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-white">
                      {idx + 1}. {track.name}
                    </p>
                    <p className="text-sm text-slate-400">{track.artistName}</p>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <p>{track.playCount} plays</p>
                    <p className="text-xs text-slate-500">
                      {track.totalMinutesListened} min
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center py-4">No tracks available</p>
            )}
          </div>
        </section>

        {/* Daily Activity */}
        <section className="bg-[#0f1b24]/85 border border-[#1b3a40] rounded-lg p-6 shadow-lg shadow-emerald-500/5">
          <h2 className="text-2xl font-bold mb-4">Daily Activity</h2>
        <DailyListeningChart
          data={dailyActivity.map((day) => ({
            date: day.date,
            durationMs: day.durationMs,
            tracks: day.tracks ?? [],
          }))}
        />
        </section>
      </div>
    </main>
  );
}
