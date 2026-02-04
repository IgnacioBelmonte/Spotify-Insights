import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db/prisma";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";

export async function GET(req: NextRequest) {
  const userId = (await cookies()).get("sid")?.value;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = await getValidAccessToken(userId);

  const r = await fetch(
    "https://api.spotify.com/v1/me/player/recently-played?limit=50",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!r.ok) {
    const txt = await r.text();
    return NextResponse.json({ error: txt }, { status: 500 });
  }

  const data = await r.json();

  let created = 0;

  for (const item of data.items) {
    const track = item.track;

    await prisma.track.upsert({
      where: { id: track.id },
      update: {},
      create: {
        id: track.id,
        name: track.name,
        artistName: track.artists.map((a: any) => a.name).join(", "),
        albumName: track.album?.name,
        durationMs: track.duration_ms,
      },
    });

    await prisma.listeningEvent.create({
      data: {
        userId,
        trackId: track.id,
        playedAt: new Date(item.played_at),
      },
    });

    created++;
  }

  return NextResponse.json({ ok: true, created });
}
