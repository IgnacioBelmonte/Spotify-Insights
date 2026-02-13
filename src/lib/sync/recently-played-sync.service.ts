import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db/prisma";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
import { fetchSpotifyMe } from "@/src/lib/spotify/client";
import { isSpotifyPremiumProduct } from "@/src/lib/spotify/profile";
import {
  buildRecentlyPlayedSyncPayload,
  type SpotifyRecentlyPlayedItem,
} from "@/src/lib/sync/recently-played.mapper";

interface SpotifyAudioFeature {
  id: string;
  danceability?: number | null;
  energy?: number | null;
  valence?: number | null;
  tempo?: number | null;
  acousticness?: number | null;
  instrumentalness?: number | null;
  liveness?: number | null;
  speechiness?: number | null;
}

interface SpotifyArtistProfile {
  id: string;
  images?: Array<{ url: string }>;
}

export interface RecentlyPlayedSyncResult {
  created: number;
  tracks: number;
  artists: number;
  audioFeatures: number;
  audioFeaturesRequested: number;
  audioFeaturesStatus: "ok" | "denied" | "error";
  audioFeaturesMessage: string | null;
  events: number;
  syncedAt: Date;
}

const MAX_SPOTIFY_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 450;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isRetryableSpotifyStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchSpotifyWithRetry(
  url: string,
  accessToken: string
): Promise<Response> {
  let lastNetworkError: unknown;

  for (let attempt = 1; attempt <= MAX_SPOTIFY_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok || !isRetryableSpotifyStatus(response.status) || attempt === MAX_SPOTIFY_RETRIES) {
        return response;
      }

      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
      const retryDelayMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : RETRY_BASE_DELAY_MS * attempt;
      await wait(retryDelayMs);
    } catch (error) {
      lastNetworkError = error;
      if (attempt === MAX_SPOTIFY_RETRIES) {
        break;
      }
      await wait(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  if (lastNetworkError instanceof Error) {
    throw lastNetworkError;
  }

  throw new Error("Spotify request failed after retries");
}

async function executeOperationsInChunks(
  operations: Prisma.PrismaPromise<unknown>[],
  chunkSize: number = 50
): Promise<void> {
  for (const batch of chunkArray(operations, chunkSize)) {
    await prisma.$transaction(batch);
  }
}

async function fetchRecentlyPlayedItems(
  accessToken: string
): Promise<SpotifyRecentlyPlayedItem[]> {
  const response = await fetchSpotifyWithRetry(
    "https://api.spotify.com/v1/me/player/recently-played?limit=50",
    accessToken
  );

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Spotify recently played permissions are missing. Please log out and log in again."
      );
    }
    throw new Error(text || `Spotify recently played request failed (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data?.items)) {
    return [];
  }

  return data.items as SpotifyRecentlyPlayedItem[];
}

async function fetchAudioFeaturesByTrackId(
  trackIds: string[],
  accessToken: string
): Promise<Map<string, SpotifyAudioFeature>> {
  const map = new Map<string, SpotifyAudioFeature>();
  const uniqueTrackIds = Array.from(new Set(trackIds));
  if (uniqueTrackIds.length === 0) {
    return map;
  }

  for (const batch of chunkArray(uniqueTrackIds, 100)) {
    const response = await fetchSpotifyWithRetry(
      `https://api.spotify.com/v1/audio-features?ids=${batch.join(",")}`,
      accessToken
    );

    if (response.status === 403) {
      throw new Error(
        "Spotify denied access to the audio-features endpoint for this app."
      );
    }

    if (response.status === 401) {
      throw new Error(
        "Spotify token is not authorized to read audio features."
      );
    }

    if (!response.ok) {
      // Fallback to single-track endpoint so a partial outage does not empty all features.
      for (const trackId of batch) {
        try {
          const singleResponse = await fetchSpotifyWithRetry(
            `https://api.spotify.com/v1/audio-features/${trackId}`,
            accessToken
          );

          if (singleResponse.status === 403) {
            throw new Error(
              "Spotify denied access to the audio-features endpoint for this app."
            );
          }

          if (!singleResponse.ok) {
            continue;
          }

          const feature = (await singleResponse.json()) as SpotifyAudioFeature | null;
          if (feature?.id) {
            map.set(feature.id, feature);
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("audio-features endpoint")) {
            throw error;
          }
        }
      }

      continue;
    }

    const data = await response.json();
    const features = Array.isArray(data?.audio_features)
      ? (data.audio_features as SpotifyAudioFeature[])
      : [];

    for (const feature of features) {
      if (!feature?.id) {
        continue;
      }
      map.set(feature.id, feature);
    }
  }

  return map;
}

