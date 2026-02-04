import { NextResponse } from "next/server";
import { exchangeCodeForToken, fetchSpotifyMe } from "@/src/lib/spotify/client";
import { prisma } from "@/src/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");

    if (err) {
      console.error("[oauth callback] Spotify error:", err);
      return NextResponse.redirect(`${process.env.APP_URL}/?error=${encodeURIComponent(err)}`);
    }

    if (!code || !state) {
      console.error("[oauth callback] Missing code or state");
      return NextResponse.redirect(`${process.env.APP_URL}/?error=Missing authorization code`);
    }

    // En Next 16 route handler, leemos cookies desde headers:
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/);
    const cookieState = match?.[1];

    // SIEMPRE validar state - no hay excepciones en incógnito
    // Si no hay cookie, es un ataque CSRF o sesión corrupta
    if (!cookieState) {
      console.error("[oauth callback] No oauth_state cookie found - possible CSRF or incognito mode issue");
      return NextResponse.redirect(`${process.env.APP_URL}/?error=Session expired. Please login again.`);
    }

    if (cookieState !== state) {
      console.error("[oauth callback] State mismatch - cookie:", cookieState, "param:", state);
      return NextResponse.redirect(`${process.env.APP_URL}/?error=Invalid session state. Please login again.`);
    }

    let token;
    try {
      token = await exchangeCodeForToken(code);
    } catch (exchangeErr) {
      console.error("[oauth callback] Token exchange error:", exchangeErr);
      const errorMsg = exchangeErr instanceof Error ? exchangeErr.message : "Token exchange failed";
      return NextResponse.redirect(
        `${process.env.APP_URL}/?error=${encodeURIComponent(errorMsg)}`
      );
    }

    let me;
    try {
      me = await fetchSpotifyMe(token.access_token);
    } catch (meErr) {
      console.error("[oauth callback] Fetch user error:", meErr);
      return NextResponse.redirect(`${process.env.APP_URL}/?error=Failed to fetch user profile`);
    }

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
        refreshToken: token.refresh_token ?? undefined,
        expiresAt,
      },
      create: {
        userId: user.id,
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? "",
        expiresAt,
      },
    });

    // Sesión mínima: cookie con userId
    const res = NextResponse.redirect(`${process.env.APP_URL}/dashboard`);
    res.cookies.set("sid", user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    // Limpia state cookie
    res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });

    return res;
  } catch (error) {
    console.error("[oauth callback] Unexpected error:", error);
    return NextResponse.redirect(
      `${process.env.APP_URL}/?error=Authentication failed. Please try again.`
    );
  }
}
