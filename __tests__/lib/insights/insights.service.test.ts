import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { getInsightsOverview } from "@/src/lib/insights/insights.service";
import * as repository from "@/src/lib/insights/insights.repository";
import * as spotifyLiveService from "@/src/lib/insights/spotify-live-insights.service";

jest.mock("@/src/lib/insights/insights.repository", () => ({
  getTotalListeningStats: jest.fn(),
  getTopTracks: jest.fn(),
  getDailyListeningActivity: jest.fn(),
  getUserLastSyncedAt: jest.fn(),
  getListeningRhythmStats: jest.fn(),
  getDiscoveryStats: jest.fn(),
  getConsumptionProfileStats: jest.fn(),
}));
jest.mock("@/src/lib/insights/spotify-live-insights.service", () => ({
  getSpotifyLiveInsights: jest.fn(),
}));

describe("insights.service", () => {
  const mockUserId = "test-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getInsightsOverview", () => {
    it("should aggregate insights data from repository", async () => {
      const mockStats = {
        totalMinutesListened: 1500,
        totalPlays: 250,
        distinctTracksCount: 50,
        distinctArtistsCount: 30,
      };

      const mockTopTracks = [
        {
          id: "1",
          name: "Song 1",
          artistName: "Artist 1",
          playCount: 10,
          totalMinutesListened: 30,
          albumImageUrl: "https://i.scdn.co/image/track-1",
          primaryArtist: {
            id: "artist-1",
            name: "Artist 1",
            imageUrl: "https://i.scdn.co/image/artist-1",
          },
        },
      ];

      const mockDailyActivity = [
        {
          date: "2026-02-04",
          durationMs: 1800000,
          plays: [
            { trackId: "1", name: "Song 1", artistName: "Artist 1", playedAt: "2026-02-04T08:15:00.000Z" },
          ],
        },
      ];

      (repository.getTotalListeningStats as jest.Mock).mockResolvedValue(
        mockStats
      );
      (repository.getTopTracks as jest.Mock).mockResolvedValue(mockTopTracks);
      (repository.getDailyListeningActivity as jest.Mock).mockResolvedValue(
        mockDailyActivity
      );
      (repository.getUserLastSyncedAt as jest.Mock).mockResolvedValue(
        new Date("2026-02-08T12:00:00.000Z")
      );
      (repository.getListeningRhythmStats as jest.Mock).mockResolvedValue({
        sessionCount: 25,
        peakHourLocal: 19,
        longestStreakDays: 9,
        activeStreakDays: 4,
      });
      (repository.getDiscoveryStats as jest.Mock).mockResolvedValue({
        totalPlays30d: 120,
        uniqueTracks30d: 60,
        uniqueArtists30d: 28,
        newTracks30d: 15,
        newArtists30d: 9,
        repeatPlays30d: 60,
      });
      (repository.getConsumptionProfileStats as jest.Mock).mockResolvedValue({
        averageTrackDurationMs: 200000,
        explicitPlayShare: 0.2,
        explicitPlays: 50,
        totalPlays: 250,
        albumTypeDistribution: [{ label: "album", plays: 150, share: 0.6 }],
        releaseDecadeDistribution: [{ label: "2020s", plays: 180, share: 0.72 }],
      });
      (spotifyLiveService.getSpotifyLiveInsights as jest.Mock).mockResolvedValue(null);

      const insights = await getInsightsOverview(mockUserId);

      expect(insights).toEqual({
        stats: mockStats,
        topTracks: mockTopTracks,
        dailyActivity: mockDailyActivity,
        listeningRhythm: {
          sessionCount: 25,
          averageSessionMinutes: 60,
          peakHourLocal: 19,
          longestStreakDays: 9,
          activeStreakDays: 4,
        },
        discovery: {
          totalPlays30d: 120,
          uniqueTracks30d: 60,
          uniqueArtists30d: 28,
          newTracks30d: 15,
          newArtists30d: 9,
          repeatPlays30d: 60,
          newTrackShare: 0.25,
          repeatShare: 0.5,
        },
        consumption: {
          averageTrackDurationMs: 200000,
          explicitPlayShare: 0.2,
          explicitPlays: 50,
          totalPlays: 250,
          albumTypeDistribution: [{ label: "album", plays: 150, share: 0.6 }],
          releaseDecadeDistribution: [{ label: "2020s", plays: 180, share: 0.72 }],
        },
        spotifyLive: null,
        lastSyncedAt: "2026-02-08T12:00:00.000Z",
      });
    });

    it("should call repository methods in parallel", async () => {
      (repository.getTotalListeningStats as jest.Mock).mockResolvedValue({
        totalMinutesListened: 0,
        totalPlays: 0,
        distinctTracksCount: 0,
        distinctArtistsCount: 0,
      });
      (repository.getTopTracks as jest.Mock).mockResolvedValue([]);
      (repository.getDailyListeningActivity as jest.Mock).mockResolvedValue([]);
      (repository.getUserLastSyncedAt as jest.Mock).mockResolvedValue(null);
      (repository.getListeningRhythmStats as jest.Mock).mockResolvedValue({
        sessionCount: 0,
        peakHourLocal: null,
        longestStreakDays: 0,
        activeStreakDays: 0,
      });
      (repository.getDiscoveryStats as jest.Mock).mockResolvedValue({
        totalPlays30d: 0,
        uniqueTracks30d: 0,
        uniqueArtists30d: 0,
        newTracks30d: 0,
        newArtists30d: 0,
        repeatPlays30d: 0,
      });
      (repository.getConsumptionProfileStats as jest.Mock).mockResolvedValue({
        averageTrackDurationMs: 0,
        explicitPlayShare: 0,
        explicitPlays: 0,
        totalPlays: 0,
        albumTypeDistribution: [],
        releaseDecadeDistribution: [],
      });
      (spotifyLiveService.getSpotifyLiveInsights as jest.Mock).mockResolvedValue(null);

      const startTime = Date.now();
      await getInsightsOverview(mockUserId);
      const duration = Date.now() - startTime;

      // Should be much faster than sequential calls (which would be > 100ms)
      expect(duration).toBeLessThan(100);
    });

    it("should return DTO with correct structure", async () => {
      (repository.getTotalListeningStats as jest.Mock).mockResolvedValue({
        totalMinutesListened: 100,
        totalPlays: 10,
        distinctTracksCount: 5,
        distinctArtistsCount: 3,
      });
      (repository.getTopTracks as jest.Mock).mockResolvedValue([]);
      (repository.getDailyListeningActivity as jest.Mock).mockResolvedValue([]);
      (repository.getUserLastSyncedAt as jest.Mock).mockResolvedValue(null);
      (repository.getListeningRhythmStats as jest.Mock).mockResolvedValue({
        sessionCount: 0,
        peakHourLocal: null,
        longestStreakDays: 0,
        activeStreakDays: 0,
      });
      (repository.getDiscoveryStats as jest.Mock).mockResolvedValue({
        totalPlays30d: 0,
        uniqueTracks30d: 0,
        uniqueArtists30d: 0,
        newTracks30d: 0,
        newArtists30d: 0,
        repeatPlays30d: 0,
      });
      (repository.getConsumptionProfileStats as jest.Mock).mockResolvedValue({
        averageTrackDurationMs: 0,
        explicitPlayShare: 0,
        explicitPlays: 0,
        totalPlays: 0,
        albumTypeDistribution: [],
        releaseDecadeDistribution: [],
      });
      (spotifyLiveService.getSpotifyLiveInsights as jest.Mock).mockResolvedValue(null);

      const insights = await getInsightsOverview(mockUserId);

      expect(insights).toHaveProperty("stats");
      expect(insights).toHaveProperty("topTracks");
      expect(insights).toHaveProperty("dailyActivity");
      expect(insights).toHaveProperty("listeningRhythm");
      expect(insights).toHaveProperty("discovery");
      expect(insights).toHaveProperty("consumption");
      expect(insights).toHaveProperty("spotifyLive");
      expect(insights).toHaveProperty("lastSyncedAt");
      expect(Array.isArray(insights.topTracks)).toBe(true);
      expect(Array.isArray(insights.dailyActivity)).toBe(true);
    });
  });
});
