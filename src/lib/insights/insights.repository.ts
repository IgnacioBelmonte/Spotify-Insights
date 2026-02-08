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
  durationMs: number;
  plays: Array<{
    trackId: string;
    name: string;
    artistName: string;
    playedAt: string;
  }>;
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
          SUM(CAST(t."durationMs" AS BIGINT)) / 60000 AS INTEGER
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
            SUM(CAST(t."durationMs" AS BIGINT)) / 60000 AS INTEGER
          ),
          0
        ) AS total_minutes_listened
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
 * Fetches daily listening activity for a user
 */
export async function getDailyListeningActivity(
  userId: string,
  timeZone?: string | null
): Promise<DailyListeningActivity[]> {
  const tz = timeZone && timeZone.trim().length > 0 ? timeZone.trim() : "UTC";
  const dailyActivity = await prisma.$queryRaw<
    Array<{
      date: string;
      total_duration_ms: number;
      plays: Array<{
        trackId: string;
        name: string;
        artistName: string;
        playedAt: string;
      }> | null;
    }>
  >`
    WITH events AS (
      SELECT DISTINCT ON (le."trackId", le."playedAt")
        DATE(le."playedAt" AT TIME ZONE ${tz}) AS date_local,
        le."durationMs" AS duration_ms,
        le."trackId" AS track_id,
        le."playedAt" AS played_at,
        t."name" AS track_name,
        t."artistName" AS artist_name
      FROM "ListeningEvent" le
      JOIN "Track" t ON le."trackId" = t."id"
      WHERE le."userId" = ${userId}
      ORDER BY le."trackId", le."playedAt"
    ),
    daily_totals AS (
      SELECT
        e.date_local,
        COALESCE(CAST(SUM(CAST(e.duration_ms AS BIGINT)) AS BIGINT), 0) AS total_duration_ms
      FROM events e
      GROUP BY e.date_local
    )
    SELECT
      CAST(dt.date_local AS Date) AS date,
      dt.total_duration_ms,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'trackId', e.track_id,
            'name', e.track_name,
            'artistName', e.artist_name,
            'playedAt', e.played_at
          )
          ORDER BY e.played_at ASC
        ) FILTER (WHERE e.track_id IS NOT NULL),
        '[]'::json
      ) AS plays
    FROM daily_totals dt
    LEFT JOIN events e ON e.date_local = dt.date_local
    GROUP BY dt.date_local, dt.total_duration_ms
    ORDER BY date DESC
  `;

  return dailyActivity.map((activity) => ({
    date: activity.date,
    durationMs: Number(activity.total_duration_ms),
    plays: Array.isArray(activity.plays) ? activity.plays : [],
  }));
}
