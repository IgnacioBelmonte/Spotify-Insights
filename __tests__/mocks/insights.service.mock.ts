// Centralized insights service mock
export const getInsightsOverview = jest.fn().mockResolvedValue({
  stats: { total_minutes_listened: 123, total_plays: 45, unique_tracks: 10, unique_artists: 5 },
  topTracks: [{ track_id: "1", name: "Song 1", artist: "Artist 1", plays: 10, duration_ms: 180000 }],
  dailyActivity: [{ date: "2026-01-01", plays: 5, minutes_listened: 15 }],
});

export default { getInsightsOverview };
