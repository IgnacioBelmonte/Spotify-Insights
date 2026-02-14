"use client";

import { useState } from "react";

type Health = "up" | "degraded" | "down" | "unknown";

type ProjectCardProps = {
  project: string;
  urls: string[];
  health: Health;
  healthLabel: string;
  tasksCount: number;
  activityCount: number;
  labels: {
    copy: string;
    copied: string;
    open: string;
    noUrls: string;
    tasks: string;
    activity: string;
  };
};

const healthClassByValue: Record<Health, string> = {
  up: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
  degraded: "border-amber-400/50 bg-amber-500/15 text-amber-100",
  down: "border-rose-400/50 bg-rose-500/15 text-rose-100",
  unknown: "border-slate-400/50 bg-slate-500/15 text-slate-100",
};

export function ProjectCard({
  project,
  urls,
  health,
  healthLabel,
  tasksCount,
  activityCount,
  labels,
}: ProjectCardProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1500);
    } catch {
      setCopiedUrl(null);
    }
  };

  return (
    <article className="rounded-2xl border border-[#24434f] bg-[#101c24] p-4 shadow-lg shadow-black/20">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold capitalize text-[#e2faf2]">{project.replace(/-/g, " ")}</h2>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${healthClassByValue[health]}`}>
          {healthLabel}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#284d58] bg-[#0d1820] p-2">
          <p className="text-xs text-[#9ebac3]">{labels.tasks}</p>
          <p className="text-base font-semibold text-[#dbf8f1]">{tasksCount}</p>
        </div>
        <div className="rounded-xl border border-[#284d58] bg-[#0d1820] p-2">
          <p className="text-xs text-[#9ebac3]">{labels.activity}</p>
          <p className="text-base font-semibold text-[#dbf8f1]">{activityCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        {urls.length ? (
          urls.map((url) => (
            <div key={url} className="rounded-xl border border-[#2a4953] bg-[#0c161d] p-2.5">
              <p className="mb-2 break-all text-xs text-[#bce9dd]">{url}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyUrl(url)}
                  className="rounded-lg border border-[#346273] bg-[#102b36] px-2.5 py-1.5 text-xs font-medium text-[#e6fcf6] transition hover:bg-[#143747]"
                >
                  {copiedUrl === url ? labels.copied : labels.copy}
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[#346273] bg-[#102b36] px-2.5 py-1.5 text-xs font-medium text-[#e6fcf6] transition hover:bg-[#143747]"
                >
                  {labels.open}
                </a>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[#34505a] p-3 text-xs text-[#a8c5cd]">{labels.noUrls}</p>
        )}
      </div>
    </article>
  );
}
