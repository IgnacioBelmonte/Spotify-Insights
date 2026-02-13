import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
import { getContextDistributionStats, getListenedTrackIdsByUser } from "@/src/lib/insights/insights.repository";
import { t } from "@/src/lib/i18n";

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 450;
const SAVED_TRACKS_FETCH_LIMIT = 1000;
const PLAYLIST_FETCH_LIMIT = 200;
const PLAYLIST_ITEMS_PER_PLAYLIST_LIMIT = 300;
const FOLLOWED_ARTISTS_LIMIT = 24;

export type InsightSectionStatus = "ok" | "limited" | "error";

export interface InsightSection<T> {
  status: InsightSectionStatus;
  data: T | null;
  message: string | null;
}

export interface TopRankItem {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string | null;
  rank: number;
  deltaVsMedium: number | null;
  deltaVsLong: number | null;
}

export interface TopWindowsInsights {
  tracks: {
    shortTerm: TopRankItem[];
    mediumTerm: TopRankItem[];
    longTerm: TopRankItem[];
  };
  artists: {
    shortTerm: TopRankItem[];
    mediumTerm: TopRankItem[];
    longTerm: TopRankItem[];
  };
  biggestTrackMovers: TopRankItem[];
  biggestArtistMovers: TopRankItem[];
}

export interface LibraryInsights {
  totalSavedTracks: number;
  savedInLast30Days: number;
  unplayedSavedTracks: number;
  listenedShare: number;
  monthlyAdds: Array<{
    monthKey: string;
    count: number;
  }>;
  recentSaves: Array<{
    trackId: string;
    name: string;
    artistName: string;
    imageUrl: string | null;
    addedAt: string;
  }>;
}

export interface PlaylistIntelligenceItem {
  id: string;
  name: string;
  imageUrl: string | null;
  tracksTotal: number;
  isPublic: boolean | null;
  isCollaborative: boolean;
  isOwnedByCurrentUser: boolean;
  recentAdds30d: number;
  contributorCount: number;
  lastAddedAt: string | null;
}

export interface PlaylistIntelligenceInsights {
  totalPlaylists: number;
  ownedPlaylists: number;
  collaborativePlaylists: number;
  publicPlaylists: number;
  topPlaylists: PlaylistIntelligenceItem[];
}

export interface ReleaseRadarItem {
  id: string;
  name: string;
  artistName: string;
  imageUrl: string | null;
  releaseDate: string;
  releaseDatePrecision: string;
  albumType: string;
  primaryTrack: {
    id: string;
    name: string;
    artistName: string;
    albumImageUrl: string | null;
  } | null;
}

export interface FollowedArtistsReleaseInsights {
  followedArtistsCount: number;
  latestReleases: ReleaseRadarItem[];
}

export interface PlaybackHealthInsights {
  hasActivePlayback: boolean;
  isPlaying: boolean;
  activeDeviceName: string | null;
  availableDevices: number;
  restrictedDevices: number;
  queueLength: number;
  canSkipNext: boolean;
  canSkipPrevious: boolean;
  canSeek: boolean;
  canToggleShuffle: boolean;
  canToggleRepeat: boolean;
}

export interface ContextMixInsights {
  totalPlays: number;
  distribution: Array<{
    label: string;
    plays: number;
    share: number;
  }>;
}

export interface SpotifyLiveInsights {
  generatedAt: string;
  reconnectRequired: boolean;
  topWindows: InsightSection<TopWindowsInsights>;
  library: InsightSection<LibraryInsights>;
  playlists: InsightSection<PlaylistIntelligenceInsights>;
  releases: InsightSection<FollowedArtistsReleaseInsights>;
  playbackHealth: InsightSection<PlaybackHealthInsights>;
  contextMix: InsightSection<ContextMixInsights>;
}

class SpotifyLiveInsightsError extends Error {
  status: number;
  endpoint: string;
  body: string;

