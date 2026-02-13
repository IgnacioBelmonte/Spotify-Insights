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
  listeningRhythm: {
    sessionCount: 12,
    averageSessionMinutes: 34,
    peakHourLocal: 18,
    longestStreakDays: 6,
    activeStreakDays: 3,
  },
  discovery: {
    totalPlays30d: 80,
    uniqueTracks30d: 40,
    uniqueArtists30d: 22,
    newTracks30d: 12,
    newArtists30d: 8,
    repeatPlays30d: 40,
    newTrackShare: 0.3,
    repeatShare: 0.5,
  },
  consumption: {
    averageTrackDurationMs: 201000,
    explicitPlayShare: 0.27,
    explicitPlays: 33,
    totalPlays: 123,
    albumTypeDistribution: [
      { label: "album", plays: 72, share: 0.58 },
      { label: "single", plays: 51, share: 0.42 },
    ],
    releaseDecadeDistribution: [
      { label: "2010s", plays: 55, share: 0.45 },
      { label: "2020s", plays: 68, share: 0.55 },
    ],
  },
  spotifyLive: null,
  lastSyncedAt: "2026-02-08T12:00:00.000Z",
});

const insightsServiceMock = { getInsightsOverview };

export default insightsServiceMock;
