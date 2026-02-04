import { NextResponse } from "next/server";
import { makeSpotifyAuthUrl, makeState } from "@/src/lib/spotify/oauth";

export async function GET() {
  const state = makeState();
  const url = makeSpotifyAuthUrl(state);

  const res = NextResponse.redirect(url);
  
  // Set oauth_state cookie with explicit max-age and secure flags
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
    domain: undefined, // Use default domain
  });
  
  console.log("[/api/auth/login] Generated state, redirecting to Spotify OAuth");
  
  return res;
}