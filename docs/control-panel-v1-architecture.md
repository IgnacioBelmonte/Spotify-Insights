# Control Panel v1 — Technical Design (Multi-Project Ops Console)

## 1) Context & Goals

Control Panel v1 extends the current Code IA Dashboard into a **multi-project operations console** that can:
- Manage multiple project boards from one UI.
- Track backlog / in-progress / done with project and role context.
- Stream task execution logs in near-real-time.
- Trigger safe project power actions (start/stop/restart).

### In scope
- Board schema v1 (JSON-first, DB-ready shape).
- Internal API design for boards, logs, and power controls.
- Security model (local LAN + optional tunnel).
- Rollout plan for Raspberry Pi-first deployment.

### Out of scope (v1)
- Full RBAC with SSO providers.
- Distributed multi-node orchestration.
- Historical analytics dashboards beyond recent runs.

---

## 2) Proposed Architecture

### Runtime model
- **Next.js App Router** app as Control Panel frontend + backend API.
- **State source (v1):** JSON files per project under `.openclaw/state/`.
- **Adapters:** thin service layer to abstract board store, process control, log streaming.
- **Execution:** existing OpenClaw cron/session agents remain the worker runtime.

### Core components
- `src/lib/control-panel/boardStore.ts`
  - Read/write board JSON atomically (temp file + rename).
- `src/lib/control-panel/projects.ts`
  - Project registry (id, name, repoPath, runtime URLs, service name).
- `src/lib/control-panel/logStream.ts`
  - Tail + SSE fanout for task logs.
- `src/lib/control-panel/power.ts`
  - Safe wrappers for start/stop/restart via allowlisted commands.
- API routes
  - `/api/control-panel/projects`
  - `/api/control-panel/projects/:projectId/board`
  - `/api/control-panel/projects/:projectId/logs/stream`
  - `/api/control-panel/projects/:projectId/power`

---

## 3) Data Model (Board Schema v1)

```json
{
  "project": "spotify-insights",
  "repoPath": "/home/nacho/.openclaw/workspace/Spotify-Insights",
  "branches": { "work": "dev", "integration": "dev", "protected": "main" },
  "policy": {
    "directToDev": true,
    "maxInProgressPerRole": 1,
    "roles": ["techlead", "backend", "frontend", "qa"]
  },
  "queue": {
    "backlog": [{ "ticketId": "T4a", "role": "backend", "title": "...", "status": "backlog" }],
    "inProgress": [],
    "done": []
  },
  "meta": { "createdAt": "...", "updatedAt": "..." }
}
```

### Required task fields
- `ticketId`, `role`, `title`, `status`, `createdAt`, `updatedAt`

### Optional fields
- `project`, `agent`, `description`, `startedAt`, `completedAt`, `notes`, `blocker`, `commitSha`, `checks`, `deployedHealth`

### Migration path
- v1 keeps JSON; v2 can map to Prisma models with minimal shape change (`Project`, `Ticket`, `TicketEvent`).

---

## 4) API Design

## `GET /api/control-panel/projects`
Returns project registry + summary counts.

```json
{
  "ok": true,
  "data": [{ "projectId": "spotify-insights", "name": "Spotify Insights", "counts": { "backlog": 2, "inProgress": 1, "done": 10 } }]
}
```

## `GET /api/control-panel/projects/:projectId/board`
Returns full board JSON + ETag.

## `PATCH /api/control-panel/projects/:projectId/board`
Applies validated board mutation (move ticket, update status, append note). Uses optimistic concurrency (`If-Match` ETag).

## `GET /api/control-panel/projects/:projectId/logs/stream`
SSE stream for runtime/task logs.
Events: `log`, `status`, `heartbeat`, `end`.

## `POST /api/control-panel/projects/:projectId/power`
Body:
```json
{ "action": "start|stop|restart", "scope": "app|worker" }
```
- Mapped to allowlisted commands only.
- Response includes command id + last known status.

---

## 5) Log Streaming Approach

- Prefer **SSE** over WebSockets for lower complexity and Pi friendliness.
- `logStream` adapter reads from:
  - rolling file (e.g., `.openclaw/logs/<project>.log`) or
  - process manager output (docker compose logs/systemd journal wrapper).
- Backpressure controls:
  - max lines per event batch.
  - heartbeat every 10s.
  - reconnect with `Last-Event-ID` support.

---

## 6) Security & Permissions

- Internal APIs protected by shared secret header in v1 (`X-Control-Panel-Token`) + same-origin checks.
- Power endpoints require stricter guard:
  - allowlist command map (no arbitrary shell).
  - explicit project ownership validation.
  - audit log entry for each action.
- Never expose secrets in board payload or logs.
- Rate limit mutating endpoints (`PATCH`, `POST power`).

