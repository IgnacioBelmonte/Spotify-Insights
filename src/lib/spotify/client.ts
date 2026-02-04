type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

export async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
  });

  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID!}:${process.env.SPOTIFY_CLIENT_SECRET!}`
  ).toString("base64");

  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Token exchange failed: ${r.status} ${txt}`);
  }

  return (await r.json()) as TokenResponse;
}

export async function fetchSpotifyMe(accessToken: string) {
  const r = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Spotify /me failed: ${r.status}`);
  return r.json() as Promise<{
    id: string;
    display_name: string | null;
    email?: string;
    images?: { url: string }[];
  }>;

};
type RefreshResponse = {
access_token: string;
token_type: "Bearer";
scope: string;
expires_in: number;
}
export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID!}:${process.env.SPOTIFY_CLIENT_SECRET!}`
  ).toString("base64");

  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Refresh failed: ${r.status} ${txt}`);
  }

  return (await r.json()) as RefreshResponse;

}
