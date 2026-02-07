/* eslint-disable @typescript-eslint/no-explicit-any */
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

  const trackIds = Array.from(
    new Set(
      data.items
        .map((item: any) => item?.track?.id)
        .filter((id: any): id is string => Boolean(id))
    )
  );

  const audioFeaturesById = new Map<string, any>();
  if (trackIds.length > 0) {
    const featuresRes = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${trackIds.join(",")}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (featuresRes.ok) {
      const featuresData = await featuresRes.json();
      const featuresList = Array.isArray(featuresData?.audio_features)
        ? featuresData.audio_features
        : [];
      for (const f of featuresList) {
        if (f?.id) audioFeaturesById.set(f.id, f);
      }
    }
  }

  let created = 0;

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const track = item.track;
    const trackDurationMs = track?.duration_ms ?? null;
    const playedAt = new Date(item.played_at);
    const nextItem = data.items[i + 1];
    let derivedDurationMs: number | null = trackDurationMs;

    if (nextItem?.played_at && trackDurationMs) {
      const nextPlayedAt = new Date(nextItem.played_at);
      const deltaMs = playedAt.getTime() - nextPlayedAt.getTime();
      if (deltaMs > 0 && deltaMs < trackDurationMs) {
        derivedDurationMs = deltaMs;
      }
    }

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

    const features = audioFeaturesById.get(track.id);
    if (features) {
      await prisma.audioFeatures.upsert({
        where: { trackId: track.id },
        update: {
          danceability: features.danceability,
          energy: features.energy,
          valence: features.valence,
          tempo: features.tempo,
          acousticness: features.acousticness,
          instrumentalness: features.instrumentalness,
          liveness: features.liveness,
          speechiness: features.speechiness,
        },
        create: {
          trackId: track.id,
          danceability: features.danceability,
          energy: features.energy,
          valence: features.valence,
          tempo: features.tempo,
          acousticness: features.acousticness,
          instrumentalness: features.instrumentalness,
          liveness: features.liveness,
          speechiness: features.speechiness,
        },
      });
    }

    await prisma.listeningEvent.upsert({
      where: {
        userId_playedAt: {
          userId,
          playedAt,
        },
      },
      update: {
        trackId: track.id,
        durationMs: derivedDurationMs,
      },
      create: {
        userId,
        trackId: track.id,
        playedAt,
        durationMs: derivedDurationMs,
      },
    });

    created++;
  }

  return NextResponse.json({ ok: true, created });
}
