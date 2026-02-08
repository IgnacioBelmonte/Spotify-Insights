import { describe, expect, it } from "@jest/globals";
import {
  buildRecentlyPlayedSyncPayload,
  derivePlayedDurationMs,
  type SpotifyRecentlyPlayedItem,
} from "@/src/lib/sync/recently-played.mapper";

describe("recently-played.mapper", () => {
  it("should derive played duration from the next playback timestamp", () => {
    const playedAt = new Date("2026-02-08T10:00:00.000Z");
    const nextPlayedAt = new Date("2026-02-08T09:57:00.000Z");

    const duration = derivePlayedDurationMs(playedAt, nextPlayedAt, 300000);

    expect(duration).toBe(180000);
  });

  it("should normalize tracks, artists and events for sync", () => {
    const items: SpotifyRecentlyPlayedItem[] = [
      {
        played_at: "2026-02-08T10:00:00.000Z",
        track: {
          id: "track-a",
          name: "Track A",
          duration_ms: 300000,
          album: {
            name: "Album A",
            images: [{ url: "https://i.scdn.co/image/album-a" }],
          },
          artists: [
            { id: "artist-a", name: "Artist A" },
            { id: "artist-b", name: "Artist B" },
          ],
        },
      },
      {
        played_at: "2026-02-08T09:57:00.000Z",
        track: {
          id: "track-b",
          name: "Track B",
          duration_ms: 240000,
          album: {
            name: "Album B",
            images: [{ url: "https://i.scdn.co/image/album-b" }],
          },
          artists: [{ id: "artist-a", name: "Artist A" }],
        },
      },
      {
        played_at: "2026-02-08T09:50:00.000Z",
        track: {
          id: "track-a",
          name: "Track A",
          duration_ms: 300000,
          album: {
            name: "Album A",
            images: [],
          },
          artists: [
            { id: "artist-a", name: "Artist A" },
            { id: "artist-b", name: "Artist B" },
          ],
        },
      },
    ];

    const payload = buildRecentlyPlayedSyncPayload(items);
    const trackA = payload.tracks.find((track) => track.id === "track-a");

    expect(payload.tracks).toHaveLength(2);
    expect(payload.artists).toHaveLength(2);
    expect(payload.events).toHaveLength(3);

    expect(trackA).toEqual({
      id: "track-a",
      name: "Track A",
      artistName: "Artist A, Artist B",
      albumName: "Album A",
      albumImageUrl: "https://i.scdn.co/image/album-a",
      durationMs: 300000,
      artists: [
        { artistId: "artist-a", position: 0 },
        { artistId: "artist-b", position: 1 },
      ],
    });

    expect(payload.events[0].durationMs).toBe(180000);
    expect(payload.events[1].durationMs).toBe(240000);
  });
});
