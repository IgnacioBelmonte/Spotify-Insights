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
});

export default { getInsightsOverview };
