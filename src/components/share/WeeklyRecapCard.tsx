"use client";

import { useEffect, useMemo, useState } from "react";
import { t } from "@/src/lib/i18n";
import type { WeeklyRecapData } from "@/src/lib/share/weekly-recap.service";

type FetchState = "loading" | "ready" | "empty" | "error";

function sanitizeText(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function buildWeeklyRecapSvg(data: WeeklyRecapData): string {
  const topArtists = data.topArtists
    .slice(0, 5)
    .map((artist, index) => `${index + 1}. ${artist.name} · ${artist.playCount}`)
    .join("\n");

  const topTracks = data.topTracks
    .slice(0, 5)
    .map((track, index) => `${index + 1}. ${track.name} — ${track.artistName} · ${track.playCount}`)
    .join("\n");

  return `
<svg width="1200" height="1600" viewBox="0 0 1200 1600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#072015"/>
      <stop offset="55%" stop-color="#0a2736"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1600" fill="url(#bg)"/>
  <text x="90" y="140" fill="#9ef3d4" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="700">Spotify Insights</text>
  <text x="90" y="210" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="70" font-weight="800">${sanitizeText(t("share.recap.title"))}</text>
  <text x="90" y="270" fill="#9ca3af" font-family="Inter, Arial, sans-serif" font-size="30">${sanitizeText(data.timeWindow.label)}</text>

  <rect x="90" y="330" rx="26" ry="26" width="1020" height="180" fill="#0f1b24" stroke="#1b3a40"/>
  <text x="130" y="410" fill="#9ca3af" font-family="Inter, Arial, sans-serif" font-size="30">${sanitizeText(t("share.recap.discoveryScore"))}</text>
  <text x="130" y="500" fill="#34d399" font-family="Inter, Arial, sans-serif" font-size="92" font-weight="800">${data.discoveryScore}%</text>

  <text x="90" y="620" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="700">${sanitizeText(t("share.recap.topArtists"))}</text>
  <text x="90" y="672" fill="#d1d5db" font-family="Inter, Arial, sans-serif" font-size="28" style="white-space: pre-line">${sanitizeText(topArtists)}</text>

  <text x="90" y="980" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="700">${sanitizeText(t("share.recap.topTracks"))}</text>
  <text x="90" y="1032" fill="#d1d5db" font-family="Inter, Arial, sans-serif" font-size="28" style="white-space: pre-line">${sanitizeText(topTracks)}</text>

  <text x="90" y="1510" fill="#6ee7b7" font-family="Inter, Arial, sans-serif" font-size="24">spotify-insights</text>
</svg>`;
}

async function downloadWeeklyRecapPng(data: WeeklyRecapData) {
  const svgMarkup = buildWeeklyRecapSvg(data);
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image-load-failed"));
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas-context-failed");

    context.drawImage(image, 0, 0);

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "spotify-weekly-recap.png";
    link.click();
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function WeeklyRecapCard() {
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<WeeklyRecapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchWeeklyRecap() {
      try {
        setState("loading");
        const res = await fetch("/api/share/weekly-recap", { credentials: "same-origin" });
        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? t("share.recap.error"));
        }

        const payload = json?.data as WeeklyRecapData;
        const isEmpty = !payload || (payload.topArtists.length === 0 && payload.topTracks.length === 0);

        if (!active) return;

        setData(payload);
        setError(null);
        setState(isEmpty ? "empty" : "ready");
      } catch (fetchError) {
        if (!active) return;

        setData(null);
        setState("error");
        setError(fetchError instanceof Error ? fetchError.message : t("share.recap.error"));
      }
    }

    void fetchWeeklyRecap();

    return () => {
      active = false;
    };
  }, []);

  const topArtists = useMemo(() => data?.topArtists.slice(0, 5) ?? [], [data]);
  const topTracks = useMemo(() => data?.topTracks.slice(0, 5) ?? [], [data]);

  return (
    <section className="rounded-2xl border border-[#1b3a40] bg-[#0f1b24]/85 p-5 sm:p-6 shadow-lg shadow-emerald-500/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">{t("share.recap.badge")}</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{t("share.recap.title")}</h2>
        </div>
        <button
          type="button"
          disabled={state !== "ready" || !data || isDownloading}
          onClick={async () => {
            if (!data) return;
            setIsDownloading(true);
            try {
              await downloadWeeklyRecapPng(data);
            } catch {
              setState("error");
              setError(t("share.recap.downloadError"));
            } finally {
              setIsDownloading(false);
            }
          }}
          className="inline-flex items-center justify-center rounded-full border border-[#2f6164] bg-[#11323a] px-4 py-2 text-sm font-medium text-[#dff7f2] transition hover:bg-[#18444f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDownloading ? t("share.recap.downloading") : t("share.recap.download")}
        </button>
      </div>

      {state === "loading" ? <p className="mt-4 text-sm text-slate-300">{t("share.recap.loading")}</p> : null}
      {state === "error" ? <p className="mt-4 text-sm text-red-300">{error ?? t("share.recap.error")}</p> : null}
      {state === "empty" ? <p className="mt-4 text-sm text-slate-300">{t("share.recap.empty")}</p> : null}

      {state === "ready" && data ? (
        <div className="mt-5 rounded-2xl border border-[#2b5055] bg-gradient-to-br from-[#0a1f27] via-[#102736] to-[#182239] p-4 sm:p-6">
          <p className="text-xs text-slate-300">{data.timeWindow.label}</p>
          <p className="mt-3 text-sm text-slate-300">{t("share.recap.discoveryScore")}</p>
          <p className="text-4xl font-bold text-emerald-300">{data.discoveryScore}%</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-white">{t("share.recap.topArtists")}</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {topArtists.map((artist, idx) => (
                  <li key={artist.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{idx + 1}. {artist.name}</span>
                    <span className="text-xs text-slate-400">{artist.playCount}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">{t("share.recap.topTracks")}</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-200">
                {topTracks.map((track, idx) => (
                  <li key={track.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{idx + 1}. {track.name} — {track.artistName}</span>
                    <span className="text-xs text-slate-400">{track.playCount}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
