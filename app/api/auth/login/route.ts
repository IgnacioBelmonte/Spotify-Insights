import { NextResponse } from "next/server";
import { makeSpotifyAuthUrl, makeState } from "@/src/lib/spotify/oauth";

export async function GET() {
  const state = makeState();
  const url = makeSpotifyAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}