  constructor(status: number, endpoint: string, body: string, message: string) {
    super(message);
    this.name = "SpotifyLiveInsightsError";
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isPermissionError(status: number): boolean {
  return status === 401 || status === 403;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${SPOTIFY_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchSpotifyJson<T>(accessToken: string, path: string): Promise<T> {
  const url = buildUrl(path);
  let lastNetworkError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        if (response.status === 204) {
          return {} as T;
        }

        return (await response.json()) as T;
      }

      if (!isRetryableStatus(response.status) || attempt === MAX_RETRIES) {
        const body = await response.text();
        throw new SpotifyLiveInsightsError(
          response.status,
          path,
          body,
          `Spotify request failed (${response.status}) for ${path}`
        );
      }

      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
      const retryDelayMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : RETRY_BASE_DELAY_MS * attempt;
      await sleep(retryDelayMs);
    } catch (error) {
      if (error instanceof SpotifyLiveInsightsError) {
        throw error;
      }

      lastNetworkError = error;
      if (attempt === MAX_RETRIES) {
        break;
      }

      await sleep(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  if (lastNetworkError instanceof Error) {
    throw lastNetworkError;
  }

  throw new Error(`Spotify request failed for ${path}`);
}

function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toPercentShare(value: number, total: number): number {
  if (total <= 0) return 0;
  return value / total;
}

function parseReleaseDate(releaseDate: string, precision: string): Date {
  if (precision === "day") {
    return new Date(`${releaseDate}T00:00:00Z`);
  }

  if (precision === "month") {
    return new Date(`${releaseDate}-01T00:00:00Z`);
  }

  if (precision === "year") {
    return new Date(`${releaseDate}-01-01T00:00:00Z`);
  }

  return new Date("1970-01-01T00:00:00Z");
}

type TopTimeRange = "short_term" | "medium_term" | "long_term";

interface SpotifyImage {
  url?: string;
}

interface SpotifyTopTrack {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: {
    images?: SpotifyImage[];
  };
}

interface SpotifyTopArtist {
  id?: string;
  name?: string;
  images?: SpotifyImage[];
}

interface SpotifyTopResponse<TItem> {
  items?: TItem[];
}

interface SpotifySavedTrackItem {
  added_at?: string;
  track?: {
    id?: string;
    name?: string;
    artists?: Array<{ name?: string }>;
    album?: {
      images?: SpotifyImage[];
    };
  } | null;
}

interface SpotifySavedTracksResponse {
  items?: SpotifySavedTrackItem[];
  total?: number;
  next?: string | null;
}

interface SpotifyPlaylistItem {
  id?: string;
  name?: string;
  public?: boolean | null;
  collaborative?: boolean;
  owner?: { id?: string };
  images?: SpotifyImage[];
  tracks?: { total?: number };
}

interface SpotifyPlaylistsResponse {
  items?: SpotifyPlaylistItem[];
  next?: string | null;
}

interface SpotifyPlaylistTrackItem {
  added_at?: string;
  added_by?: {
    id?: string;
  };
}

interface SpotifyPlaylistTracksResponse {
  items?: SpotifyPlaylistTrackItem[];
  next?: string | null;
}

interface SpotifyFollowingArtist {
  id?: string;
  name?: string;
}

interface SpotifyFollowingArtistsResponse {
  artists?: {
    items?: SpotifyFollowingArtist[];
    next?: string | null;
    cursors?: {
      after?: string | null;
    };
  };
}

interface SpotifyArtistAlbum {
  id?: string;
  name?: string;
  release_date?: string;
  release_date_precision?: string;
  album_type?: string;
  images?: SpotifyImage[];
}

interface SpotifyArtistAlbumsResponse {
  items?: SpotifyArtistAlbum[];
}

interface SpotifyAlbumTrackItem {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
}

interface SpotifyAlbumTracksResponse {
  items?: SpotifyAlbumTrackItem[];
}

interface SpotifyCurrentPlaybackResponse {
  is_playing?: boolean;
  device?: {
    name?: string;
  };
  actions?: {
    disallows?: Record<string, boolean>;
  };
}

interface SpotifyDevicesResponse {
  devices?: Array<{
    is_restricted?: boolean;
  }>;
}

interface SpotifyQueueResponse {
  queue?: unknown[];
}

interface SpotifyUserProfileResponse {
  id?: string;
}

function buildTopRankItems(
  shortItems: TopRankItem[],
  mediumItems: TopRankItem[],
  longItems: TopRankItem[]
): TopRankItem[] {
  const mediumRankById = new Map<string, number>(mediumItems.map((item) => [item.id, item.rank]));
  const longRankById = new Map<string, number>(longItems.map((item) => [item.id, item.rank]));

  return shortItems.map((item) => ({
    ...item,
    deltaVsMedium:
      typeof mediumRankById.get(item.id) === "number"
        ? mediumRankById.get(item.id)! - item.rank
        : null,
    deltaVsLong:
      typeof longRankById.get(item.id) === "number"
        ? longRankById.get(item.id)! - item.rank
        : null,
  }));
}

function getBiggestMovers(items: TopRankItem[]): TopRankItem[] {
  return [...items]
    .sort((a, b) => {
      const aDelta = a.deltaVsMedium ?? Number.NEGATIVE_INFINITY;
      const bDelta = b.deltaVsMedium ?? Number.NEGATIVE_INFINITY;
      return bDelta - aDelta;
    })
    .filter((item) => typeof item.deltaVsMedium === "number")
    .slice(0, 3);
}

function mapTopTracks(items: SpotifyTopTrack[]): TopRankItem[] {
  return items
    .filter((item): item is SpotifyTopTrack & { id: string; name: string } => Boolean(item.id && item.name))
    .map((item, index) => ({
      id: item.id,
      name: item.name,
      subtitle: (item.artists ?? [])
        .map((artist) => artist.name)
        .filter((name): name is string => typeof name === "string" && name.length > 0)
        .join(", "),
      imageUrl: item.album?.images?.[0]?.url ?? null,
      rank: index + 1,
      deltaVsMedium: null,
      deltaVsLong: null,
    }));
}

function mapTopArtists(items: SpotifyTopArtist[]): TopRankItem[] {
  return items
    .filter((item): item is SpotifyTopArtist & { id: string; name: string } => Boolean(item.id && item.name))
    .map((item, index) => ({
      id: item.id,
      name: item.name,
      subtitle: "Artist",
      imageUrl: item.images?.[0]?.url ?? null,
      rank: index + 1,
      deltaVsMedium: null,
      deltaVsLong: null,
    }));
}

async function fetchTopWindowInsights(accessToken: string): Promise<TopWindowsInsights> {
  const ranges: TopTimeRange[] = ["short_term", "medium_term", "long_term"];

  const [trackResponses, artistResponses] = await Promise.all([
    Promise.all(
      ranges.map((range) =>
        fetchSpotifyJson<SpotifyTopResponse<SpotifyTopTrack>>(
          accessToken,
          `/me/top/tracks?time_range=${range}&limit=10`
        )
      )
    ),
    Promise.all(
      ranges.map((range) =>
        fetchSpotifyJson<SpotifyTopResponse<SpotifyTopArtist>>(
          accessToken,
          `/me/top/artists?time_range=${range}&limit=10`
        )
      )
    ),
  ]);

  const trackShort = mapTopTracks(trackResponses[0].items ?? []);
  const trackMedium = mapTopTracks(trackResponses[1].items ?? []);
  const trackLong = mapTopTracks(trackResponses[2].items ?? []);

  const artistShort = mapTopArtists(artistResponses[0].items ?? []);
  const artistMedium = mapTopArtists(artistResponses[1].items ?? []);
  const artistLong = mapTopArtists(artistResponses[2].items ?? []);

  const enrichedTrackShort = buildTopRankItems(trackShort, trackMedium, trackLong);
  const enrichedArtistShort = buildTopRankItems(artistShort, artistMedium, artistLong);

  return {
    tracks: {
      shortTerm: enrichedTrackShort,
      mediumTerm: trackMedium,
      longTerm: trackLong,
    },
    artists: {
      shortTerm: enrichedArtistShort,
      mediumTerm: artistMedium,
      longTerm: artistLong,
    },
    biggestTrackMovers: getBiggestMovers(enrichedTrackShort),
    biggestArtistMovers: getBiggestMovers(enrichedArtistShort),
  };
}

async function fetchSavedTracks(accessToken: string): Promise<SpotifySavedTrackItem[]> {
  const collected: SpotifySavedTrackItem[] = [];
  let offset = 0;
  let keepPaging = true;

  while (keepPaging && collected.length < SAVED_TRACKS_FETCH_LIMIT) {
    const path = `/me/tracks?limit=50&offset=${offset}`;
    const response = await fetchSpotifyJson<SpotifySavedTracksResponse>(accessToken, path);
    const items = response.items ?? [];

    if (items.length === 0) {
      break;
    }

    collected.push(...items);
    offset += items.length;

    if (!response.next || items.length < 50) {
      keepPaging = false;
    }
  }

  return collected.slice(0, SAVED_TRACKS_FETCH_LIMIT);
}

async function fetchLibraryInsights(accessToken: string, userId: string): Promise<LibraryInsights> {
  const [savedTracks, listenedTrackIds] = await Promise.all([
    fetchSavedTracks(accessToken),
    getListenedTrackIdsByUser(userId),
  ]);

  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(toMonthKey(date));
  }
  const monthCounts = new Map<string, number>(monthKeys.map((monthKey) => [monthKey, 0]));

  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
  let savedInLast30Days = 0;
  let unplayedSavedTracks = 0;

  const recentSaves: Array<{
    trackId: string;
    name: string;
    artistName: string;
    imageUrl: string | null;
    addedAt: string;
  }> = [];

  for (const item of savedTracks) {
    const trackId = item.track?.id;
    const addedAt = item.added_at;
    if (!trackId || !addedAt) {
      continue;
    }

    const addedAtDate = new Date(addedAt);
    if (Number.isNaN(addedAtDate.getTime())) {
      continue;
    }

    const monthKey = toMonthKey(addedAtDate);
    monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);

    if (addedAtDate.getTime() >= thirtyDaysAgo) {
      savedInLast30Days += 1;
    }

    if (!listenedTrackIds.has(trackId)) {
      unplayedSavedTracks += 1;
    }

    recentSaves.push({
      trackId,
      name: item.track?.name ?? "Unknown track",
      artistName: (item.track?.artists ?? [])
        .map((artist) => artist.name)
        .filter((name): name is string => typeof name === "string" && name.length > 0)
        .join(", "),
      imageUrl: item.track?.album?.images?.[0]?.url ?? null,
      addedAt,
    });
  }

  recentSaves.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  const totalSavedTracks = recentSaves.length;
  const listenedSavedTracks = Math.max(0, totalSavedTracks - unplayedSavedTracks);

  return {
    totalSavedTracks,
    savedInLast30Days,
    unplayedSavedTracks,
    listenedShare: toPercentShare(listenedSavedTracks, totalSavedTracks),
    monthlyAdds: monthKeys.map((monthKey) => ({
      monthKey,
      count: monthCounts.get(monthKey) ?? 0,
    })),
    recentSaves: recentSaves.slice(0, 6),
  };
}

async function fetchUserPlaylists(accessToken: string): Promise<SpotifyPlaylistItem[]> {
  const collected: SpotifyPlaylistItem[] = [];
  let offset = 0;
  let keepPaging = true;

  while (keepPaging && collected.length < PLAYLIST_FETCH_LIMIT) {
    const response = await fetchSpotifyJson<SpotifyPlaylistsResponse>(
      accessToken,
      `/me/playlists?limit=50&offset=${offset}`
    );

    const items = response.items ?? [];
    if (items.length === 0) {
      break;
    }

    collected.push(...items);
    offset += items.length;

    if (!response.next || items.length < 50) {
      keepPaging = false;
    }
  }

  return collected.slice(0, PLAYLIST_FETCH_LIMIT);
}

async function fetchPlaylistActivitySummary(
  accessToken: string,
  playlistId: string
): Promise<{
  recentAdds30d: number;
  contributorCount: number;
  lastAddedAt: string | null;
}> {
  const contributors = new Set<string>();
  let recentAdds30d = 0;
  let lastAddedAt: string | null = null;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86_400_000;

  let nextPath = `/playlists/${encodeURIComponent(
    playlistId
  )}/tracks?fields=items(added_at,added_by(id)),next&limit=100`;
  let processedItems = 0;

  while (nextPath && processedItems < PLAYLIST_ITEMS_PER_PLAYLIST_LIMIT) {
    const response = await fetchSpotifyJson<SpotifyPlaylistTracksResponse>(accessToken, nextPath);
    const items = response.items ?? [];

    for (const item of items) {
      const addedAt = item.added_at;
      if (addedAt) {
        const addedAtMs = new Date(addedAt).getTime();
        if (!Number.isNaN(addedAtMs)) {
          if (addedAtMs >= thirtyDaysAgo) {
            recentAdds30d += 1;
          }

          if (!lastAddedAt || addedAtMs > new Date(lastAddedAt).getTime()) {
            lastAddedAt = addedAt;
          }
        }
      }

      if (item.added_by?.id) {
        contributors.add(item.added_by.id);
      }
    }

    processedItems += items.length;
    if (!response.next || items.length === 0) {
      break;
    }

    nextPath = response.next;
  }

  return {
    recentAdds30d,
    contributorCount: contributors.size,
    lastAddedAt,
  };
}

async function fetchPlaylistIntelligence(accessToken: string): Promise<PlaylistIntelligenceInsights> {
  const [profile, playlists] = await Promise.all([
    fetchSpotifyJson<SpotifyUserProfileResponse>(accessToken, "/me"),
    fetchUserPlaylists(accessToken),
  ]);

  const currentUserId = profile.id ?? "";

  const normalizedPlaylists = playlists
    .filter((playlist): playlist is SpotifyPlaylistItem & { id: string; name: string } =>
      Boolean(playlist.id && playlist.name)
    )
    .map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      imageUrl: playlist.images?.[0]?.url ?? null,
      tracksTotal: playlist.tracks?.total ?? 0,
      isPublic: typeof playlist.public === "boolean" ? playlist.public : null,
      isCollaborative: Boolean(playlist.collaborative),
      isOwnedByCurrentUser: playlist.owner?.id === currentUserId,
    }));

  const topCandidates = [...normalizedPlaylists]
    .sort((a, b) => b.tracksTotal - a.tracksTotal)
    .slice(0, 6);

  const activityRows = await Promise.all(
    topCandidates.map((playlist) =>
      fetchPlaylistActivitySummary(accessToken, playlist.id).catch(() => ({
        recentAdds30d: 0,
        contributorCount: 0,
        lastAddedAt: null,
      }))
    )
  );

  const topPlaylists = topCandidates.map((playlist, index) => ({
    ...playlist,
    recentAdds30d: activityRows[index]?.recentAdds30d ?? 0,
    contributorCount: activityRows[index]?.contributorCount ?? 0,
    lastAddedAt: activityRows[index]?.lastAddedAt ?? null,
  }));

  return {
    totalPlaylists: normalizedPlaylists.length,
    ownedPlaylists: normalizedPlaylists.filter((playlist) => playlist.isOwnedByCurrentUser).length,
    collaborativePlaylists: normalizedPlaylists.filter((playlist) => playlist.isCollaborative).length,
    publicPlaylists: normalizedPlaylists.filter((playlist) => playlist.isPublic === true).length,
    topPlaylists,
  };
}

