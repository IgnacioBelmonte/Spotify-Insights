"use client";

import { useEffect, useMemo, useState } from "react";

type SyncWidgetVariant = "hero" | "compact";

type SyncWidgetProps = {
  initialLastSyncedAt?: string | null;
  onSynced?: () => Promise<void> | void;
  title?: string;
  description?: string;
  variant?: SyncWidgetVariant;
  className?: string;
};

export function SyncWidget({
  initialLastSyncedAt = null,
  onSynced,
  title,
  description,
  variant = "hero",
  className = "",
}: SyncWidgetProps) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(initialLastSyncedAt);
  const timeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);

  useEffect(() => {
    setLastSyncedAt(initialLastSyncedAt ?? null);
  }, [initialLastSyncedAt]);

  const lastSyncedLabel = (() => {
    if (!lastSyncedAt) return "Aun no sincronizado";
    const syncedDate = new Date(lastSyncedAt);
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(syncedDate);
    } catch {
      return syncedDate.toLocaleString();
    }
  })();

  const isHero = variant === "hero";
  const resolvedTitle =
    title ?? (isHero ? "Sincronizacion inteligente" : "Quick Sync");
  const resolvedDescription =
    description ??
    (isHero
      ? "Actualiza tus reproducciones recientes para mantener el dashboard al dia."
      : "Trae tus ultimas reproducciones y manten el historial al dia.");

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/recently-played", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? "No se pudo sincronizar.");
        return;
      }

      if (json?.syncedAt) {
        setLastSyncedAt(json.syncedAt);
      }

      if (onSynced) {
        try {
          await onSynced();
        } catch (err) {
          setError(
            err instanceof Error
              ? `Sincronizacion completada, pero no se pudo refrescar el dashboard: ${err.message}`
              : "Sincronizacion completada, pero no se pudo refrescar el dashboard."
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div
      className={`relative overflow-hidden border border-[#1b3a40] bg-[#0f1b24]/85 shadow-2xl shadow-emerald-500/10 ${
        isHero ? "rounded-3xl p-6" : "rounded-2xl p-5"
      } ${className}`}
    >
      <div className="absolute -inset-6 rounded-full bg-emerald-400/10 blur-2xl" />
      <div className="relative space-y-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200">
            Sync
          </div>
          <h2 className={isHero ? "text-xl font-semibold" : "text-lg font-semibold"}>
            {resolvedTitle}
          </h2>
          <p className="text-sm text-slate-300">{resolvedDescription}</p>
        </div>

        <div className={`grid ${isHero ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"} gap-3`}>
          <div className="rounded-2xl border border-[#1b3a40] bg-[#0b1820]/80 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Ultima vez</p>
            <p className="text-sm text-slate-200 mt-1">{lastSyncedLabel}</p>
          </div>
          <div className="rounded-2xl border border-[#1b3a40] bg-[#0b1820]/80 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Zona horaria</p>
            <p className="text-sm text-slate-200 mt-1">{timeZone}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#14f1b2] hover:bg-[#5bf2c6] text-[#04221d] font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {syncing ? "Actualizando..." : "Sincronizar ahora"}
          </button>
          <span className="text-xs text-slate-400">
            Trae tus ultimas 50 reproducciones.
          </span>
        </div>

        {error ? (
          <div className="text-sm text-red-200 bg-red-950/40 border border-red-800 rounded-2xl px-4 py-3">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
