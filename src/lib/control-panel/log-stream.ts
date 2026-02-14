import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

const DEFAULT_BOARD_PATH =
  process.env.CONTROL_PANEL_BOARD_PATH ??
  "/home/nacho/.openclaw/state/spotify-insights-board.json";

const MAX_TAIL = 500;
const DEFAULT_TAIL = 120;
const FOLLOW_DURATION_MS = 25_000;

type RuntimeBoard = {
  project?: string;
  repoPath?: string;
};

type LogStreamOptions = {
  projectId: string;
  tail?: number;
  follow?: boolean;
  environment?: string;
  service?: string;
  lastEventId?: string | null;
  boardPath?: string;
};

function normalizeProject(value: string | undefined): string {
  return (value ?? "spotify-insights").trim().toLowerCase();
}

function resolveComposeFile(repoPath: string, environment?: string): string {
  const explicit = process.env.CONTROL_PANEL_COMPOSE_FILE;
  if (explicit?.trim()) return explicit;

  if (environment?.toLowerCase() === "main") {
    return path.join(repoPath, "docker-compose.yml");
  }

  return path.join(repoPath, "docker-compose.dev.yml");
}

function sanitizeTail(value?: number): number {
  if (value === undefined || Number.isNaN(value)) return DEFAULT_TAIL;
  return Math.max(1, Math.min(MAX_TAIL, Math.floor(value)));
}

function parseSince(lastEventId?: string | null): string | null {
  if (!lastEventId) return null;
  const millis = Number(lastEventId);
  if (Number.isNaN(millis) || millis <= 0) return null;

  return new Date(millis).toISOString();
}

function redactSecrets(input: string): string {
  return input
    .replace(/(authorization:\s*bearer\s+)[a-z0-9._\-]+/gi, "$1<redacted>")
    .replace(/(bearer\s+)[a-z0-9._\-]+/gi, "$1<redacted>")
    .replace(/(gh[pousr]_[a-z0-9]{16,})/gi, "<redacted>")
    .replace(/((?:token|password|secret|apikey|api_key)\s*[=:]\s*)([^\s"']+)/gi, "$1<redacted>")
    .replace(/([?&](?:token|password|secret|apikey|api_key)=)([^&\s]+)/gi, "$1<redacted>");
}

async function readBoard(boardPath: string): Promise<RuntimeBoard> {
  const raw = await fs.readFile(boardPath, "utf8");
  return JSON.parse(raw) as RuntimeBoard;
}

function sseHeaders() {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  };
}

export async function createProjectLogStream(options: LogStreamOptions): Promise<Response> {
  const board = await readBoard(options.boardPath ?? DEFAULT_BOARD_PATH);
  const expectedProject = normalizeProject(board.project);

  if (normalizeProject(options.projectId) !== expectedProject) {
    return Response.json(
      {
        ok: false,
        error: `Project '${options.projectId}' is not configured`,
      },
      { status: 404 },
    );
  }

  if (!board.repoPath) {
    return Response.json(
      {
        ok: false,
        error: "Missing repoPath in board configuration",
      },
      { status: 500 },
    );
  }

  const tail = sanitizeTail(options.tail);
  const composeFile = resolveComposeFile(board.repoPath, options.environment);
  const since = parseSince(options.lastEventId);
  const follow = Boolean(options.follow);

  const args = ["compose", "-f", composeFile, "logs", "--no-color", "--tail", String(tail)];

  if (since) {
    args.push("--since", since);
  }

  if (follow) {
    args.push("--follow");
  }

  if (options.service?.trim()) {
    args.push(options.service.trim());
  }

  const logProcess = spawn("docker", args, {
    env: process.env,
  });

  const encoder = new TextEncoder();
  let eventCounter = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`id: ${eventCounter++}\nevent: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      send("meta", {
        ok: true,
        projectId: options.projectId,
        environment: options.environment ?? "dev",
        follow,
        tail,
      });

      logProcess.stdout.on("data", (chunk: Buffer) => {
        const lines = chunk
          .toString("utf8")
          .split("\n")
          .map((line) => line.trimEnd())
          .filter(Boolean);

        for (const line of lines) {
          send("log", {
            ts: new Date().toISOString(),
            line: redactSecrets(line),
          });
        }
      });

      logProcess.stderr.on("data", (chunk: Buffer) => {
        const message = redactSecrets(chunk.toString("utf8").trim());
        if (!message) return;
        send("warn", { message });
      });

      logProcess.on("close", (code) => {
        send("end", { code: code ?? 0 });
        controller.close();
      });

      logProcess.on("error", (error) => {
        send("error", { message: redactSecrets(error.message) });
        controller.close();
      });

      if (follow) {
        setTimeout(() => {
          if (!logProcess.killed) {
            logProcess.kill("SIGTERM");
          }
        }, FOLLOW_DURATION_MS);
      }
    },
    cancel() {
      if (!logProcess.killed) {
        logProcess.kill("SIGTERM");
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: sseHeaders(),
  });
}

export const __private__ = {
  redactSecrets,
  sanitizeTail,
  parseSince,
};
