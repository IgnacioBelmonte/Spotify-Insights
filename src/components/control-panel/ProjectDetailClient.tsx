"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { BoardQueueStatus, ProjectTicket } from "@/src/lib/control-panel/projects-registry";

type RuntimeState = {
  ok: boolean;
  data?: {
    containerState?: string;
    lastAction?: {
      action: string;
      performedAt: string;
      success: boolean;
    } | null;
    error?: string | null;
  };
  error?: string;
};

type Labels = {
  back: string;
  subtitle: string;
  urlPanel: string;
  noUrls: string;
  copy: string;
  copied: string;
  open: string;
  runtime: string;
  status: string;
  runtimeUnknown: string;
  lastAction: string;
  start: string;
  stop: string;
  restart: string;
  runningAction: string;
  tasksTitle: string;
  logsTitle: string;
  logsHint: string;
  logsEmpty: string;
  loadError: string;
  queueLabels: Record<BoardQueueStatus, string>;
};

type Props = {
  projectId: string;
  projectName: string;
  urls: string[];
  initialTickets: ProjectTicket[];
  labels: Labels;
};

const QUEUES: BoardQueueStatus[] = ["backlog", "inProgress", "done"];

export function ProjectDetailClient({ projectId, projectName, urls, initialTickets, labels }: Props) {
  const [tickets, setTickets] = useState<ProjectTicket[]>(initialTickets);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logError, setLogError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return {
      backlog: tickets.filter((ticket) => ticket.status === "backlog"),
      inProgress: tickets.filter((ticket) => ticket.status === "inProgress"),
      done: tickets.filter((ticket) => ticket.status === "done"),
    };
  }, [tickets]);

  const fetchRegistry = async () => {
    const response = await fetch("/api/control-panel/projects", { cache: "no-store" });
    const payload = (await response.json()) as {
      ok: boolean;
      tickets?: ProjectTicket[];
    };

    if (!response.ok || !payload.ok || !payload.tickets) {
      throw new Error(labels.loadError);
    }

    setTickets(payload.tickets.filter((ticket) => ticket.project === projectId));
  };

  const fetchRuntime = async () => {
    const response = await fetch(`/api/control-panel/projects/${projectId}/runtime`, { cache: "no-store" });
    const payload = (await response.json()) as RuntimeState;
    setRuntime(payload);
  };

  useEffect(() => {
    void fetchRuntime().catch(() => {
      setRuntime({ ok: false, error: labels.loadError });
    });

    void fetchRegistry().catch(() => {
      setRuntimeError(labels.loadError);
    });

    const eventSource = new EventSource(`/api/control-panel/projects/${projectId}/logs?tail=120&follow=true&env=dev`);

    eventSource.addEventListener("log", (event) => {
      const data = JSON.parse(event.data) as { line?: string };
      if (!data.line) return;
      setLogLines((prev) => [...prev.slice(-199), data.line]);
    });

    eventSource.addEventListener("error", () => {
      setLogError(labels.loadError);
    });

    return () => {
      eventSource.close();
    };
  }, [projectId, labels.loadError]);

  const runAction = async (action: "start" | "stop" | "restart") => {
    setRuntimeBusy(true);
    setRuntimeError(null);

    try {
      const response = await fetch(`/api/control-panel/projects/${projectId}/runtime`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const payload = (await response.json()) as RuntimeState;
      setRuntime(payload);

      if (!response.ok || !payload.ok) {
        const errorText = payload.data?.error ?? payload.error ?? labels.loadError;
        setRuntimeError(errorText);
      }

      await fetchRegistry().catch(() => undefined);
    } catch {
      setRuntimeError(labels.loadError);
    } finally {
      setRuntimeBusy(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl((current) => (current === url ? null : current)), 1500);
    } catch {
      setCopiedUrl(null);
    }
  };

  const runtimeStateLabel = runtime?.data?.containerState ?? labels.runtimeUnknown;
  const lastAction = runtime?.data?.lastAction;

  return (
    <main className="min-h-screen bg-[#081117] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <Link href="/control-panel" className="inline-flex text-sm text-[#9ac6d2] hover:text-white">
          ← {labels.back}
        </Link>

        <header className="rounded-2xl border border-[#24434f] bg-[#101c24] p-4">
          <h1 className="text-2xl font-bold capitalize text-[#edfff9]">{projectName}</h1>
          <p className="text-sm text-[#9ebac3]">{labels.subtitle}</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.1fr,1fr]">
          <div className="space-y-4">
            <article className="rounded-2xl border border-[#24434f] bg-[#101c24] p-4">
              <h2 className="mb-3 text-base font-semibold text-[#e2faf2]">{labels.urlPanel}</h2>
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

            <article className="rounded-2xl border border-[#24434f] bg-[#101c24] p-4">
              <h2 className="mb-3 text-base font-semibold text-[#e2faf2]">{labels.runtime}</h2>
              <p className="text-sm text-[#a6d8d7]">
                {labels.status}: <span className="font-semibold">{runtimeStateLabel}</span>
              </p>
              {lastAction ? (
                <p className="mt-1 text-xs text-[#9ebac3]">
                  {labels.lastAction}: {lastAction.action} · {new Date(lastAction.performedAt).toLocaleString()}
                </p>
              ) : null}
              {runtimeError ? <p className="mt-2 text-xs text-rose-300">{runtimeError}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runAction("start")}
                  disabled={runtimeBusy}
                  className="rounded-lg border border-[#346273] bg-[#11394a] px-3 py-1.5 text-xs font-medium text-[#e6fcf6] disabled:opacity-50"
                >
                  {runtimeBusy ? labels.runningAction : labels.start}
                </button>
                <button
                  type="button"
                  onClick={() => runAction("stop")}
                  disabled={runtimeBusy}
                  className="rounded-lg border border-[#6b3a42] bg-[#3a1f26] px-3 py-1.5 text-xs font-medium text-[#ffe8eb] disabled:opacity-50"
                >
                  {runtimeBusy ? labels.runningAction : labels.stop}
                </button>
                <button
                  type="button"
                  onClick={() => runAction("restart")}
                  disabled={runtimeBusy}
                  className="rounded-lg border border-[#5a5380] bg-[#2e2a4d] px-3 py-1.5 text-xs font-medium text-[#ece8ff] disabled:opacity-50"
                >
                  {runtimeBusy ? labels.runningAction : labels.restart}
                </button>
              </div>
            </article>
          </div>

          <article className="rounded-2xl border border-[#24434f] bg-[#101c24] p-4">
            <h2 className="mb-2 text-base font-semibold text-[#e2faf2]">{labels.logsTitle}</h2>
            <p className="mb-3 text-xs text-[#9ebac3]">{labels.logsHint}</p>
            {logError ? <p className="mb-2 text-xs text-rose-300">{logError}</p> : null}
            <pre className="h-[480px] overflow-auto rounded-xl border border-[#223843] bg-[#071015] p-3 text-xs leading-relaxed text-[#b9e3db]">
              {logLines.length ? logLines.join("\n") : labels.logsEmpty}
            </pre>
          </article>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-[#e2faf2]">{labels.tasksTitle}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {QUEUES.map((queue) => (
              <article key={queue} className="rounded-2xl border border-[#24434f] bg-[#101c24] p-3">
                <h3 className="mb-2 text-sm font-semibold text-[#d7f7ef]">{labels.queueLabels[queue]}</h3>
                <ul className="space-y-2 text-xs text-[#b8d8d9]">
                  {grouped[queue].length ? (
                    grouped[queue].map((ticket) => (
                      <li key={ticket.ticketId} className="rounded-lg border border-[#2a4953] bg-[#0d1820] p-2">
                        <p className="font-semibold text-[#e6fcf6]">{ticket.ticketId}</p>
                        <p>{ticket.title}</p>
                        <p className="text-[#90b5bd]">{ticket.role}</p>
                      </li>
                    ))
                  ) : (
                    <li className="rounded-lg border border-dashed border-[#34505a] p-2 text-[#90b5bd]">—</li>
                  )}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