async function fetchFollowedArtists(accessToken: string): Promise<SpotifyFollowingArtist[]> {
  const collected: SpotifyFollowingArtist[] = [];
  let nextAfter: string | null = null;

  while (collected.length < FOLLOWED_ARTISTS_LIMIT) {
    const params = new URLSearchParams({
      type: "artist",
      limit: "50",
    });

    if (nextAfter) {
      params.set("after", nextAfter);
    }

    const response = await fetchSpotifyJson<SpotifyFollowingArtistsResponse>(
      accessToken,
      `/me/following?${params.toString()}`
    );

    const items = response.artists?.items ?? [];
    if (items.length === 0) {
      break;
    }

    collected.push(...items);
    nextAfter = response.artists?.cursors?.after ?? null;

    if (!nextAfter) {
      break;
    }
  }

  return collected.slice(0, FOLLOWED_ARTISTS_LIMIT);
}

async function fetchReleaseRadar(accessToken: string): Promise<FollowedArtistsReleaseInsights> {
  const followedArtists = await fetchFollowedArtists(accessToken);

  const releaseRows = await Promise.all(
    followedArtists
      .filter((artist): artist is SpotifyFollowingArtist & { id: string; name: string } =>
        Boolean(artist.id && artist.name)
      )
      .map(async (artist) => {
        const response = await fetchSpotifyJson<SpotifyArtistAlbumsResponse>(
          accessToken,
          `/artists/${encodeURIComponent(
            artist.id
          )}/albums?include_groups=album,single&market=from_token&limit=5`
        );

        return (response.items ?? [])
          .filter(
            (album): album is SpotifyArtistAlbum & {
              id: string;
              name: string;
              release_date: string;
              release_date_precision: string;
            } =>
              Boolean(
                album.id &&
                  album.name &&
                  album.release_date &&
                  album.release_date_precision &&
                  album.album_type
              )
          )
          .map((album) => ({
            id: album.id,
            name: album.name,
            artistName: artist.name,
            imageUrl: album.images?.[0]?.url ?? null,
            releaseDate: album.release_date,
            releaseDatePrecision: album.release_date_precision,
            albumType: album.album_type ?? "album",
            primaryTrack: null,
          }));
      })
  );

  const byReleaseId = new Map<string, ReleaseRadarItem>();
  for (const releaseList of releaseRows) {
    for (const release of releaseList) {
      if (!byReleaseId.has(release.id)) {
        byReleaseId.set(release.id, release);
      }
    }
  }

  const sortedReleases = Array.from(byReleaseId.values()).sort((a, b) => {
    const aDate = parseReleaseDate(a.releaseDate, a.releaseDatePrecision).getTime();
    const bDate = parseReleaseDate(b.releaseDate, b.releaseDatePrecision).getTime();
    return bDate - aDate;
  });

  const latestReleases = sortedReleases.slice(0, 12);

  const enrichedReleases = await Promise.all(
    latestReleases.map(async (release) => {
      if (release.albumType !== "single") {
        return release;
      }

      try {
        const response = await fetchSpotifyJson<SpotifyAlbumTracksResponse>(
          accessToken,
          `/albums/${encodeURIComponent(release.id)}/tracks?market=from_token&limit=1`
        );
        const firstTrack = response.items?.[0];
        if (!firstTrack?.id || !firstTrack.name) {
          return release;
        }

        const artistName = (firstTrack.artists ?? [])
          .map((artist) => artist.name)
          .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
          .join(", ");

        return {
          ...release,
          primaryTrack: {
            id: firstTrack.id,
            name: firstTrack.name,
            artistName: artistName || release.artistName,
            albumImageUrl: release.imageUrl,
          },
        };
      } catch {
        return release;
      }
    })
  );

  return {
    followedArtistsCount: followedArtists.length,
    latestReleases: enrichedReleases,
  };
}

