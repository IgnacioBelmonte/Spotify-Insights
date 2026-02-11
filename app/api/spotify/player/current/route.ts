import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
import { getSpotifyPlaybackSnapshot, SpotifyApiError } from "@/src/lib/spotify/player.service";
import { t } from "@/src/lib/i18n";

export async function GET() {
  try {
    const userId = (await cookies()).get("sid")?.value;
    if (!userId) {
      return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPremium: true },
    });

    if (!user?.isPremium) {
      return NextResponse.json({ error: t("player.premiumRequired") }, { status: 403 });
    }

    const accessToken = await getValidAccessToken(userId);
    const snapshot = await getSpotifyPlaybackSnapshot(accessToken);

    return NextResponse.json(
      {
        playback: snapshot.playback,
        devices: snapshot.devices,
        syncedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    if (error instanceof SpotifyApiError) {
      const permissionsMissing =
        error.status === 401 &&
        error.body.toLowerCase().includes("permissions missing");

      if (permissionsMissing || error.status === 403) {
        return NextResponse.json({ error: t("player.permissionsMissing") }, { status: 403 });
      }
    }

    console.error("[/api/spotify/player/current] Error:", error);
    return NextResponse.json({ error: t("player.currentStateError") }, { status: 500 });
  }
}
