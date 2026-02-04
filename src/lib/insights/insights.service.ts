import {
  getTotalListeningStats,
  getTopTracks,
  getDailyListeningActivity,
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
}

/**
 * Service for aggregating listening insights
 * Orchestrates repository calls and returns structured data
 */
export async function getInsightsOverview(
  userId: string
): Promise<InsightsOverviewDTO> {
  // Fetch all data in parallel for better performance
  const [stats, topTracks, dailyActivity] = await Promise.all([
    getTotalListeningStats(userId),
    getTopTracks(userId),
    getDailyListeningActivity(userId),
  ]);

  return {
    stats,
    topTracks,
    dailyActivity,
  };
}
