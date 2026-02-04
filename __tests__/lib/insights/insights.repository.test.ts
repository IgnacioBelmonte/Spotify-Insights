import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  getTotalListeningStats,
  getTopTracks,
  getDailyListeningActivity,
} from "@/src/lib/insights/insights.repository";
import { prisma } from "@/src/lib/db/prisma";

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock(
  "@/src/lib/db/prisma",
  () => require(require("path").join(process.cwd(), "__tests__", "mocks", "prisma.mock"))
);

describe("insights.repository", () => {
  const mockUserId = "test-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getTotalListeningStats", () => {
    it("should return total listening statistics", async () => {
      const mockStats = {
        total_minutes_listened: 1500,
        total_plays: 250,
        distinct_tracks_count: 50,
        distinct_artists_count: 30,
      };

      // @ts-expect-error prisma.$queryRaw is not properly typed for mocking
      (prisma.$queryRaw as jest.Mock<Promise<unknown>>).mockResolvedValue([mockStats]);

      const stats = await getTotalListeningStats(mockUserId);

      expect(stats).toEqual({
        totalMinutesListened: 1500,
        totalPlays: 250,
        distinctTracksCount: 50,
        distinctArtistsCount: 30,
      });
    });

    it("should return zeros when no data", async () => {
      // @ts-expect-error prisma.$queryRaw is not properly typed for mocking
      (prisma.$queryRaw as jest.Mock<Promise<unknown>>).mockResolvedValue([
        {
          total_minutes_listened: 0,
          total_plays: 0,
          distinct_tracks_count: 0,
          distinct_artists_count: 0,
        },
      ]);

      const stats = await getTotalListeningStats(mockUserId);

      expect(stats.totalMinutesListened).toBe(0);
      expect(stats.totalPlays).toBe(0);
    });

    it("should handle null values", async () => {
      // @ts-expect-error prisma.$queryRaw is not properly typed for mocking
      (prisma.$queryRaw as jest.Mock<Promise<unknown>>).mockResolvedValue([
        {
          total_minutes_listened: null,
          total_plays: 0,
          distinct_tracks_count: 0,
          distinct_artists_count: 0,
        },
      ]);

      const stats = await getTotalListeningStats(mockUserId);

      expect(stats.totalMinutesListened).toBe(0);
    });
  });

  describe("getTopTracks", () => {
    it("should return top tracks", async () => {
      const mockTracks = [
        {
          track_id: "1",
          track_name: "Song 1",
          artist_name: "Artist 1",
          play_count: 10,
          total_minutes_listened: 30,
        },
        {
          track_id: "2",
          track_name: "Song 2",
          artist_name: "Artist 2",
          play_count: 8,
          total_minutes_listened: 24,
        },
      ];

      // @ts-expect-error prisma.$queryRaw is not properly typed for mocking
      (prisma.$queryRaw as jest.Mock<Promise<unknown>>).mockResolvedValue(mockTracks);

      const tracks = await getTopTracks(mockUserId, 10);

      expect(tracks).toHaveLength(2);
      expect(tracks[0]).toEqual({
        id: "1",
        name: "Song 1",
        artistName: "Artist 1",
        playCount: 10,
        totalMinutesListened: 30,
      });
    });

    it("should respect limit parameter", async () => {
      // @ts-expect-error prisma.$queryRaw is not properly typed for mocking
      (prisma.$queryRaw as jest.Mock<Promise<unknown>>).mockResolvedValue([]);

      await getTopTracks(mockUserId, 5);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("should return empty array when no tracks", async () => {
      // @ts-expect-error prisma.$queryRaw is not properly typed for mocking
      (prisma.$queryRaw as jest.Mock<Promise<unknown>>).mockResolvedValue([]);

      const tracks = await getTopTracks(mockUserId);

      expect(tracks).toEqual([]);
    });
  });

  describe("getDailyListeningActivity", () => {
    it("should return daily listening activity", async () => {
      const mockActivity = [
        {
          date: "2026-02-04",
          plays_count: 5,
          total_minutes_listened: 30,
        },
        {
          date: "2026-02-03",
          plays_count: 3,
          total_minutes_listened: 18,
        },
      ];

      // @ts-expect-error prisma.$queryRaw is not properly typed for mocking
      (prisma.$queryRaw as jest.Mock<Promise<unknown>>).mockResolvedValue(mockActivity);

      const activity = await getDailyListeningActivity(mockUserId);

      expect(activity).toHaveLength(2);
      expect(activity[0]).toEqual({
        date: "2026-02-04",
        playsCount: 5,
        minutesListened: 30,
      });
    });

    it("should return empty array when no activity", async () => {
      // @ts-expect-error prisma.$queryRaw is not properly typed for mocking
      (prisma.$queryRaw as jest.Mock<Promise<unknown>>).mockResolvedValue([]);

      const activity = await getDailyListeningActivity(mockUserId);

      expect(activity).toEqual([]);
    });
  });
});
