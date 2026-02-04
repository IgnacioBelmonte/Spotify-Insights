import { prisma } from "@/src/lib/db/prisma";

export interface TotalListeningStats {
  totalMinutesListened: number;
  totalPlays: number;
  distinctTracksCount: number;
  distinctArtistsCount: number;
}

export interface TopTrack {
  id: string;
  name: string;
  artistName: string;
  playCount: number;
  totalMinutesListened: number;
}

export interface DailyListeningActivity {
  date: string; // ISO date string (YYYY-MM-DD)
  playsCount: number;
  minutesListened: number;
}

/**
 * Fetches total listening statistics for a user
 */
export async function getTotalListeningStats(
  userId: string
): Promise<TotalListeningStats> {
  const [stats] = await prisma.$queryRaw<
    Array<{
      total_minutes_listened: number | null;
      total_plays: number;
      distinct_tracks_count: number;
      distinct_artists_count: number;
    }>
  >`
    SELECT
      COALESCE(
        CAST(
          SUM(CAST(t."durationMs" AS BIGINT)) / 60000 AS BIGINT
        ),
        0
      ) AS total_minutes_listened,
      COUNT(le."id")::INTEGER AS total_plays,
      COUNT(DISTINCT le."trackId")::INTEGER AS distinct_tracks_count,
      COUNT(DISTINCT t."artistName")::INTEGER AS distinct_artists_count
    FROM "ListeningEvent" le
    JOIN "Track" t ON le."trackId" = t."id"
    WHERE le."userId" = ${userId}
  `;

  return {
    totalMinutesListened: stats?.total_minutes_listened ?? 0,
    totalPlays: stats?.total_plays ?? 0,
    distinctTracksCount: stats?.distinct_tracks_count ?? 0,
    distinctArtistsCount: stats?.distinct_artists_count ?? 0,
  };
}

/**
 * Fetches top tracks by play count for a user
 */
export async function getTopTracks(userId: string, limit: number = 10): Promise<TopTrack[]> {
  const topTracks = await prisma.$queryRaw<
    Array<{
      track_id: string;
      track_name: string;
      artist_name: string;
      play_count: number;
      total_minutes_listened: number;
    }>
  >`
    SELECT
      t."id" AS track_id,
      t."name" AS track_name,
      t."artistName" AS artist_name,
      COUNT(le."id")::INTEGER AS play_count,
      COALESCE(
        CAST(
          SUM(CAST(t."durationMs" AS BIGINT)) / 60000 AS BIGINT
        ),
        0
      )::INTEGER AS total_minutes_listened
    FROM "ListeningEvent" le
    JOIN "Track" t ON le."trackId" = t."id"
    WHERE le."userId" = ${userId}
    GROUP BY t."id", t."name", t."artistName"
    ORDER BY play_count DESC
    LIMIT ${limit}
  `;

  return topTracks.map((track) => ({
    id: track.track_id,
    name: track.track_name,
    artistName: track.artist_name,
    playCount: track.play_count,
    totalMinutesListened: track.total_minutes_listened,
  }));
}

/**
 * Fetches daily listening activity for a user (last 90 days)
 */
export async function getDailyListeningActivity(
  userId: string
): Promise<DailyListeningActivity[]> {
  const dailyActivity = await prisma.$queryRaw<
    Array<{
      date: string;
      plays_count: number;
      total_minutes_listened: number;
    }>
  >`
    SELECT
      DATE(le."playedAt") AS date,
      COUNT(le."id")::INTEGER AS plays_count,
      COALESCE(
        CAST(
          SUM(CAST(t."durationMs" AS BIGINT)) / 60000 AS BIGINT
        ),
        0
      )::INTEGER AS total_minutes_listened
    FROM "ListeningEvent" le
    JOIN "Track" t ON le."trackId" = t."id"
    WHERE le."userId" = ${userId}
      AND le."playedAt" >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(le."playedAt")
    ORDER BY date DESC
  `;

  return dailyActivity.map((activity) => ({
    date: activity.date,
    playsCount: activity.plays_count,
    minutesListened: activity.total_minutes_listened,
  }));
}
