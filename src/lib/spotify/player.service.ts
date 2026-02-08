const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

export class SpotifyApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string, fallbackMessage: string) {
    super(body || fallbackMessage);
    this.name = "SpotifyApiError";
    this.status = status;
    this.body = body;
  }
}

interface SpotifyCurrentPlaybackResponse {
  is_playing?: boolean;
  progress_ms?: number | null;
  item?: {
    id?: string;
    name?: string;
    duration_ms?: number;
    artists?: Array<{ name?: string }>;
    album?: {
      images?: Array<{ url?: string }>;
    };
  } | null;
}

export interface SpotifyCurrentPlayback {
  trackId: string;
  trackName: string;
  artistName: string;
  albumImageUrl: string | null;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
}

async function ensureSpotifyRequestSuccess(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new SpotifyApiError(response.status, body, fallbackMessage);
}

async function transferPlaybackDevice(accessToken: string, deviceId: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
  });

  await ensureSpotifyRequestSuccess(response, "Failed to transfer playback device");
}

async function startTrackPlayback(
  accessToken: string,
  trackId: string,
  deviceId: string
): Promise<void> {
  const response = await fetch(
    `${SPOTIFY_API_BASE_URL}/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [`spotify:track:${trackId}`],
      }),
    }
  );

  await ensureSpotifyRequestSuccess(response, "Failed to start track playback");
}

export async function playTrackOnSpotifyDevice(
  accessToken: string,
  trackId: string,
  deviceId: string
): Promise<void> {
  await transferPlaybackDevice(accessToken, deviceId);
  await startTrackPlayback(accessToken, trackId, deviceId);
}

export async function getCurrentSpotifyPlayback(
  accessToken: string
): Promise<SpotifyCurrentPlayback | null> {
  const response = await fetch(
    `${SPOTIFY_API_BASE_URL}/me/player/currently-playing?additional_types=track`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 204) {
    return null;
  }

  await ensureSpotifyRequestSuccess(response, "Failed to fetch current playback state");
  const data = (await response.json()) as SpotifyCurrentPlaybackResponse;
  const item = data.item;

  if (!item?.id || !item?.name) {
    return null;
  }

  return {
    trackId: item.id,
    trackName: item.name,
    artistName: (item.artists ?? [])
      .map((artist) => artist.name)
      .filter((name): name is string => typeof name === "string" && name.length > 0)
      .join(", "),
    albumImageUrl: item.album?.images?.[0]?.url ?? null,
    durationMs: Math.max(item.duration_ms ?? 1, 1),
    positionMs: Math.max(data.progress_ms ?? 0, 0),
    isPlaying: Boolean(data.is_playing),
  };
}
