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
  albumImageUrl: string | null;
  primaryArtist: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
}

export interface DailyListeningActivity {
  date: string; // ISO date string (YYYY-MM-DD)
  durationMs: number;
  plays: Array<{
    trackId: string;
    name: string;
    artistName: string;
    playedAt: string;
    albumImageUrl?: string | null;
  }>;
}

export interface ListeningRhythmStats {
  sessionCount: number;
  peakHourLocal: number | null;
  longestStreakDays: number;
  activeStreakDays: number;
}

export interface DiscoveryStats {
  totalPlays30d: number;
  uniqueTracks30d: number;
  uniqueArtists30d: number;
  newTracks30d: number;
  newArtists30d: number;
  repeatPlays30d: number;
}

export interface DistributionPoint {
  label: string;
  plays: number;
  share: number;
}

export interface ConsumptionProfileStats {
  averageTrackDurationMs: number;
  explicitPlayShare: number;
  explicitPlays: number;
  totalPlays: number;
  albumTypeDistribution: DistributionPoint[];
  releaseDecadeDistribution: DistributionPoint[];
}

export interface ContextDistributionStats {
  totalPlays: number;
  distribution: DistributionPoint[];
}

export async function getUserLastSyncedAt(userId: string): Promise<Date | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastSyncedAt: true },
  });

  return user?.lastSyncedAt ?? null;
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
      album_image_url: string | null;
      primary_artist_id: string | null;
      primary_artist_name: string | null;
      primary_artist_image_url: string | null;
    }>
  >`
    SELECT
      t."id" AS track_id,
      t."name" AS track_name,
      t."artistName" AS artist_name,
      t."albumImageUrl" AS album_image_url,
      pa."id" AS primary_artist_id,
      pa."name" AS primary_artist_name,
      pa."imageUrl" AS primary_artist_image_url,
      COUNT(le."id")::INTEGER AS play_count,
        COALESCE(
          CAST(
            SUM(CAST(t."durationMs" AS BIGINT)) / 60000 AS INTEGER
          ),
          0
        ) AS total_minutes_listened
    FROM "ListeningEvent" le
    JOIN "Track" t ON le."trackId" = t."id"
    LEFT JOIN "TrackArtist" ta ON ta."trackId" = t."id" AND ta."position" = 0
    LEFT JOIN "Artist" pa ON pa."id" = ta."artistId"
    WHERE le."userId" = ${userId}
    GROUP BY
      t."id",
      t."name",
      t."artistName",
      t."albumImageUrl",
      pa."id",
      pa."name",
      pa."imageUrl"
    ORDER BY play_count DESC
    LIMIT ${limit}
  `;

  return topTracks.map((track) => ({
    id: track.track_id,
    name: track.track_name,
    artistName: track.artist_name,
    playCount: track.play_count,
    totalMinutesListened: track.total_minutes_listened,
    albumImageUrl: track.album_image_url,
    primaryArtist: track.primary_artist_id
      ? {
          id: track.primary_artist_id,
          name: track.primary_artist_name ?? track.artist_name,
          imageUrl: track.primary_artist_image_url,
        }
      : null,
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
        albumImageUrl?: string | null;
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
        t."artistName" AS artist_name,
        t."albumImageUrl" AS album_image_url
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
            'playedAt', e.played_at,
            'albumImageUrl', e.album_image_url
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

function calculateDayStreaks(orderedDays: string[]): { longest: number; active: number } {
  if (orderedDays.length === 0) {
    return { longest: 0, active: 0 };
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < orderedDays.length; index += 1) {
    const previousDay = new Date(`${orderedDays[index - 1]}T00:00:00Z`);
    const currentDay = new Date(`${orderedDays[index]}T00:00:00Z`);
    const deltaDays = Math.round((currentDay.getTime() - previousDay.getTime()) / 86_400_000);

    if (deltaDays === 1) {
      current += 1;
      if (current > longest) {
        longest = current;
      }
    } else if (deltaDays > 1) {
      current = 1;
    }
  }

  let active = 1;
  for (let index = orderedDays.length - 1; index > 0; index -= 1) {
    const currentDay = new Date(`${orderedDays[index]}T00:00:00Z`);
    const previousDay = new Date(`${orderedDays[index - 1]}T00:00:00Z`);
    const deltaDays = Math.round((currentDay.getTime() - previousDay.getTime()) / 86_400_000);

    if (deltaDays === 1) {
      active += 1;
      continue;
    }

    break;
  }

  return { longest, active };
}

export async function getListeningRhythmStats(
  userId: string,
  timeZone?: string | null
): Promise<ListeningRhythmStats> {
  const tz = timeZone && timeZone.trim().length > 0 ? timeZone.trim() : "UTC";

  const [sessionRow, peakHourRow, streakRows] = await Promise.all([
    prisma.$queryRaw<Array<{ session_count: number }>>`
      WITH ordered_events AS (
        SELECT
          le."playedAt",
          LAG(le."playedAt") OVER (ORDER BY le."playedAt") AS previous_played_at
        FROM "ListeningEvent" le
        WHERE le."userId" = ${userId}
      )
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN previous_played_at IS NULL THEN 1
              WHEN EXTRACT(EPOCH FROM ("playedAt" - previous_played_at)) / 60 > 30 THEN 1
              ELSE 0
            END
          ),
          0
        )::INTEGER AS session_count
      FROM ordered_events
    `,
    prisma.$queryRaw<Array<{ hour_local: number }>>`
      SELECT
        EXTRACT(HOUR FROM (le."playedAt" AT TIME ZONE ${tz}))::INTEGER AS hour_local,
        COUNT(*)::INTEGER AS plays
      FROM "ListeningEvent" le
      WHERE le."userId" = ${userId}
      GROUP BY hour_local
      ORDER BY plays DESC, hour_local ASC
      LIMIT 1
    `,
    prisma.$queryRaw<Array<{ day_local: string }>>`
      SELECT DISTINCT
        CAST(DATE(le."playedAt" AT TIME ZONE ${tz}) AS TEXT) AS day_local
      FROM "ListeningEvent" le
      WHERE le."userId" = ${userId}
      ORDER BY day_local ASC
    `,
  ]);

  const orderedDays = streakRows.map((row) => row.day_local).filter(Boolean);
  const streaks = calculateDayStreaks(orderedDays);

  return {
    sessionCount: sessionRow[0]?.session_count ?? 0,
    peakHourLocal: peakHourRow[0]?.hour_local ?? null,
    longestStreakDays: streaks.longest,
    activeStreakDays: streaks.active,
  };
}

export async function getDiscoveryStats(userId: string): Promise<DiscoveryStats> {
  const [rollingRow, newTrackRow, newArtistRow] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        total_plays_30d: number;
        unique_tracks_30d: number;
        unique_artists_30d: number;
      }>
    >`
      SELECT
        COUNT(le."id")::INTEGER AS total_plays_30d,
        COUNT(DISTINCT le."trackId")::INTEGER AS unique_tracks_30d,
        COUNT(DISTINCT t."artistName")::INTEGER AS unique_artists_30d
      FROM "ListeningEvent" le
      JOIN "Track" t ON t."id" = le."trackId"
      WHERE le."userId" = ${userId}
        AND le."playedAt" >= NOW() - INTERVAL '30 days'
    `,
    prisma.$queryRaw<Array<{ new_tracks_30d: number }>>`
      SELECT COUNT(*)::INTEGER AS new_tracks_30d
      FROM (
        SELECT
          le."trackId",
          MIN(le."playedAt") AS first_played_at
        FROM "ListeningEvent" le
        WHERE le."userId" = ${userId}
        GROUP BY le."trackId"
      ) first_plays
      WHERE first_plays.first_played_at >= NOW() - INTERVAL '30 days'
    `,
    prisma.$queryRaw<Array<{ new_artists_30d: number }>>`
      SELECT COUNT(*)::INTEGER AS new_artists_30d
      FROM (
        SELECT
          t."artistName",
          MIN(le."playedAt") AS first_played_at
        FROM "ListeningEvent" le
        JOIN "Track" t ON t."id" = le."trackId"
        WHERE le."userId" = ${userId}
        GROUP BY t."artistName"
      ) first_artist_plays
      WHERE first_artist_plays.first_played_at >= NOW() - INTERVAL '30 days'
    `,
  ]);

  const totalPlays30d = rollingRow[0]?.total_plays_30d ?? 0;
  const uniqueTracks30d = rollingRow[0]?.unique_tracks_30d ?? 0;
  const repeatPlays30d = Math.max(0, totalPlays30d - uniqueTracks30d);

  return {
    totalPlays30d,
    uniqueTracks30d,
    uniqueArtists30d: rollingRow[0]?.unique_artists_30d ?? 0,
    newTracks30d: newTrackRow[0]?.new_tracks_30d ?? 0,
    newArtists30d: newArtistRow[0]?.new_artists_30d ?? 0,
    repeatPlays30d,
  };
}

