import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/src/lib/db/prisma";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
import { playTrackOnSpotifyDevice, SpotifyApiError } from "@/src/lib/spotify/player.service";
import { t } from "@/src/lib/i18n";

const playTrackPayloadSchema = z.object({
  trackId: z.string().min(1),
  deviceId: z.string().min(1),
});

export async function POST(request: Request) {
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

    const payload = await request.json();
    const parsedPayload = playTrackPayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return NextResponse.json({ error: t("player.invalidPayload") }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(userId);
    await playTrackOnSpotifyDevice(
      accessToken,
      parsedPayload.data.trackId,
      parsedPayload.data.deviceId
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof SpotifyApiError) {
      const permissionsMissing =
        error.status === 401 &&
        error.body.toLowerCase().includes("permissions missing");

      if (permissionsMissing || error.status === 403) {
        return NextResponse.json({ error: t("player.permissionsMissing") }, { status: 403 });
      }
    }

    console.error("[/api/spotify/player/play] Error:", error);
    return NextResponse.json({ error: t("player.playbackError") }, { status: 500 });
  }
}
