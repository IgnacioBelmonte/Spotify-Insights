import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
import { t } from "@/src/lib/i18n";

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const MAX_TRACKS_PER_REQUEST = 100;

interface SpotifyAlbumTrackItem {
  id?: string;
  name?: string;
  artists?: Array<{ name?: string }>;
}

interface SpotifyAlbumTracksResponse {
  items?: SpotifyAlbumTrackItem[];
  next?: string | null;
}

interface SpotifyAlbumResponse {
  images?: Array<{ url?: string }>;
  tracks?: {
    items?: SpotifyAlbumTrackItem[];
    next?: string | null;
  };
}

async function fetchSpotifyJson<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(path.startsWith("http") ? path : `${SPOTIFY_API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return (await response.json()) as T;
  }

  const errorBody = await response.text();
  throw new Error(`${response.status}:${errorBody || "Spotify album request failed"}`);
}

function mapTrackItem(
  trackItem: SpotifyAlbumTrackItem,
  albumImageUrl: string | null,
  index: number
) {
  if (!trackItem.id || !trackItem.name) {
    return null;
  }

  const artistName = (trackItem.artists ?? [])
    .map((artist) => artist.name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .join(", ");

  return {
    entryId: `${trackItem.id}-${index}`,
    id: trackItem.id,
    name: trackItem.name,
    artistName: artistName || t("dashboard.live.unknownArtist"),
    albumImageUrl,
  };
}

export async function GET(
  _: Request,
  context: { params: Promise<{ albumId: string }> }
) {
  try {
    const userId = (await cookies()).get("sid")?.value;
    if (!userId) {
      return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
    }

    const { albumId } = await context.params;
    if (!albumId || albumId.trim().length === 0) {
      return NextResponse.json({ error: t("dashboard.live.releases.invalidAlbum") }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(userId);

    const album = await fetchSpotifyJson<SpotifyAlbumResponse>(
      accessToken,
      `/albums/${encodeURIComponent(albumId)}?market=from_token`
    );

    const albumImageUrl = album.images?.[0]?.url ?? null;

    const tracks: SpotifyAlbumTrackItem[] = [...(album.tracks?.items ?? [])];
    let nextPath = album.tracks?.next ?? "";

    while (nextPath && tracks.length < MAX_TRACKS_PER_REQUEST) {
      const page = await fetchSpotifyJson<SpotifyAlbumTracksResponse>(accessToken, nextPath);
      const pageItems = page.items ?? [];
      if (pageItems.length === 0) {
        break;
      }

      tracks.push(...pageItems);
      if (tracks.length >= MAX_TRACKS_PER_REQUEST) {
        break;
      }

      nextPath = page.next ?? "";
    }

    const mappedTracks = tracks
      .slice(0, MAX_TRACKS_PER_REQUEST)
      .map((track, index) => mapTrackItem(track, albumImageUrl, index))
      .filter((track): track is NonNullable<typeof track> => track !== null);

    return NextResponse.json(
      {
        albumId,
        tracks: mappedTracks,
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
    if (error instanceof Error) {
      if (error.message.startsWith("401:") || error.message.startsWith("403:")) {
        return NextResponse.json({ error: t("dashboard.live.releases.permissionsMissing") }, { status: 403 });
      }

      if (error.message.startsWith("404:")) {
        return NextResponse.json({ error: t("dashboard.live.releases.notFound") }, { status: 404 });
      }
    }

    console.error("[/api/spotify/albums/:albumId/tracks] Error:", error);
    return NextResponse.json(
      { error: t("dashboard.live.releases.tracksError") },
      { status: 500 }
    );
  }
}