async function fetchPlaybackHealth(accessToken: string): Promise<PlaybackHealthInsights> {
  const [playback, devices, queue] = await Promise.all([
    fetchSpotifyJson<SpotifyCurrentPlaybackResponse>(accessToken, "/me/player?additional_types=track").catch(
      (error: unknown) => {
        if (error instanceof SpotifyLiveInsightsError && error.status === 204) {
          return {} as SpotifyCurrentPlaybackResponse;
        }
        if (error instanceof SpotifyLiveInsightsError && error.status === 404) {
          return {} as SpotifyCurrentPlaybackResponse;
        }
        throw error;
      }
    ),
    fetchSpotifyJson<SpotifyDevicesResponse>(accessToken, "/me/player/devices").catch(
      () => ({ devices: [] })
    ),
    fetchSpotifyJson<SpotifyQueueResponse>(accessToken, "/me/player/queue").catch(() => ({ queue: [] })),
  ]);

  const disallows = playback.actions?.disallows ?? {};
  const devicesList = devices.devices ?? [];

  return {
    hasActivePlayback: Boolean(playback.device?.name),
    isPlaying: Boolean(playback.is_playing),
    activeDeviceName: playback.device?.name ?? null,
    availableDevices: devicesList.length,
    restrictedDevices: devicesList.filter((device) => Boolean(device.is_restricted)).length,
    queueLength: Array.isArray(queue.queue) ? queue.queue.length : 0,
    canSkipNext: !Boolean(disallows.skipping_next),
    canSkipPrevious: !Boolean(disallows.skipping_prev),
    canSeek: !Boolean(disallows.seeking),
    canToggleShuffle: !Boolean(disallows.toggling_shuffle),
    canToggleRepeat: !Boolean(disallows.toggling_repeat_context) && !Boolean(disallows.toggling_repeat_track),
  };
}