function toDistributionPoints(rows: Array<{ label: string; plays: number }>): DistributionPoint[] {
  const total = rows.reduce((sum, item) => sum + item.plays, 0);
  if (total === 0) {
    return [];
  }

  return rows.map((row) => ({
    label: row.label,
    plays: row.plays,
    share: row.plays / total,
  }));
}

export async function getConsumptionProfileStats(
  userId: string
): Promise<ConsumptionProfileStats> {
  const [summaryRow, albumTypeRows, decadeRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        average_track_duration_ms: number | null;
        explicit_plays: number;
        total_plays: number;
      }>
    >`
      SELECT
        AVG(CAST(t."durationMs" AS DOUBLE PRECISION)) AS average_track_duration_ms,
        COUNT(*) FILTER (WHERE t."explicit" = TRUE)::INTEGER AS explicit_plays,
        COUNT(*)::INTEGER AS total_plays
      FROM "ListeningEvent" le
      JOIN "Track" t ON t."id" = le."trackId"
      WHERE le."userId" = ${userId}
    `,
    prisma.$queryRaw<Array<{ label: string; plays: number }>>`
      SELECT
        COALESCE(NULLIF(t."albumType", ''), 'unknown') AS label,
        COUNT(*)::INTEGER AS plays
      FROM "ListeningEvent" le
      JOIN "Track" t ON t."id" = le."trackId"
      WHERE le."userId" = ${userId}
      GROUP BY label
      ORDER BY plays DESC
      LIMIT 5
    `,
    prisma.$queryRaw<Array<{ label: string; plays: number }>>`
      SELECT
        CASE
          WHEN t."albumReleaseDate" ~ '^[0-9]{4}' THEN CONCAT(((SUBSTRING(t."albumReleaseDate", 1, 4)::INT / 10) * 10)::TEXT, 's')
          ELSE 'unknown'
        END AS label,
        COUNT(*)::INTEGER AS plays
      FROM "ListeningEvent" le
      JOIN "Track" t ON t."id" = le."trackId"
      WHERE le."userId" = ${userId}
      GROUP BY label
      ORDER BY plays DESC
      LIMIT 6
    `,
  ]);

  const totalPlays = summaryRow[0]?.total_plays ?? 0;
  const explicitPlays = summaryRow[0]?.explicit_plays ?? 0;

  return {
    averageTrackDurationMs: Math.round(summaryRow[0]?.average_track_duration_ms ?? 0),
    explicitPlayShare: totalPlays > 0 ? explicitPlays / totalPlays : 0,
    explicitPlays,
    totalPlays,
    albumTypeDistribution: toDistributionPoints(albumTypeRows),
    releaseDecadeDistribution: toDistributionPoints(decadeRows),
  };
}

export async function getContextDistributionStats(userId: string): Promise<ContextDistributionStats> {
  const rows = await prisma.$queryRaw<Array<{ label: string; plays: number }>>`
    SELECT
      COALESCE(NULLIF(le."contextType", ''), 'unknown') AS label,
      COUNT(*)::INTEGER AS plays
    FROM "ListeningEvent" le
    WHERE le."userId" = ${userId}
    GROUP BY label
    ORDER BY plays DESC
  `;

  const totalPlays = rows.reduce((sum, row) => sum + row.plays, 0);

  return {
    totalPlays,
    distribution: toDistributionPoints(rows),
  };
}

export async function getListenedTrackIdsByUser(userId: string): Promise<Set<string>> {
  const rows = await prisma.listeningEvent.findMany({
    where: { userId },
    select: { trackId: true },
    distinct: ["trackId"],
  });

  return new Set(rows.map((row) => row.trackId));
}
