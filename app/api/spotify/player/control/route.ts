import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/src/lib/db/prisma";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
import {
  controlSpotifyPlayback,
  SpotifyApiError,
  type SpotifyPlaybackControlInput,
} from "@/src/lib/spotify/player.service";
import { t } from "@/src/lib/i18n";

const actionSchema = z.enum([
  "play",
  "pause",
  "next",
  "previous",
  "seek",
  "volume",
  "shuffle",
  "repeat",
  "transfer",
]);

const controlPayloadSchema = z.object({
  action: actionSchema,
  deviceId: z.string().min(1).optional(),
  positionMs: z.number().int().min(0).optional(),
  volumePercent: z.number().int().min(0).max(100).optional(),
  state: z.boolean().optional(),
  mode: z.enum(["off", "track", "context"]).optional(),
  play: z.boolean().optional(),
});

function isValidControlPayload(payload: SpotifyPlaybackControlInput): boolean {
  if (payload.action === "seek") {
    return typeof payload.positionMs === "number";
  }

  if (payload.action === "volume") {
    return typeof payload.volumePercent === "number";
  }

  if (payload.action === "shuffle") {
    return typeof payload.state === "boolean";
  }

  if (payload.action === "repeat") {
    return payload.mode === "off" || payload.mode === "track" || payload.mode === "context";
  }

  if (payload.action === "transfer") {
    return typeof payload.deviceId === "string" && payload.deviceId.length > 0;
  }

  return true;
}

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

    const payload = await request.json().catch(() => null);
    const parsedPayload = controlPayloadSchema.safeParse(payload);
    if (!parsedPayload.success || !isValidControlPayload(parsedPayload.data)) {
      return NextResponse.json({ error: t("player.invalidPayload") }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(userId);
    await controlSpotifyPlayback(accessToken, parsedPayload.data);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof SpotifyApiError) {
      const permissionsMissing =
        error.status === 401 &&
        error.body.toLowerCase().includes("permissions missing");

      if (permissionsMissing || error.status === 403) {
        return NextResponse.json({ error: t("player.permissionsMissing") }, { status: 403 });
      }

      const noActiveDevice =
        error.status === 404 &&
        error.body.toLowerCase().includes("no active device");

      if (noActiveDevice) {
        return NextResponse.json({ error: t("player.noActiveDevice") }, { status: 409 });
      }
    }

    console.error("[/api/spotify/player/control] Error:", error);
    return NextResponse.json({ error: t("player.controlError") }, { status: 500 });
  }
}
