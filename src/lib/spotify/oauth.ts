import crypto from "crypto";

export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
  "streaming",
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state",
].join(" ");

export function makeSpotifyAuthUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SPOTIFY_SCOPES,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    state,
    show_dialog: "false",
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export function makeState() {
  return crypto.randomBytes(16).toString("hex");
}
