export interface SpotifyImage {
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface SpotifyTrackArtist {
  id: string;
  name: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms?: number | null;
  explicit?: boolean | null;
  album?: {
    name?: string | null;
    album_type?: string | null;
    release_date?: string | null;
    release_date_precision?: string | null;
    images?: SpotifyImage[];
  };
  artists?: SpotifyTrackArtist[];
}

export interface SpotifyRecentlyPlayedItem {
  played_at: string;
  context?: {
    type?: string | null;
    uri?: string | null;
  } | null;
  track?: SpotifyTrack | null;
}

export interface SyncArtistDraft {
  id: string;
  name: string;
}

export interface SyncTrackArtistDraft {
  artistId: string;
  position: number;
}

export interface SyncTrackDraft {
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
  artists: SyncTrackArtistDraft[];
}

export interface SyncListeningEventDraft {
  trackId: string;
  playedAt: Date;
  durationMs: number | null;
  contextType: string | null;
  contextUri: string | null;
}

export interface SyncPayload {
  tracks: SyncTrackDraft[];
  artists: SyncArtistDraft[];
  events: SyncListeningEventDraft[];
}

function getAlbumImageUrl(track: SpotifyTrack): string | null {
  if (!Array.isArray(track.album?.images) || track.album?.images.length === 0) {
    return null;
  }

  return track.album?.images[0]?.url ?? null;
}

function mergeTrackDraft(existing: SyncTrackDraft, incoming: SyncTrackDraft): SyncTrackDraft {
  return {
    ...existing,
    name: incoming.name || existing.name,
    artistName: incoming.artistName || existing.artistName,
    albumName: incoming.albumName ?? existing.albumName,
    albumImageUrl: incoming.albumImageUrl ?? existing.albumImageUrl,
    durationMs: incoming.durationMs ?? existing.durationMs,
    explicit: incoming.explicit ?? existing.explicit,
    albumType: incoming.albumType ?? existing.albumType,
    albumReleaseDate: incoming.albumReleaseDate ?? existing.albumReleaseDate,
    albumReleaseDatePrecision:
      incoming.albumReleaseDatePrecision ?? existing.albumReleaseDatePrecision,
    artists: existing.artists.length > 0 ? existing.artists : incoming.artists,
  };
}

export function derivePlayedDurationMs(
  playedAt: Date,
  nextPlayedAt: Date | null,
  trackDurationMs: number | null
): number | null {
  if (!trackDurationMs || !nextPlayedAt) {
    return trackDurationMs;
  }

  const deltaMs = playedAt.getTime() - nextPlayedAt.getTime();
  if (deltaMs > 0 && deltaMs < trackDurationMs) {
    return deltaMs;
  }

  return trackDurationMs;
}

export function buildRecentlyPlayedSyncPayload(items: SpotifyRecentlyPlayedItem[]): SyncPayload {
  const trackMap = new Map<string, SyncTrackDraft>();
  const artistMap = new Map<string, SyncArtistDraft>();
  const events: SyncListeningEventDraft[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const track = item?.track;
    if (!track?.id) {
      continue;
    }

    const playedAt = new Date(item.played_at);
    if (Number.isNaN(playedAt.getTime())) {
      continue;
    }

    const nextPlayedAtRaw = items[index + 1]?.played_at;
    const nextPlayedAt = nextPlayedAtRaw ? new Date(nextPlayedAtRaw) : null;
    const sanitizedNextPlayedAt =
      nextPlayedAt && !Number.isNaN(nextPlayedAt.getTime()) ? nextPlayedAt : null;

    const trackDurationMs = track.duration_ms ?? null;
    const durationMs = derivePlayedDurationMs(playedAt, sanitizedNextPlayedAt, trackDurationMs);

    const validArtists = (track.artists ?? []).filter(
      (artist): artist is SpotifyTrackArtist => Boolean(artist?.id && artist?.name)
    );

    const artists = validArtists.map((artist, artistIndex) => {
      if (!artistMap.has(artist.id)) {
        artistMap.set(artist.id, {
          id: artist.id,
          name: artist.name,
        });
      }

      return {
        artistId: artist.id,
        position: artistIndex,
      };
    });

    const draft: SyncTrackDraft = {
      id: track.id,
      name: track.name,
      artistName: validArtists.map((artist) => artist.name).join(", "),
      albumName: track.album?.name ?? null,
      albumImageUrl: getAlbumImageUrl(track),
      durationMs: trackDurationMs,
      explicit: typeof track.explicit === "boolean" ? track.explicit : null,
      albumType: track.album?.album_type ?? null,
      albumReleaseDate: track.album?.release_date ?? null,
      albumReleaseDatePrecision: track.album?.release_date_precision ?? null,
      artists,
    };

    const existingTrack = trackMap.get(track.id);
    trackMap.set(track.id, existingTrack ? mergeTrackDraft(existingTrack, draft) : draft);

    events.push({
      trackId: track.id,
      playedAt,
      durationMs,
      contextType: item.context?.type ?? null,
      contextUri: item.context?.uri ?? null,
    });
  }

  return {
    tracks: Array.from(trackMap.values()),
    artists: Array.from(artistMap.values()),
    events,
  };
}
