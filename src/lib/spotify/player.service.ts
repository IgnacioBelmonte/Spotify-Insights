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

type SpotifyRepeatMode = "off" | "track" | "context";

interface SpotifyPlaybackDeviceResponse {
  id?: string;
  is_active?: boolean;
  is_restricted?: boolean;
  name?: string;
  type?: string;
  volume_percent?: number | null;
}

interface SpotifyCurrentPlaybackResponse {
  is_playing?: boolean;
  progress_ms?: number | null;
  repeat_state?: string;
  shuffle_state?: boolean;
  device?: SpotifyPlaybackDeviceResponse | null;
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

interface SpotifyDevicesResponse {
  devices?: SpotifyPlaybackDeviceResponse[];
}

export interface SpotifyPlaybackDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
  volumePercent: number | null;
}

export interface SpotifyCurrentPlayback {
  trackId: string;
  trackName: string;
  artistName: string;
  albumImageUrl: string | null;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  deviceId: string | null;
  deviceName: string | null;
  shuffleEnabled: boolean;
  repeatMode: SpotifyRepeatMode;
  volumePercent: number | null;
}

export interface SpotifyPlaybackSnapshot {
  playback: SpotifyCurrentPlayback | null;
  devices: SpotifyPlaybackDevice[];
}

export type SpotifyPlaybackControlAction =
  | "play"
  | "pause"
  | "next"
  | "previous"
  | "seek"
  | "volume"
  | "shuffle"
  | "repeat"
  | "transfer";

export interface SpotifyPlaybackControlInput {
  action: SpotifyPlaybackControlAction;
  deviceId?: string;
  positionMs?: number;
  volumePercent?: number;
  state?: boolean;
  mode?: SpotifyRepeatMode;
  play?: boolean;
}

async function ensureSpotifyRequestSuccess(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new SpotifyApiError(response.status, body, fallbackMessage);
}

function createSpotifyAuthHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function appendDeviceQuery(url: URL, deviceId?: string): void {
  if (deviceId && deviceId.trim().length > 0) {
    url.searchParams.set("device_id", deviceId);
  }
}

function mapSpotifyDevice(payload: SpotifyPlaybackDeviceResponse): SpotifyPlaybackDevice | null {
  if (!payload.id || !payload.name || !payload.type) {
    return null;
  }

  return {
    id: payload.id,
    name: payload.name,
    type: payload.type,
    isActive: Boolean(payload.is_active),
    isRestricted: Boolean(payload.is_restricted),
    volumePercent:
      typeof payload.volume_percent === "number"
        ? Math.max(0, Math.min(payload.volume_percent, 100))
        : null,
  };
}

function parseRepeatMode(mode: string | undefined): SpotifyRepeatMode {
  if (mode === "track" || mode === "context" || mode === "off") {
    return mode;
  }

  return "off";
}

async function transferPlaybackDevice(accessToken: string, deviceId: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player`, {
    method: "PUT",
    headers: {
      ...createSpotifyAuthHeaders(accessToken),
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
        ...createSpotifyAuthHeaders(accessToken),
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

export async function getSpotifyPlaybackDevices(
  accessToken: string
): Promise<SpotifyPlaybackDevice[]> {
  const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player/devices`, {
    method: "GET",
    headers: createSpotifyAuthHeaders(accessToken),
  });

  await ensureSpotifyRequestSuccess(response, "Failed to fetch playback devices");
  const payload = (await response.json()) as SpotifyDevicesResponse;
  const devices = payload.devices ?? [];

  return devices
    .map((device) => mapSpotifyDevice(device))
    .filter((device): device is SpotifyPlaybackDevice => device !== null);
}

