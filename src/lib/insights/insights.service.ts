import {
  getTotalListeningStats,
  getTopTracks,
  getDailyListeningActivity,
  getUserLastSyncedAt,
  getListeningRhythmStats,
  getDiscoveryStats,
  getConsumptionProfileStats,
  type TotalListeningStats,
  type TopTrack,
  type DailyListeningActivity,
  type DistributionPoint,
} from "@/src/lib/insights/insights.repository";
import {
  getSpotifyLiveInsights,
  type SpotifyLiveInsights,
} from "@/src/lib/insights/spotify-live-insights.service";

export interface ListeningRhythmOverview {
  sessionCount: number;
  averageSessionMinutes: number;
  peakHourLocal: number | null;
  longestStreakDays: number;
  activeStreakDays: number;
}

export interface DiscoveryOverview {
  totalPlays30d: number;
  uniqueTracks30d: number;
  uniqueArtists30d: number;
  newTracks30d: number;
  newArtists30d: number;
  repeatPlays30d: number;
  newTrackShare: number;
  repeatShare: number;
}

export interface ConsumptionOverview {
  averageTrackDurationMs: number;
  explicitPlayShare: number;
  explicitPlays: number;
  totalPlays: number;
  albumTypeDistribution: DistributionPoint[];
  releaseDecadeDistribution: DistributionPoint[];
}

/**
 * Data Transfer Object for insights overview
 */
export interface InsightsOverviewDTO {
  stats: TotalListeningStats;
  topTracks: TopTrack[];
  dailyActivity: DailyListeningActivity[];
  listeningRhythm: ListeningRhythmOverview;
  discovery: DiscoveryOverview;
  consumption: ConsumptionOverview;
  spotifyLive: SpotifyLiveInsights | null;
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
  const [
    stats,
    topTracks,
    dailyActivity,
    lastSyncedAt,
    rhythmStats,
    discoveryStats,
    consumptionStats,
    spotifyLive,
  ] = await Promise.all([
    getTotalListeningStats(userId),
    getTopTracks(userId),
    getDailyListeningActivity(userId, timeZone),
    getUserLastSyncedAt(userId),
    getListeningRhythmStats(userId, timeZone),
    getDiscoveryStats(userId),
    getConsumptionProfileStats(userId),
    getSpotifyLiveInsights(userId).catch((error) => {
      console.warn("[insights] spotify live insights unavailable", {
        userId,
        error,
      });
      return null;
    }),
  ]);

  const averageSessionMinutes =
    rhythmStats.sessionCount > 0 ? Math.round(stats.totalMinutesListened / rhythmStats.sessionCount) : 0;

  const newTrackShare =
    discoveryStats.uniqueTracks30d > 0
      ? discoveryStats.newTracks30d / discoveryStats.uniqueTracks30d
      : 0;

  const repeatShare =
    discoveryStats.totalPlays30d > 0
      ? discoveryStats.repeatPlays30d / discoveryStats.totalPlays30d
      : 0;

  return {
    stats,
    topTracks,
    dailyActivity,
    listeningRhythm: {
      sessionCount: rhythmStats.sessionCount,
      averageSessionMinutes,
      peakHourLocal: rhythmStats.peakHourLocal,
      longestStreakDays: rhythmStats.longestStreakDays,
      activeStreakDays: rhythmStats.activeStreakDays,
    },
    discovery: {
      totalPlays30d: discoveryStats.totalPlays30d,
      uniqueTracks30d: discoveryStats.uniqueTracks30d,
      uniqueArtists30d: discoveryStats.uniqueArtists30d,
      newTracks30d: discoveryStats.newTracks30d,
      newArtists30d: discoveryStats.newArtists30d,
      repeatPlays30d: discoveryStats.repeatPlays30d,
      newTrackShare,
      repeatShare,
    },
    consumption: {
      averageTrackDurationMs: consumptionStats.averageTrackDurationMs,
      explicitPlayShare: consumptionStats.explicitPlayShare,
      explicitPlays: consumptionStats.explicitPlays,
      totalPlays: consumptionStats.totalPlays,
      albumTypeDistribution: consumptionStats.albumTypeDistribution,
      releaseDecadeDistribution: consumptionStats.releaseDecadeDistribution,
    },
    spotifyLive,
    lastSyncedAt: lastSyncedAt ? lastSyncedAt.toISOString() : null,
  };
}
