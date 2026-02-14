"use client";

import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  timestamp?: string;
  version?: string;
};

export function DeployedBadge() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const j = (await r.json()) as Health;
        if (!alive) return;
        setHealth(j);
      } catch {
        if (!alive) return;
        setHealth(null);
      }
    }

    load();
    const t = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const ts = health?.timestamp ? new Date(health.timestamp) : null;
  const tsLabel = ts
    ? ts.toLocaleString(undefined, {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#1b3a40] bg-[#0b1820]/80 px-3 py-1 text-[11px] text-slate-200">
      <span
        className={`h-2 w-2 rounded-full ${health?.ok ? "bg-emerald-400" : "bg-amber-400"}`}
        aria-hidden
      />
      <span className="font-semibold">DEV</span>
      {health?.version ? (
        <span className="text-slate-300">v{health.version}</span>
      ) : null}
      {tsLabel ? (
        <span className="hidden sm:inline text-slate-400">{tsLabel}</span>
      ) : null}
    </div>
  );
}
