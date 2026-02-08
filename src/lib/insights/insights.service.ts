import {
  getTotalListeningStats,
  getTopTracks,
  getDailyListeningActivity,
  getUserLastSyncedAt,
  type TotalListeningStats,
  type TopTrack,
  type DailyListeningActivity,
} from "@/src/lib/insights/insights.repository";

/**
 * Data Transfer Object for insights overview
 */
export interface InsightsOverviewDTO {
  stats: TotalListeningStats;
  topTracks: TopTrack[];
  dailyActivity: DailyListeningActivity[];
  lastSyncedAt: string | null;
}

/**
 * Service for aggregating listening insights
 * Orchestrates repository calls and returns structured data
 */
export async function getInsightsOverview(
  userId: string,
  timeZone?: string | null
): Promise<InsightsOverviewDTO> {
  // Fetch all data in parallel for better performance
  const [stats, topTracks, dailyActivity, lastSyncedAt] = await Promise.all([
    getTotalListeningStats(userId),
    getTopTracks(userId),
    getDailyListeningActivity(userId, timeZone),
    getUserLastSyncedAt(userId),
  ]);

  return {
    stats,
    topTracks,
    dailyActivity,
    lastSyncedAt: lastSyncedAt ? lastSyncedAt.toISOString() : null,
  };
}
