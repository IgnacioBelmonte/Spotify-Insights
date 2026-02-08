// Centralized insights service mock
export const getInsightsOverview = jest.fn().mockResolvedValue({
  stats: {
    totalMinutesListened: 123,
    totalPlays: 45,
    distinctTracksCount: 10,
    distinctArtistsCount: 5,
  },
  topTracks: [
    {
      id: "1",
      name: "Song 1",
      artistName: "Artist 1",
      playCount: 10,
      totalMinutesListened: 180,
      albumImageUrl: "https://i.scdn.co/image/track-1",
      primaryArtist: {
        id: "artist-1",
        name: "Artist 1",
        imageUrl: "https://i.scdn.co/image/artist-1",
      },
    },
  ],
  dailyActivity: [
    {
      date: "2026-01-01",
      durationMs: 900000,
      plays: [
        { trackId: "1", name: "Song 1", artistName: "Artist 1", playedAt: "2026-01-01T08:15:00.000Z" },
      ],
    },
  ],
  lastSyncedAt: "2026-02-08T12:00:00.000Z",
});

export default { getInsightsOverview };
