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
  syncedAt: Date;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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
  const response = await fetch(
    "https://api.spotify.com/v1/me/player/recently-played?limit=50",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const text = await response.text();
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
  if (trackIds.length === 0) {
    return map;
  }

  for (const batch of chunkArray(trackIds, 100)) {
    const response = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${batch.join(",")}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
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
    const response = await fetch(
      `https://api.spotify.com/v1/artists?ids=${batch.join(",")}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
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
    artists: Array<{ artistId: string; position: number }>;
  }>
): Promise<void> {
  const trackOperations = tracks.map((track) => {
    const updateData: Prisma.TrackUpdateInput = {
      name: track.name,
      artistName: track.artistName,
      albumName: track.albumName ?? undefined,
      durationMs: track.durationMs ?? undefined,
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
        danceability: features.danceability,
        energy: features.energy,
        valence: features.valence,
        tempo: features.tempo,
        acousticness: features.acousticness,
        instrumentalness: features.instrumentalness,
        liveness: features.liveness,
        speechiness: features.speechiness,
      },
      create: {
        trackId,
        danceability: features.danceability,
        energy: features.energy,
        valence: features.valence,
        tempo: features.tempo,
        acousticness: features.acousticness,
        instrumentalness: features.instrumentalness,
        liveness: features.liveness,
        speechiness: features.speechiness,
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
  events: Array<{ trackId: string; playedAt: Date; durationMs: number | null }>
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
      },
      create: {
        userId,
        trackId: event.trackId,
        playedAt: event.playedAt,
        durationMs: event.durationMs,
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

  const [audioFeaturesByTrackId, artistImageById] = await Promise.all([
    fetchAudioFeaturesByTrackId(
      payload.tracks.map((track) => track.id),
      accessToken
    ),
    fetchArtistImagesByArtistId(
      payload.artists.map((artist) => artist.id),
      accessToken
    ),
  ]);

  await persistArtistCatalog(artistImageById, payload.artists);
  await persistTrackCatalog(payload.tracks);
  await persistAudioFeatures(audioFeaturesByTrackId);
  await persistListeningEvents(userId, payload.events);

  const syncedAt = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { lastSyncedAt: syncedAt },
  });

  return {
    created: payload.events.length,
    syncedAt,
  };
}