function normalizeContextLabel(label: string): string {
  if (label === "playlist") return "Playlist";
  if (label === "album") return "Album";
  if (label === "artist") return "Artist";
  if (label === "collection") return "Collection";
  if (label === "show") return "Podcast";
  return "Other";
}

function sortDistribution<T extends { plays: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.plays - a.plays);
}

async function fetchContextMixInsights(accessToken: string, userId: string): Promise<ContextMixInsights> {
  const dbContext = await getContextDistributionStats(userId);

  if (dbContext.totalPlays > 0) {
    const normalized = sortDistribution(
      dbContext.distribution.map((item) => ({
        label: normalizeContextLabel(item.label),
        plays: item.plays,
        share: item.share,
      }))
    );

    return {
      totalPlays: dbContext.totalPlays,
      distribution: normalized,
    };
  }

  const recentResponse = await fetchSpotifyJson<{
    items?: Array<{
      context?: {
        type?: string | null;
      } | null;
    }>;
  }>(accessToken, "/me/player/recently-played?limit=50");

  const counts = new Map<string, number>();
  for (const item of recentResponse.items ?? []) {
    const rawType = item.context?.type ?? "unknown";
    const label = normalizeContextLabel(rawType);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const distribution = sortDistribution(
    Array.from(counts.entries()).map(([label, plays]) => ({
      label,
      plays,
      share: toPercentShare(plays, total),
    }))
  );

  return {
    totalPlays: total,
    distribution,
  };
}

async function runSection<T>(
  execute: () => Promise<T>
): Promise<InsightSection<T> & { permissionDenied: boolean }> {
  try {
    const data = await execute();
    return {
      status: "ok",
      data,
      message: null,
      permissionDenied: false,
    };
  } catch (error) {
    if (error instanceof SpotifyLiveInsightsError && isPermissionError(error.status)) {
      return {
        status: "limited",
        data: null,
        message: t("insights.live.permissionsMissing"),
        permissionDenied: true,
      };
    }

    return {
      status: "error",
      data: null,
      message: error instanceof Error ? error.message : t("insights.live.sectionError"),
      permissionDenied: false,
    };
  }
}

export async function getSpotifyLiveInsights(userId: string): Promise<SpotifyLiveInsights> {
  const accessToken = await getValidAccessToken(userId);

  const [topWindows, library, playlists, releases, playbackHealth, contextMix] = await Promise.all([
    runSection(() => fetchTopWindowInsights(accessToken)),
    runSection(() => fetchLibraryInsights(accessToken, userId)),
    runSection(() => fetchPlaylistIntelligence(accessToken)),
    runSection(() => fetchReleaseRadar(accessToken)),
    runSection(() => fetchPlaybackHealth(accessToken)),
    runSection(() => fetchContextMixInsights(accessToken, userId)),
  ]);

  const reconnectRequired =
    topWindows.permissionDenied ||
    library.permissionDenied ||
    playlists.permissionDenied ||
    releases.permissionDenied ||
    playbackHealth.permissionDenied ||
    contextMix.permissionDenied;

  return {
    generatedAt: new Date().toISOString(),
    reconnectRequired,
    topWindows: {
      status: topWindows.status,
      data: topWindows.data,
      message: topWindows.message,
    },
    library: {
      status: library.status,
      data: library.data,
      message: library.message,
    },
    playlists: {
      status: playlists.status,
      data: playlists.data,
      message: playlists.message,
    },
    releases: {
      status: releases.status,
      data: releases.data,
      message: releases.message,
    },
    playbackHealth: {
      status: playbackHealth.status,
      data: playbackHealth.data,
      message: playbackHealth.message,
    },
    contextMix: {
      status: contextMix.status,
      data: contextMix.data,
      message: contextMix.message,
    },
  };
}
