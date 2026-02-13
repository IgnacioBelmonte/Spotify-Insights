import { prisma } from "@/src/lib/db/prisma";

export interface TasteProfileBucket {
  label: string;
  plays: number;
  share: number;
}

export interface TasteProfileSnapshot {
  generatedAt: string;
  window: {
    from: string;
    to: string;
    days: number;
  };
  totals: {
    plays: number;
    tracksWithAudioFeatures: number;
  };
  audio: {
    averageEnergy: number;
    averageValence: number;
  };
  topGenres: TasteProfileBucket[];
  topDecades: TasteProfileBucket[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const snapshotCache = new Map<string, { expiresAt: number; value: TasteProfileSnapshot }>();

const artistGenreRules: Array<{ genre: string; matches: RegExp[] }> = [
  { genre: "reggaeton", matches: [/bad bunny/i, /rosal[ií]a/i, /j balvin/i, /karol g/i] },
  { genre: "electronic", matches: [/daft punk/i, /fred again/i, /calvin harris/i, /deadmau5/i] },
  { genre: "pop", matches: [/the weeknd/i, /taylor swift/i, /dua lipa/i, /ariana grande/i] },
  { genre: "hip-hop", matches: [/drake/i, /kendrick/i, /travis scott/i, /future/i] },
  { genre: "rock", matches: [/arctic monkeys/i, /coldplay/i, /radiohead/i, /foo fighters/i] },
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function toBuckets(map: Map<string, number>, total: number, maxItems = 5): TasteProfileBucket[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([label, plays]) => ({
      label,
      plays,
      share: total > 0 ? round(plays / total) : 0,
    }));
}

function inferGenre(artistName: string): string {
  for (const rule of artistGenreRules) {
    if (rule.matches.some((re) => re.test(artistName))) {
      return rule.genre;
    }
  }
  return "other";
}

function toDecade(releaseDate: string | null | undefined): string {
  if (!releaseDate) return "unknown";
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  if (!Number.isFinite(year)) return "unknown";
  return `${Math.floor(year / 10) * 10}s`;
}

export async function getTasteProfileSnapshot(userId: string, days = 90): Promise<TasteProfileSnapshot> {
  const cacheKey = `${userId}:${days}`;
  const cached = snapshotCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);

  const events = await prisma.listeningEvent.findMany({
    where: {
      userId,
      playedAt: {
        gte: from,
        lte: to,
      },
    },
    include: {
      track: {
        include: {
          features: true,
        },
      },
    },
    orderBy: {
      playedAt: "desc",
    },
  });

  const totalPlays = events.length;

  let energySum = 0;
  let valenceSum = 0;
  let featureSamples = 0;
  const genres = new Map<string, number>();
  const decades = new Map<string, number>();

  for (const event of events) {
    const genre = inferGenre(event.track.artistName);
    genres.set(genre, (genres.get(genre) ?? 0) + 1);

    const decade = toDecade(event.track.albumReleaseDate);
    decades.set(decade, (decades.get(decade) ?? 0) + 1);

    if (event.track.features?.energy != null && event.track.features?.valence != null) {
      energySum += event.track.features.energy;
      valenceSum += event.track.features.valence;
      featureSamples += 1;
    }
  }

  const snapshot: TasteProfileSnapshot = {
    generatedAt: new Date().toISOString(),
    window: {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
    },
    totals: {
      plays: totalPlays,
      tracksWithAudioFeatures: featureSamples,
    },
    audio: {
      averageEnergy: featureSamples > 0 ? round(energySum / featureSamples) : 0,
      averageValence: featureSamples > 0 ? round(valenceSum / featureSamples) : 0,
    },
    topGenres: toBuckets(genres, totalPlays),
    topDecades: toBuckets(decades, totalPlays),
  };

  snapshotCache.set(cacheKey, {
    value: snapshot,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return snapshot;
}

export function clearTasteProfileCache(): void {
  snapshotCache.clear();
}
