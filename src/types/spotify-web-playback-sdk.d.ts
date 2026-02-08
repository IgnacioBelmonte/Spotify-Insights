declare global {
  interface Window {
    Spotify?: SpotifyWebPlaybackNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

interface SpotifyWebPlaybackNamespace {
  Player: new (options: SpotifyPlayerInit) => SpotifyPlayer;
}

interface SpotifyPlayerInit {
  name: string;
  getOAuthToken: (callback: (token: string) => void) => void;
  volume?: number;
}

interface SpotifyPlaybackTrack {
  uri: string;
  id: string;
  name: string;
  duration_ms: number;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
}

interface SpotifyPlayerState {
  context: unknown;
  disallows: Record<string, boolean>;
  paused: boolean;
  position: number;
  duration: number;
  repeat_mode: number;
  shuffle: boolean;
  track_window: {
    current_track: SpotifyPlaybackTrack;
    previous_tracks: SpotifyPlaybackTrack[];
    next_tracks: SpotifyPlaybackTrack[];
  };
}

interface SpotifyPlayerError {
  message: string;
}

interface SpotifyReadyEvent {
  device_id: string;
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  addListener: (event: "ready" | "not_ready", callback: (event: SpotifyReadyEvent) => void) => boolean;
  addListener: (
    event:
      | "initialization_error"
      | "authentication_error"
      | "account_error"
      | "playback_error",
    callback: (error: SpotifyPlayerError) => void
  ) => boolean;
  addListener: (
    event: "player_state_changed",
    callback: (state: SpotifyPlayerState | null) => void
  ) => boolean;
  removeListener: (event?: string) => boolean;
}

export {};