function selectArtistImageUrl(artist: SpotifyArtistProfile): string | null {
  if (!Array.isArray(artist.images) || artist.images.length === 0) {
    return null;
  }

  return artist.images[0]?.url ?? null;
}

async function fetchArtistImagesByArtistId(
  artistIds: string[],
  accessToken: string
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (artistIds.length === 0) {
    return map;
  }

  for (const batch of chunkArray(artistIds, 50)) {
    const response = await fetchSpotifyWithRetry(
      `https://api.spotify.com/v1/artists?ids=${batch.join(",")}`,
      accessToken
    );

    if (!response.ok) {
      continue;
    }

    const data = await response.json();
    const artists = Array.isArray(data?.artists)
      ? (data.artists as SpotifyArtistProfile[])
      : [];

    for (const artist of artists) {
      if (!artist?.id) {
        continue;
      }
      map.set(artist.id, selectArtistImageUrl(artist));
    }
  }

  return map;
}

async function persistArtistCatalog(
  artistImageById: Map<string, string | null>,
  artists: Array<{ id: string; name: string }>
): Promise<void> {
  const operations = artists.map((artist) => {
    const imageUrl = artistImageById.get(artist.id) ?? null;
    const updateData: Prisma.ArtistUpdateInput = {
      name: artist.name,
      ...(imageUrl ? { imageUrl } : {}),
    };

    return prisma.artist.upsert({
      where: { id: artist.id },
      update: updateData,
      create: {
        id: artist.id,
        name: artist.name,
        imageUrl,
      },
    });
  });

  await executeOperationsInChunks(operations);
}

async function persistTrackCatalog(
  tracks: Array<{
    id: string;
    name: string;
    artistName: string;
    albumName: string | null;
    albumImageUrl: string | null;
    durationMs: number | null;
    explicit: boolean | null;
    albumType: string | null;
    albumReleaseDate: string | null;
    albumReleaseDatePrecision: string | null;
    artists: Array<{ artistId: string; position: number }>;
  }>
): Promise<void> {
  const trackOperations = tracks.map((track) => {
    const updateData: Prisma.TrackUpdateInput = {
      name: track.name,
      artistName: track.artistName,
      albumName: track.albumName ?? undefined,
      durationMs: track.durationMs ?? undefined,
      explicit: track.explicit,
      albumType: track.albumType ?? undefined,
      albumReleaseDate: track.albumReleaseDate ?? undefined,
      albumReleaseDatePrecision: track.albumReleaseDatePrecision ?? undefined,
      ...(track.albumImageUrl ? { albumImageUrl: track.albumImageUrl } : {}),
    };

    return prisma.track.upsert({
      where: { id: track.id },
      update: updateData,
      create: {
        id: track.id,
        name: track.name,
        artistName: track.artistName,
        albumName: track.albumName,
        albumImageUrl: track.albumImageUrl,
        durationMs: track.durationMs,
        explicit: track.explicit,
        albumType: track.albumType,
        albumReleaseDate: track.albumReleaseDate,
        albumReleaseDatePrecision: track.albumReleaseDatePrecision,
      },
    });
  });

  await executeOperationsInChunks(trackOperations);

  const relationOperations: Prisma.PrismaPromise<unknown>[] = [];
  for (const track of tracks) {
    relationOperations.push(
      prisma.trackArtist.deleteMany({
        where: { trackId: track.id },
      })
    );

    if (track.artists.length > 0) {
      relationOperations.push(
        prisma.trackArtist.createMany({
          data: track.artists.map((artist) => ({
            trackId: track.id,
            artistId: artist.artistId,
            position: artist.position,
          })),
          skipDuplicates: true,
        })
      );
    }
  }

  await executeOperationsInChunks(relationOperations);
}

