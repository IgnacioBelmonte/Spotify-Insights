import { promises as fs } from "fs";
import path from "path";
import { execFile as execFileCallback } from "child_process";
import { promisify } from "util";

const execFile = promisify(execFileCallback);

const DEFAULT_BOARD_PATH =
  process.env.CONTROL_PANEL_BOARD_PATH ??
  "/home/nacho/.openclaw/state/spotify-insights-board.json";

const DEFAULT_RUNTIME_ACTIONS_PATH =
  process.env.CONTROL_PANEL_RUNTIME_ACTIONS_PATH ??
  "/home/nacho/.openclaw/state/control-panel-runtime-actions.json";

const SUPPORTED_ACTIONS = ["start", "stop", "restart", "status"] as const;

type RuntimeAction = (typeof SUPPORTED_ACTIONS)[number];

type RuntimeBoard = {
  project?: string;
  repoPath?: string;
};

type LastActionState = {
  action: RuntimeAction;
  performedAt: string;
  success: boolean;
};

type RuntimeActionsStore = Record<string, LastActionState>;

export type RuntimeControlResult = {
  ok: boolean;
  projectId: string;
  action: RuntimeAction;
  command: string[];
  durationMs: number;
  containerState: "running" | "stopped" | "degraded" | "unknown";
  services: Array<{
    service: string;
    state: string;
    health: string | null;
  }>;
  lastAction: LastActionState | null;
  error: string | null;
};

async function readBoard(boardPath: string): Promise<RuntimeBoard> {
  const content = await fs.readFile(boardPath, "utf8");
  return JSON.parse(content) as RuntimeBoard;
}

function resolveComposeFile(repoPath: string): string {
  const explicit = process.env.CONTROL_PANEL_COMPOSE_FILE;
  if (explicit?.trim()) return explicit;
  return path.join(repoPath, "docker-compose.dev.yml");
}

async function ensureFile(pathname: string, fallback: string): Promise<void> {
  try {
    await fs.access(pathname);
  } catch {
    await fs.mkdir(path.dirname(pathname), { recursive: true });
    await fs.writeFile(pathname, fallback, "utf8");
  }
}

async function readLastActions(): Promise<RuntimeActionsStore> {
  await ensureFile(DEFAULT_RUNTIME_ACTIONS_PATH, "{}");
  const raw = await fs.readFile(DEFAULT_RUNTIME_ACTIONS_PATH, "utf8");
  return JSON.parse(raw) as RuntimeActionsStore;
}

async function writeLastAction(projectId: string, entry: LastActionState): Promise<void> {
  const store = await readLastActions();
  store[projectId] = entry;
  await fs.writeFile(DEFAULT_RUNTIME_ACTIONS_PATH, JSON.stringify(store, null, 2) + "\n", "utf8");
}

function parseComposePs(stdout: string): Array<{ service: string; state: string; health: string | null }> {
  if (!stdout.trim()) return [];

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const service = String(parsed.Service ?? parsed.Name ?? "unknown");
        const state = String(parsed.State ?? parsed.Status ?? "unknown").toLowerCase();
        const healthRaw = parsed.Health;
        const health = typeof healthRaw === "string" && healthRaw ? healthRaw : null;

        return [{ service, state, health }];
      } catch {
        return [];
      }
    });
}

function deriveContainerState(services: Array<{ state: string; health: string | null }>): RuntimeControlResult["containerState"] {
  if (!services.length) return "unknown";

  const hasRunning = services.some((service) => service.state.includes("running"));
  const hasStopped = services.some((service) => service.state.includes("exited") || service.state.includes("stopped"));
  const hasUnhealthy = services.some((service) => service.health?.toLowerCase() === "unhealthy");

  if (hasUnhealthy) return "degraded";
  if (hasRunning && !hasStopped) return "running";
  if (!hasRunning && hasStopped) return "stopped";
  if (hasRunning && hasStopped) return "degraded";

  return "unknown";
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown command failure";
  return message.replace(/(token|password|secret)=\S+/gi, "$1=<redacted>");
}

function composeCommand(composeFile: string, action: RuntimeAction): string[] {
  const base = ["compose", "-f", composeFile];

  switch (action) {
    case "start":
      return ["docker", ...base, "up", "-d"];
    case "stop":
      return ["docker", ...base, "stop"];
    case "restart":
      return ["docker", ...base, "restart"];
    case "status":
      return ["docker", ...base, "ps", "--format", "json"];
    default:
      return ["docker", ...base, "ps", "--format", "json"];
  }
}

async function runCommand(command: string[]): Promise<{ stdout: string; stderr: string }> {
  const [bin, ...args] = command;
  return execFile(bin, args, { env: process.env, maxBuffer: 1024 * 1024 });
}

export function isSupportedRuntimeAction(action: string): action is RuntimeAction {
  return SUPPORTED_ACTIONS.includes(action as RuntimeAction);
}

export async function runRuntimeAction(
  projectId: string,
  action: RuntimeAction,
  options?: {
    boardPath?: string;
  },
): Promise<RuntimeControlResult> {
  const startedAt = Date.now();
  const boardPath = options?.boardPath ?? DEFAULT_BOARD_PATH;

  const board = await readBoard(boardPath);
  const normalizedBoardProject = String(board.project ?? "spotify-insights").toLowerCase();

  if (projectId.toLowerCase() !== normalizedBoardProject) {
    return {
      ok: false,
      projectId,
      action,
      command: [],
      durationMs: Date.now() - startedAt,
      containerState: "unknown",
      services: [],
      lastAction: null,
      error: `Project '${projectId}' is not configured`,
    };
  }

  const repoPath = board.repoPath;
  if (!repoPath) {
    return {
      ok: false,
      projectId,
      action,
      command: [],
      durationMs: Date.now() - startedAt,
      containerState: "unknown",
      services: [],
      lastAction: null,
      error: "Missing repoPath in board configuration",
    };
  }

  const composeFile = resolveComposeFile(repoPath);
  const command = composeCommand(composeFile, action);
  let error: string | null = null;

  try {
    await runCommand(command);
  } catch (commandError) {
    error = sanitizeError(commandError);
  }

  let services: RuntimeControlResult["services"] = [];

  try {
    const statusCommand = composeCommand(composeFile, "status");
    const status = await runCommand(statusCommand);
    services = parseComposePs(status.stdout);
  } catch (statusError) {
    if (!error) {
      error = sanitizeError(statusError);
    }
  }

  const entry: LastActionState = {
    action,
    performedAt: new Date().toISOString(),
    success: error === null,
  };

  if (action !== "status") {
    await writeLastAction(projectId, entry);
  }

  const lastActionStore = await readLastActions();

  return {
    ok: error === null,
    projectId,
    action,
    command,
    durationMs: Date.now() - startedAt,
    containerState: deriveContainerState(services),
    services,
    lastAction: lastActionStore[projectId] ?? null,
    error,
  };
}
