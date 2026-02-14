import { promises as fs } from "fs";

export type BoardQueueStatus = "backlog" | "inProgress" | "done";

type RawBoardItem = {
  ticketId: string;
  title?: string;
  role?: string;
  status?: string;
  project?: string;
  agent?: string;
  description?: string;
};

type RawBoard = {
  project?: string;
  queue?: {
    backlog?: RawBoardItem[];
    inProgress?: RawBoardItem[];
    done?: RawBoardItem[];
  };
  runtime?: Record<string, Record<string, unknown>>;
};

export type ProjectTicket = {
  ticketId: string;
  title: string;
  role: string;
  status: BoardQueueStatus;
  project: string;
  agent: string;
  description: string;
};

export type ProjectSummary = {
  project: string;
  counts: Record<BoardQueueStatus, number>;
  total: number;
  urls: string[];
  health: "unknown";
};

const DEFAULT_BOARD_PATH =
  process.env.CONTROL_PANEL_BOARD_PATH ??
  "/home/nacho/.openclaw/state/spotify-insights-board.json";

function normalizeProjectTag(value: string | undefined, fallback: string): string {
  if (!value || !value.trim()) return fallback;
  return value.trim().toLowerCase();
}

function normalizeDescription(item: RawBoardItem): string {
  if (item.description && item.description.trim()) return item.description.trim();
  return `Implement ticket ${item.ticketId} (${item.title ?? "Untitled"})`;
}

function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function extractProjectUrls(runtime: RawBoard["runtime"]): Record<string, string[]> {
  const urlsByProject: Record<string, string[]> = {};

  if (!runtime) return urlsByProject;

  for (const [envName, envData] of Object.entries(runtime)) {
    const possibleUrls: string[] = [];

    for (const [key, value] of Object.entries(envData)) {
      if (typeof value !== "string") continue;
      if (!key.toLowerCase().includes("url")) continue;
      const safe = sanitizeUrl(value);
      if (!safe) continue;
      possibleUrls.push(safe);
    }

    if (!possibleUrls.length) continue;

    const projectKey = envName === "main" || envName === "dev" ? "spotify-insights" : envName;
    urlsByProject[projectKey] = Array.from(new Set([...(urlsByProject[projectKey] ?? []), ...possibleUrls]));
  }

  return urlsByProject;
}

function normalizeTicket(
  item: RawBoardItem,
  status: BoardQueueStatus,
  fallbackProject: string,
): ProjectTicket {
  const project = normalizeProjectTag(item.project, fallbackProject);
  const role = item.role?.trim() || "unassigned";

  return {
    ticketId: item.ticketId,
    title: item.title?.trim() || item.ticketId,
    role,
    status,
    project,
    agent: item.agent?.trim() || role,
    description: normalizeDescription(item),
  };
}

function buildSummaries(tickets: ProjectTicket[], runtime?: RawBoard["runtime"]): ProjectSummary[] {
  const urlsByProject = extractProjectUrls(runtime);
  const summaries = new Map<string, ProjectSummary>();

  for (const ticket of tickets) {
    const current = summaries.get(ticket.project) ?? {
      project: ticket.project,
      counts: { backlog: 0, inProgress: 0, done: 0 },
      total: 0,
      urls: urlsByProject[ticket.project] ?? [],
      health: "unknown" as const,
    };

    current.counts[ticket.status] += 1;
    current.total += 1;
    if (!current.urls.length && urlsByProject[ticket.project]?.length) {
      current.urls = urlsByProject[ticket.project];
    }

    summaries.set(ticket.project, current);
  }

  for (const [project, urls] of Object.entries(urlsByProject)) {
    if (summaries.has(project)) continue;

    summaries.set(project, {
      project,
      counts: { backlog: 0, inProgress: 0, done: 0 },
      total: 0,
      urls,
      health: "unknown",
    });
  }

  return Array.from(summaries.values()).sort((a, b) => a.project.localeCompare(b.project));
}

export async function readProjectRegistry(boardPath = DEFAULT_BOARD_PATH): Promise<{
  projects: ProjectSummary[];
  tickets: ProjectTicket[];
}> {
  const file = await fs.readFile(boardPath, "utf8");
  const board = JSON.parse(file) as RawBoard;

  const fallbackProject = normalizeProjectTag(board.project, "spotify-insights");

  const backlog = board.queue?.backlog ?? [];
  const inProgress = board.queue?.inProgress ?? [];
  const done = board.queue?.done ?? [];

  const tickets: ProjectTicket[] = [
    ...backlog.map((item) => normalizeTicket(item, "backlog", fallbackProject)),
    ...inProgress.map((item) => normalizeTicket(item, "inProgress", fallbackProject)),
    ...done.map((item) => normalizeTicket(item, "done", fallbackProject)),
  ];

  return {
    tickets,
    projects: buildSummaries(tickets, board.runtime),
  };
}
