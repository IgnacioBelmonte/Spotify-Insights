"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { t } from "@/src/lib/i18n";
import type { TasteProfileSnapshot } from "@/src/lib/insights/taste-profile.service";

type FetchState = "loading" | "ready" | "empty" | "error";

type TasteProfileResponse = {
  ok: boolean;
  data?: TasteProfileSnapshot;
  error?: string;
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function TasteProfilePanel() {
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<TasteProfileSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchTasteProfile() {
      try {
        setState("loading");
        const res = await fetch("/api/insights/taste-profile", { credentials: "same-origin" });
        const json = (await res.json()) as TasteProfileResponse;

        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error ?? t("taste.error"));
        }

        if (!active) return;

        const payload = json.data;
        const isEmpty = payload.totals.plays === 0;
        setData(payload);
        setError(null);
        setState(isEmpty ? "empty" : "ready");
      } catch (fetchError) {
        if (!active) return;
        setState("error");
        setData(null);
        setError(fetchError instanceof Error ? fetchError.message : t("taste.error"));
      }
    }

    void fetchTasteProfile();
    return () => {
      active = false;
    };
  }, []);

  const radarData = useMemo(() => {
    if (!data) return [];
    return [
      { metric: t("taste.audio.energy"), value: Math.round(data.audio.averageEnergy * 100) },
      { metric: t("taste.audio.valence"), value: Math.round(data.audio.averageValence * 100) },
    ];
  }, [data]);

  const topGenres = data?.topGenres ?? [];
  const topDecades = data?.topDecades ?? [];

  return (
    <section className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 sm:p-6 shadow-lg shadow-emerald-500/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">{t("taste.badge")}</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{t("taste.title")}</h2>
        </div>
        {data ? (
          <p className="text-xs text-slate-300">
            {t("taste.window", { days: data.window.days })}
          </p>
        ) : null}
      </div>

      {state === "loading" ? <p className="mt-4 text-sm text-slate-300">{t("taste.loading")}</p> : null}
      {state === "error" ? <p className="mt-4 text-sm text-red-300">{error ?? t("taste.error")}</p> : null}
      {state === "empty" ? <p className="mt-4 text-sm text-slate-300">{t("taste.empty")}</p> : null}

      {state === "ready" && data ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-[#27484d] bg-[#0d2028] p-3">
              <p className="text-xs text-slate-400">{t("taste.stats.plays")}</p>
              <p className="mt-1 text-2xl font-bold text-white">{data.totals.plays}</p>
            </article>
            <article className="rounded-xl border border-[#27484d] bg-[#0d2028] p-3">
              <p className="text-xs text-slate-400">{t("taste.stats.features")}</p>
              <p className="mt-1 text-2xl font-bold text-white">{data.totals.tracksWithAudioFeatures}</p>
            </article>
            <article className="rounded-xl border border-[#27484d] bg-[#0d2028] p-3">
              <p className="text-xs text-slate-400">{t("taste.stats.mood")}</p>
              <p className="mt-1 text-2xl font-bold text-emerald-300">{percent(data.audio.averageValence)}</p>
            </article>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[#27484d] bg-[#0d2028] p-4">
              <h3 className="text-sm font-semibold text-white">{t("taste.audio.title")}</h3>
              <p className="mt-1 text-xs text-slate-400">{t("taste.audio.subtitle")}</p>
              <div className="mt-3 h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="70%">
                    <PolarGrid stroke="#34535a" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#dbe6e4", fontSize: 12 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Radar dataKey="value" stroke="#34d399" fill="#34d399" fillOpacity={0.45} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-[#27484d] bg-[#0d2028] p-4">
              <h3 className="text-sm font-semibold text-white">{t("taste.decades.title")}</h3>
              <p className="mt-1 text-xs text-slate-400">{t("taste.decades.subtitle")}</p>
              <div className="mt-3 h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDecades} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="#9fb4b2" fontSize={11} />
                    <YAxis stroke="#9fb4b2" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #24414a", background: "#0a1921", color: "#e2e8f0" }}
                      labelStyle={{ color: "#d1fae5" }}
                    />
                    <Bar dataKey="plays" radius={[8, 8, 0, 0]} fill="#22d3ee" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-[#27484d] bg-[#0d2028] p-4">
              <h3 className="text-sm font-semibold text-white">{t("taste.genres.title")}</h3>
              <ul className="mt-3 space-y-2">
                {topGenres.map((genre) => (
                  <li key={genre.label} className="flex items-center justify-between gap-2 text-sm text-slate-200">
                    <span className="capitalize">{genre.label}</span>
                    <span className="text-xs text-slate-400">{percent(genre.share)}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-xl border border-[#27484d] bg-[#0d2028] p-4">
              <h3 className="text-sm font-semibold text-white">{t("taste.signature.title")}</h3>
              <p className="mt-2 text-sm text-slate-300">{t("taste.signature.body", { energy: percent(data.audio.averageEnergy), mood: percent(data.audio.averageValence) })}</p>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}
