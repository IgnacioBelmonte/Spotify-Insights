import { prisma } from "@/src/lib/db/prisma";

export interface TimeHeatmapBucket {
  weekday: number; // 0=Sunday ... 6=Saturday
  hour: number; // 0..23
  plays: number;
}

export interface TimeIntelligenceSnapshot {
  generatedAt: string;
  window: {
    from: string;
    to: string;
    days: number;
  };
  totals: {
    plays: number;
  };
  heatmap: TimeHeatmapBucket[];
  peak: {
    weekday: number | null;
    hour: number | null;
    plays: number;
  };
  narrative: {
    en: string;
    es: string;
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const snapshotCache = new Map<string, { expiresAt: number; value: TimeIntelligenceSnapshot }>();

function toLocalDateParts(date: Date, timeZone: string): { weekday: number; hour: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
    timeZone,
  });

  const parts = formatter.formatToParts(date);
  const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);

  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: weekdays[weekdayName] ?? 0,
    hour: Number.isFinite(hour) ? hour : 0,
  };
}

function buildNarrative(peakWeekday: number | null, peakHour: number | null, plays: number): { en: string; es: string } {
  if (peakWeekday == null || peakHour == null || plays === 0) {
    return {
      en: "Not enough listening data yet to detect a pattern.",
      es: "Todavía no hay suficientes escuchas para detectar un patrón.",
    };
  }

  const weekdaysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekdaysEs = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  const en = `Your most active listening moment is ${weekdaysEn[peakWeekday]} around ${peakHour}:00 (${plays} plays).`;
  const es = `Tu momento de escucha más activo es el ${weekdaysEs[peakWeekday]} sobre las ${peakHour}:00 (${plays} reproducciones).`;

  return { en, es };
}

export async function getTimeIntelligenceSnapshot(
  userId: string,
  opts?: { days?: number; timeZone?: string }
): Promise<TimeIntelligenceSnapshot> {
  const days = opts?.days ?? 90;
  const timeZone = opts?.timeZone ?? "UTC";
  const cacheKey = `${userId}:${days}:${timeZone}`;
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
    select: {
      playedAt: true,
    },
  });

  const buckets = new Map<string, number>();

  for (const event of events) {
    const { weekday, hour } = toLocalDateParts(event.playedAt, timeZone);
    const key = `${weekday}:${hour}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const heatmap: TimeHeatmapBucket[] = [];
  let peak = { weekday: null as number | null, hour: null as number | null, plays: 0 };

  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const plays = buckets.get(`${weekday}:${hour}`) ?? 0;
      heatmap.push({ weekday, hour, plays });

      if (plays > peak.plays) {
        peak = { weekday, hour, plays };
      }
    }
  }

  const snapshot: TimeIntelligenceSnapshot = {
    generatedAt: new Date().toISOString(),
    window: {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
    },
    totals: {
      plays: events.length,
    },
    heatmap,
    peak,
    narrative: buildNarrative(peak.weekday, peak.hour, peak.plays),
  };

  snapshotCache.set(cacheKey, {
    value: snapshot,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return snapshot;
}

export function clearTimeIntelligenceCache(): void {
  snapshotCache.clear();
}
