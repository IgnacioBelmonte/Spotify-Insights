"use client";

import { useEffect, useState } from "react";
import type { InsightsOverviewDTO } from "@/src/lib/insights/insights.service";

export function InsightsOverview() {
  const [insights, setInsights] = useState<InsightsOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch("/api/insights/overview", {
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

  if (loading) {
    return (
      <main className="min-h-screen bg-linear-to-b from-black via-slate-900 to-slate-800 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-slate-300">Loading insights...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-linear-to-b from-black via-slate-900 to-slate-800 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
            Error: {error}
          </div>
        </div>
      </main>
    );
  }

  if (!insights) {
    return (
      <main className="min-h-screen bg-linear-to-b from-black via-slate-900 to-slate-800 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-slate-300">No insights data available</p>
        </div>
      </main>
    );
  }

  const { stats, topTracks, dailyActivity } = insights;

  return (
    <main className="min-h-screen bg-linear-to-b from-black via-slate-900 to-slate-800 text-white p-6" suppressHydrationWarning>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-300 text-sm font-medium">Total Minutes</p>
            <p className="text-3xl font-bold text-white mt-2">
              {stats.totalMinutesListened.toLocaleString()}
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-300 text-sm font-medium">Total Plays</p>
            <p className="text-3xl font-bold text-white mt-2">
              {stats.totalPlays.toLocaleString()}
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-300 text-sm font-medium">Unique Tracks</p>
            <p className="text-3xl font-bold text-white mt-2">
              {stats.distinctTracksCount.toLocaleString()}
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-300 text-sm font-medium">Unique Artists</p>
            <p className="text-3xl font-bold text-white mt-2">
              {stats.distinctArtistsCount.toLocaleString()}
            </p>
          </div>
        </section>

        {/* Top Tracks */}
        <section className="bg-slate-900/60 border border-slate-700 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Top Tracks</h2>
          <div className="space-y-2">
            {topTracks.length > 0 ? (
              topTracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
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
        <section className="bg-slate-900/60 border border-slate-700 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Recent Activity (Last 90 Days)</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {dailyActivity.length > 0 ? (
              dailyActivity.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-white">{day.date}</p>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <p>{day.playsCount} plays</p>
                    <p className="text-xs text-slate-500">{day.minutesListened} min</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center py-4">No activity data</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
