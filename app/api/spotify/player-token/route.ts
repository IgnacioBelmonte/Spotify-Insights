import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
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

    return NextResponse.json(
      { accessToken },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[/api/spotify/player-token] Error:", error);
    return NextResponse.json({ error: t("player.tokenError") }, { status: 500 });
  }
}