---

## 7) Start/Stop Integration (Docker/systemd)

Project registry includes `runtime.kind` and service identifiers:
- Docker: `{ kind: "docker", composeFile, serviceName }`
- Systemd: `{ kind: "systemd", unit }`

`power.ts` resolves to allowlisted commands:
- Docker:
  - `docker compose -f <composeFile> up -d <serviceName>`
  - `docker compose -f <composeFile> stop <serviceName>`
  - `docker compose -f <composeFile> restart <serviceName>`
- Systemd:
  - `systemctl start|stop|restart <unit>`

All command executions capture stdout/stderr tail and return sanitized status.

---

## 8) Testing Strategy

- Unit tests
  - board schema validation and mutation rules.
  - power command mapper allowlist behavior.
  - SSE event formatter and reconnect logic.
- Integration tests (mocked process layer)
  - board read/patch with ETag conflict handling.
  - power endpoint auth + action lifecycle.
- No live external APIs required.

---

## 9) Observability Hooks

- Structured logs with `projectId`, `ticketId`, `action`, `durationMs`, `result`.
- Health route for Control Panel API dependencies.
- Optional lightweight metrics counters (request count, mutation failures, power action failures).

---

## 10) Execution Plan

## M1 — Board & Project Foundations

### backend — CP-BE-1: Board store + schema validator (M)
- **DoD:** Typed schema, atomic write, migration-aware parser, unit tests.
- **Files:** `src/lib/control-panel/boardStore.ts`, `src/lib/control-panel/schema.ts`, tests.
- **Deps:** none.

### backend — CP-BE-2: Project registry + summary endpoint (S)
- **DoD:** `GET /projects` returns registry + queue counts.
- **Files:** `src/lib/control-panel/projects.ts`, `src/app/api/control-panel/projects/route.ts`.
- **Deps:** CP-BE-1.

### frontend — CP-FE-1: Multi-project board switcher shell (M)
- **DoD:** Sidebar/project picker + summary chips; responsive mobile drawer.
- **Files:** `src/app/control-panel/page.tsx`, `src/components/control-panel/ProjectSwitcher.tsx`.
- **Deps:** CP-BE-2.

## M2 — Board Mutations & Live Logs

### backend — CP-BE-3: Board read/patch endpoints with ETag (M)
- **DoD:** GET + PATCH with optimistic concurrency and validation errors.
- **Files:** `src/app/api/control-panel/projects/[projectId]/board/route.ts`.
- **Deps:** CP-BE-1.

### backend — CP-BE-4: SSE logs endpoint + adapter (M)
- **DoD:** stable SSE stream with reconnect, heartbeat, graceful close.
- **Files:** `src/lib/control-panel/logStream.ts`, `.../logs/stream/route.ts`.
- **Deps:** CP-BE-2.

### frontend — CP-FE-2: Board lanes + ticket action controls (M)
- **DoD:** backlog/in-progress/done rendering, move/update actions, optimistic UI.
- **Files:** `src/components/control-panel/BoardLanes.tsx`, hooks.
- **Deps:** CP-BE-3.

### frontend — CP-FE-3: Live log viewer (S/M)
- **DoD:** SSE subscriber with reconnect state, compact log console, pause/autoscroll.
- **Files:** `src/components/control-panel/LogViewer.tsx`.
- **Deps:** CP-BE-4.

## M3 — Power Controls, Hardening, QA

### backend — CP-BE-5: Power endpoint + allowlisted command runner (M)
- **DoD:** start/stop/restart for configured projects; audit events stored.
- **Files:** `src/lib/control-panel/power.ts`, `.../power/route.ts`.
- **Deps:** CP-BE-2.

### frontend — CP-FE-4: Power controls UX (S)
- **DoD:** start/stop/restart buttons with confirmation and status feedback.
- **Files:** `src/components/control-panel/PowerControls.tsx`.
- **Deps:** CP-BE-5.

### qa — CP-QA-1: End-to-end smoke pack (M)
- **DoD:** test checklist for board ops, log stream resilience, power safety, mobile layout.
- **Files:** `docs/qa/control-panel-smoke.md`, automated tests where feasible.
- **Deps:** M1–M3.

---

## 11) Key Risks & Mitigations

- **Risk:** Corrupted JSON board under concurrent writes.
  - **Mitigation:** ETag + atomic writes + schema validation on every mutation.
- **Risk:** Power action abuse.
  - **Mitigation:** token auth + allowlist + audit logs + rate limit.
- **Risk:** Pi resource pressure with log streaming.
  - **Mitigation:** SSE batching, capped history window, lightweight UI rendering.

This design keeps v1 practical on Raspberry Pi while leaving a clean migration path to DB-backed control-plane state in v2.