export async function getCurrentSpotifyPlayback(
  accessToken: string
): Promise<SpotifyCurrentPlayback | null> {
  const response = await fetch(
    `${SPOTIFY_API_BASE_URL}/me/player?additional_types=track`,
    {
      method: "GET",
      headers: createSpotifyAuthHeaders(accessToken),
    }
  );

  if (response.status === 204) {
    return null;
  }

  await ensureSpotifyRequestSuccess(response, "Failed to fetch current playback state");
  const data = (await response.json()) as SpotifyCurrentPlaybackResponse;
  const item = data.item;
  const device = data.device ? mapSpotifyDevice(data.device) : null;

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
    deviceId: device?.id ?? null,
    deviceName: device?.name ?? null,
    shuffleEnabled: Boolean(data.shuffle_state),
    repeatMode: parseRepeatMode(data.repeat_state),
    volumePercent: device?.volumePercent ?? null,
  };
}

export async function getSpotifyPlaybackSnapshot(
  accessToken: string
): Promise<SpotifyPlaybackSnapshot> {
  const [playback, devices] = await Promise.all([
    getCurrentSpotifyPlayback(accessToken),
    getSpotifyPlaybackDevices(accessToken),
  ]);

  return {
    playback,
    devices,
  };
}

export async function controlSpotifyPlayback(
  accessToken: string,
  input: SpotifyPlaybackControlInput
): Promise<void> {
  const headers = createSpotifyAuthHeaders(accessToken);

  if (input.action === "transfer") {
    if (!input.deviceId) {
      throw new Error("Device id is required for transfer action");
    }

    const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player`, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_ids: [input.deviceId],
        play: Boolean(input.play),
      }),
    });

    await ensureSpotifyRequestSuccess(response, "Failed to transfer playback");
    return;
  }

  if (input.action === "play" || input.action === "pause") {
    const url = new URL(`${SPOTIFY_API_BASE_URL}/me/player/${input.action}`);
    appendDeviceQuery(url, input.deviceId);
    const response = await fetch(url.toString(), {
      method: "PUT",
      headers,
    });
    await ensureSpotifyRequestSuccess(response, "Failed to control playback state");
    return;
  }

  if (input.action === "next" || input.action === "previous") {
    const endpoint = input.action === "next" ? "next" : "previous";
    const url = new URL(`${SPOTIFY_API_BASE_URL}/me/player/${endpoint}`);
    appendDeviceQuery(url, input.deviceId);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
    });
    await ensureSpotifyRequestSuccess(response, "Failed to skip track");
    return;
  }

  if (input.action === "seek") {
    if (typeof input.positionMs !== "number" || Number.isNaN(input.positionMs)) {
      throw new Error("positionMs is required for seek action");
    }

    const url = new URL(`${SPOTIFY_API_BASE_URL}/me/player/seek`);
    url.searchParams.set("position_ms", String(Math.max(0, Math.floor(input.positionMs))));
    appendDeviceQuery(url, input.deviceId);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers,
    });
    await ensureSpotifyRequestSuccess(response, "Failed to seek playback");
    return;
  }

  if (input.action === "volume") {
    if (typeof input.volumePercent !== "number" || Number.isNaN(input.volumePercent)) {
      throw new Error("volumePercent is required for volume action");
    }

    const safeVolume = Math.max(0, Math.min(Math.round(input.volumePercent), 100));
    const url = new URL(`${SPOTIFY_API_BASE_URL}/me/player/volume`);
    url.searchParams.set("volume_percent", String(safeVolume));
    appendDeviceQuery(url, input.deviceId);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers,
    });
    await ensureSpotifyRequestSuccess(response, "Failed to set volume");
    return;
  }

  if (input.action === "shuffle") {
    if (typeof input.state !== "boolean") {
      throw new Error("state is required for shuffle action");
    }

    const url = new URL(`${SPOTIFY_API_BASE_URL}/me/player/shuffle`);
    url.searchParams.set("state", String(input.state));
    appendDeviceQuery(url, input.deviceId);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers,
    });
    await ensureSpotifyRequestSuccess(response, "Failed to toggle shuffle mode");
    return;
  }

  if (input.action === "repeat") {
    const mode = input.mode ?? "off";
    const url = new URL(`${SPOTIFY_API_BASE_URL}/me/player/repeat`);
    url.searchParams.set("state", mode);
    appendDeviceQuery(url, input.deviceId);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers,
    });
    await ensureSpotifyRequestSuccess(response, "Failed to change repeat mode");
  }
}
