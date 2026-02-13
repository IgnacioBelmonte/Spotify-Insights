"use client";

import { useEffect, useMemo, useState } from "react";
import { getLocale, t } from "@/src/lib/i18n";

type TimeHeatmapBucket = {
  weekday: number;
  hour: number;
  plays: number;
};

type TimeIntelligenceResponse = {
  ok: boolean;
  data?: {
    heatmap: TimeHeatmapBucket[];
    peak: { weekday: number | null; hour: number | null; plays: number };
    narrative: { en: string; es: string };
    totals: { plays: number };
    window: { days: number };
  };
  error?: string;
};

const weekdayToApiIndex = [1, 2, 3, 4, 5, 6, 0];

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function getIntensityClass(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "bg-[#0d2530] border-[#1d3b45]";
  const ratio = value / max;
  if (ratio >= 0.75) return "bg-[#1dd6a7] border-[#1dd6a7]";
  if (ratio >= 0.5) return "bg-[#1cb994] border-[#1cb994]";
  if (ratio >= 0.25) return "bg-[#1a8f7f] border-[#1a8f7f]";
  return "bg-[#176474] border-[#176474]";
}

export function TimeIntelligenceHeatmap({ timeZone }: { timeZone: string }) {
  const locale = getLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<TimeIntelligenceResponse["data"] | null>(null);
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", { weekday: "short" });
    const monday = new Date(Date.UTC(2024, 0, 1)); // Monday
    return weekdayToApiIndex.map((_, index) =>
      formatter
        .format(new Date(monday.getTime() + index * 24 * 60 * 60 * 1000))
        .replace(".", "")
        .replace(/^./, (value) => value.toUpperCase())
    );
  }, [locale]);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/insights/time-intelligence?tz=${encodeURIComponent(timeZone)}&days=90`,
          { credentials: "same-origin" }
        );
        const json = (await response.json()) as TimeIntelligenceResponse;

        if (!response.ok || !json.ok || !json.data) {
          throw new Error(json.error || t("insights.fetchError", { status: response.status }));
        }

        if (!active) return;
        setPayload(json.data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : t("errors.fetchInsights"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [timeZone]);

  const matrix = useMemo(() => {
    const base = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    if (!payload) return base;

    for (const bucket of payload.heatmap) {
      if (bucket.weekday < 0 || bucket.weekday > 6) continue;
      if (bucket.hour < 0 || bucket.hour > 23) continue;
      base[bucket.weekday][bucket.hour] = bucket.plays;
    }

    return base;
  }, [payload]);

  const maxPlays = useMemo(() => {
    let max = 0;
    matrix.forEach((row) => row.forEach((value) => {
      if (value > max) max = value;
    }));
    return max;
  }, [matrix]);

  const narrative = payload
    ? locale === "es"
      ? payload.narrative.es
      : payload.narrative.en
    : null;

  return (
    <section className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 shadow-lg shadow-emerald-500/10 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t("time.title")}</h2>
        {payload ? (
          <span className="rounded-full border border-[#28545a] bg-[#102631] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#91d8c7]">
            {t("time.window", { days: payload.window.days })}
          </span>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-slate-400">{t("time.loading")}</p> : null}
      {error ? <p className="text-sm text-red-300">{t("time.error", { message: error })}</p> : null}

      {!loading && !error && payload ? (
        <>
          <div className="space-y-3">
            <div className="grid grid-cols-[52px_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-slate-400">
              <div />
              {Array.from({ length: 24 }).map((_, hour) => (
                <div key={`hour-${hour}`} className="text-center">
                  {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
                </div>
              ))}

              {weekdayToApiIndex.map((apiWeekday, rowIndex) => (
                <div key={`row-${apiWeekday}`} className="contents">
                  <div className="flex items-center text-xs text-slate-300">{weekdayLabels[rowIndex]}</div>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const plays = matrix[apiWeekday][hour] ?? 0;
                    return (
                      <div
                        key={`cell-${apiWeekday}-${hour}`}
                        className={`h-4 rounded border ${getIntensityClass(plays, maxPlays)}`}
                        title={`${weekdayLabels[rowIndex]} ${formatHour(hour)} · ${plays} ${t("time.plays")}`}
                        aria-label={`${weekdayLabels[rowIndex]} ${formatHour(hour)} · ${plays} ${t("time.plays")}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{t("time.legend.low")}</span>
              <div className="flex items-center gap-1">
                {[0.15, 0.35, 0.55, 0.8, 1].map((ratio) => (
                  <span
                    key={`legend-${ratio}`}
                    className={`inline-block h-3 w-4 rounded border ${getIntensityClass(
                      Math.round(maxPlays * ratio),
                      maxPlays
                    )}`}
                  />
                ))}
              </div>
              <span>{t("time.legend.high")}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#204148] bg-[#0b1d25]/85 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#87b7b3]">{t("time.mostActive")}</p>
            <p className="mt-2 text-sm text-slate-100">{narrative}</p>
            <p className="mt-2 text-xs text-slate-400">
              {t("time.totalPlays", { plays: payload.totals.plays })}
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
