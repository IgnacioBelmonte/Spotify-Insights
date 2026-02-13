import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getValidAccessToken } from "@/src/lib/spotify/getValidToken";
import { t } from "@/src/lib/i18n";

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const MAX_TRACKS_PER_REQUEST = 100;

interface SpotifyPlaylistTrackItem {
  track?: {
    id?: string;
    name?: string;
    artists?: Array<{ name?: string }>;
    album?: {
      images?: Array<{ url?: string }>;
    };
  } | null;
}

interface SpotifyPlaylistTracksResponse {
  items?: SpotifyPlaylistTrackItem[];
  next?: string | null;
}

async function fetchPlaylistTracksPage(
  accessToken: string,
  path: string
): Promise<SpotifyPlaylistTracksResponse> {
  const response = await fetch(path.startsWith("http") ? path : `${SPOTIFY_API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return (await response.json()) as SpotifyPlaylistTracksResponse;
  }

  const errorBody = await response.text();
  const message = errorBody || `Spotify playlist tracks request failed (${response.status})`;
  throw new Error(`${response.status}:${message}`);
}

function mapTrackItem(trackItem: SpotifyPlaylistTrackItem, index: number) {
  const track = trackItem.track;
  if (!track?.id || !track.name) {
    return null;
  }

  const artistName = (track.artists ?? [])
    .map((artist) => artist.name)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .join(", ");

  return {
    entryId: `${track.id}-${index}`,
    id: track.id,
    name: track.name,
    artistName: artistName || t("dashboard.live.unknownArtist"),
    albumImageUrl: track.album?.images?.[0]?.url ?? null,
  };
}

export async function GET(
  _: Request,
  context: { params: Promise<{ playlistId: string }> }
) {
  try {
    const userId = (await cookies()).get("sid")?.value;
    if (!userId) {
      return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
    }

    const { playlistId } = await context.params;
    if (!playlistId || playlistId.trim().length === 0) {
      return NextResponse.json({ error: t("dashboard.live.playlists.invalidPlaylist") }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(userId);

    let nextPath = `/playlists/${encodeURIComponent(
      playlistId
    )}/tracks?fields=items(track(id,name,artists(name),album(images))),next&limit=50`;

    const items: SpotifyPlaylistTrackItem[] = [];

    while (nextPath && items.length < MAX_TRACKS_PER_REQUEST) {
      const page = await fetchPlaylistTracksPage(accessToken, nextPath);
      const pageItems = page.items ?? [];

      if (pageItems.length === 0) {
        break;
      }

      items.push(...pageItems);
      if (items.length >= MAX_TRACKS_PER_REQUEST) {
        break;
      }

      nextPath = page.next ?? "";
    }

    const tracks = items
      .slice(0, MAX_TRACKS_PER_REQUEST)
      .map((item, index) => mapTrackItem(item, index))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json(
      {
        playlistId,
        tracks,
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
        return NextResponse.json({ error: t("dashboard.live.playlists.permissionsMissing") }, { status: 403 });
      }

      if (error.message.startsWith("404:")) {
        return NextResponse.json({ error: t("dashboard.live.playlists.notFound") }, { status: 404 });
      }
    }

    console.error("[/api/spotify/playlists/:playlistId/tracks] Error:", error);
    return NextResponse.json(
      { error: t("dashboard.live.playlists.tracksError") },
      { status: 500 }
    );
  }
}
