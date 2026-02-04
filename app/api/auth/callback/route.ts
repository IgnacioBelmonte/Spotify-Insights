/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { exchangeCodeForToken, fetchSpotifyMe } from "@/src/lib/spotify/client";
import { prisma } from "@/src/lib/db/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) return NextResponse.redirect(`${process.env.APP_URL}/?error=${err}`);
  if (!code || !state) return NextResponse.json({ error: "Missing code/state" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const oauthState = (req as any).cookies?.get?.("oauth_state")?.value; // en route handler a veces no está; lo hacemos con NextResponse cookies abajo

  // En Next 16 route handler, leemos cookies desde headers:
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/);
  const cookieState = match?.[1];

  if (!cookieState || cookieState !== state) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const token = await exchangeCodeForToken(code);
  const me = await fetchSpotifyMe(token.access_token);

  const user = await prisma.user.upsert({
    where: { spotifyUserId: me.id },
    update: {
      displayName: me.display_name ?? undefined,
      email: me.email ?? undefined,
      imageUrl: me.images?.[0]?.url ?? undefined,
    },
    create: {
      spotifyUserId: me.id,
      displayName: me.display_name ?? undefined,
      email: me.email ?? undefined,
      imageUrl: me.images?.[0]?.url ?? undefined,
    },
  });

  const expiresAt = new Date(Date.now() + token.expires_in * 1000);

  await prisma.spotifyToken.upsert({
    where: { userId: user.id },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? undefined, // a veces viene vacío si ya existe
      expiresAt,
    },
    create: {
      userId: user.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? "",
      expiresAt,
    },
  });

  // Sesión mínima: cookie con userId (para dev). Luego la firmamos/mejoramos.
  const res = NextResponse.redirect(`${process.env.APP_URL}/dashboard`);
  res.cookies.set("sid", user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  // limpia state
  res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });

  return res;
}
