export interface WeeklyRecapArtist {
  id: string;
  name: string;
  playCount: number;
}

export interface WeeklyRecapTrack {
  id: string;
  name: string;
  artistName: string;
  playCount: number;
}

export interface WeeklyRecapData {
  timeWindow: {
    from: string;
    to: string;
    label: string;
  };
  discoveryScore: number;
  topArtists: WeeklyRecapArtist[];
  topTracks: WeeklyRecapTrack[];
}

function getIsoDateOffset(daysOffset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString();
}

export async function getWeeklyRecapData(_userId: string): Promise<WeeklyRecapData> {
  return {
    timeWindow: {
      from: getIsoDateOffset(-7),
      to: getIsoDateOffset(0),
      label: "Last 7 days",
    },
    discoveryScore: 78,
    topArtists: [
      { id: "artist_1", name: "Fred again..", playCount: 24 },
      { id: "artist_2", name: "Bad Bunny", playCount: 18 },
      { id: "artist_3", name: "Daft Punk", playCount: 16 },
      { id: "artist_4", name: "Rosalía", playCount: 13 },
      { id: "artist_5", name: "The Weeknd", playCount: 11 },
    ],
    topTracks: [
      { id: "track_1", name: "adore u", artistName: "Fred again..", playCount: 9 },
      { id: "track_2", name: "MONACO", artistName: "Bad Bunny", playCount: 8 },
      { id: "track_3", name: "Instant Crush", artistName: "Daft Punk", playCount: 7 },
      { id: "track_4", name: "DESPECHÁ", artistName: "Rosalía", playCount: 6 },
      { id: "track_5", name: "Blinding Lights", artistName: "The Weeknd", playCount: 5 },
    ],
  };
}