async function persistAudioFeatures(
  audioFeaturesByTrackId: Map<string, SpotifyAudioFeature>
): Promise<void> {
  const operations = Array.from(audioFeaturesByTrackId.entries()).map(([trackId, features]) =>
    prisma.audioFeatures.upsert({
      where: { trackId },
      update: {
        danceability: features.danceability ?? null,
        energy: features.energy ?? null,
        valence: features.valence ?? null,
        tempo: features.tempo ?? null,
        acousticness: features.acousticness ?? null,
        instrumentalness: features.instrumentalness ?? null,
        liveness: features.liveness ?? null,
        speechiness: features.speechiness ?? null,
      },
      create: {
        trackId,
        danceability: features.danceability ?? null,
        energy: features.energy ?? null,
        valence: features.valence ?? null,
        tempo: features.tempo ?? null,
        acousticness: features.acousticness ?? null,
        instrumentalness: features.instrumentalness ?? null,
        liveness: features.liveness ?? null,
        speechiness: features.speechiness ?? null,
      },
    })
  );

  await executeOperationsInChunks(operations);
}

async function syncUserPremiumState(userId: string, accessToken: string): Promise<void> {
  try {
    const profile = await fetchSpotifyMe(accessToken);
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: isSpotifyPremiumProduct(profile.product),
      },
    });
  } catch (error) {
    console.warn("[sync] Failed to refresh user premium state", { userId, error });
  }
}

async function persistListeningEvents(
  userId: string,
  events: Array<{
    trackId: string;
    playedAt: Date;
    durationMs: number | null;
    contextType: string | null;
    contextUri: string | null;
  }>
): Promise<void> {
  const operations = events.map((event) =>
    prisma.listeningEvent.upsert({
      where: {
        userId_playedAt: {
          userId,
          playedAt: event.playedAt,
        },
      },
      update: {
        trackId: event.trackId,
        durationMs: event.durationMs,
        contextType: event.contextType,
        contextUri: event.contextUri,
      },
      create: {
        userId,
        trackId: event.trackId,
        playedAt: event.playedAt,
        durationMs: event.durationMs,
        contextType: event.contextType,
        contextUri: event.contextUri,
      },
    })
  );

  await executeOperationsInChunks(operations);
}

export async function syncRecentlyPlayedForUser(
  userId: string
): Promise<RecentlyPlayedSyncResult> {
  const accessToken = await getValidAccessToken(userId);
  await syncUserPremiumState(userId, accessToken);
  const items = await fetchRecentlyPlayedItems(accessToken);
  const payload = buildRecentlyPlayedSyncPayload(items);

  const requestedAudioFeatureCount = payload.tracks.length;
  let audioFeaturesByTrackId = new Map<string, SpotifyAudioFeature>();
  let audioFeaturesStatus: "ok" | "denied" | "error" = "ok";
  let audioFeaturesMessage: string | null = null;

  const [audioFeaturesResult, artistImageById] = await Promise.all([
    fetchAudioFeaturesByTrackId(
      payload.tracks.map((track) => track.id),
      accessToken
    ).catch((error: unknown) => {
      if (error instanceof Error) {
        const message = error.message.trim();
        if (message.includes("audio-features endpoint")) {
          return {
            status: "denied" as const,
            message,
            map: new Map<string, SpotifyAudioFeature>(),
          };
        }

        return {
          status: "error" as const,
          message,
          map: new Map<string, SpotifyAudioFeature>(),
        };
      }

      return {
        status: "error" as const,
        message: "Unexpected audio-features error.",
        map: new Map<string, SpotifyAudioFeature>(),
      };
    }),
    fetchArtistImagesByArtistId(
      payload.artists.map((artist) => artist.id),
      accessToken
    ),
  ]);

  if (audioFeaturesResult instanceof Map) {
    audioFeaturesByTrackId = audioFeaturesResult;
  } else {
    audioFeaturesByTrackId = audioFeaturesResult.map;
    audioFeaturesStatus = audioFeaturesResult.status;
    audioFeaturesMessage = audioFeaturesResult.message;
  }

  await persistArtistCatalog(artistImageById, payload.artists);
  await persistTrackCatalog(payload.tracks);
  if (audioFeaturesByTrackId.size > 0) {
    await persistAudioFeatures(audioFeaturesByTrackId);
  }
  await persistListeningEvents(userId, payload.events);

  const syncedAt = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { lastSyncedAt: syncedAt },
  });

  return {
    created: payload.events.length,
    tracks: payload.tracks.length,
    artists: payload.artists.length,
    audioFeatures: audioFeaturesByTrackId.size,
    audioFeaturesRequested: requestedAudioFeatureCount,
    audioFeaturesStatus,
    audioFeaturesMessage,
    events: payload.events.length,
    syncedAt,
  };
}
