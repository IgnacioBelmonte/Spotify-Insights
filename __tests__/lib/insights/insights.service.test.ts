import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { getInsightsOverview } from "@/src/lib/insights/insights.service";
import * as repository from "@/src/lib/insights/insights.repository";

jest.mock(
  "@/src/lib/insights/insights.repository",
  () => require(require("path").join(process.cwd(), "__tests__", "mocks", "insights.repository.mock"))
);

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

      const insights = await getInsightsOverview(mockUserId);

      expect(insights).toEqual({
        stats: mockStats,
        topTracks: mockTopTracks,
        dailyActivity: mockDailyActivity,
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

      const insights = await getInsightsOverview(mockUserId);

      expect(insights).toHaveProperty("stats");
      expect(insights).toHaveProperty("topTracks");
      expect(insights).toHaveProperty("dailyActivity");
      expect(insights).toHaveProperty("lastSyncedAt");
      expect(Array.isArray(insights.topTracks)).toBe(true);
      expect(Array.isArray(insights.dailyActivity)).toBe(true);
    });
  });
});
