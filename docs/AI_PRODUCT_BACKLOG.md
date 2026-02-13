# Spotify-Insights — AI Product Backlog (PO → Tech Lead)

This backlog focuses on **business/product value** (retention, sharing, utility). It is designed to be executed by autonomous agents.

## Product goals

- Make insights **shareable** (growth loop)
- Increase **retention** (recaps, streaks)
- Deliver **direct value** (smart playlists, deep dives)
- Keep costs/complexity low (Raspberry Pi, local-first)

## Assumptions / constraints

- OAuth to Spotify requires a stable redirect URL; automated tests should use mocked data.
- UI copy should be **EN + ES**.
- Work happens on branch `IA` → PR → merge into `dev`. Never touch `main`.

---

## Roadmap (3 phases)

### Phase 1 — Core insights + shareability (highest leverage)

1) **Share Cards (Weekly Recap)**
2) **Taste Profile**
3) **Time Intelligence**

### Phase 2 — Retention + utility

4) **Goals & Streaks**
5) **Artist Deep Dive**

### Phase 3 — Power user + monetizable

6) **Smart Playlists**
7) **Compare Modes**
8) **Discovery Engine**
9) **Export / Data Ownership**
10) **Personality + Recommendations**

---

## Architecture baseline (Tech Lead)

### Data model (Prisma)

Use Spotify IDs as stable keys.

Recommended entities (incremental, add as needed):
- `User` (already)
- `SpotifyAccount` (tokens, scopes)
- `InsightSnapshot` (derived metrics + timestamps)
- `ShareCard` (stored metadata + generated image URL/path)
- `PlaylistRule` (for smart playlists)

### Background sync pattern

- `SyncJob` table to track last sync + status.
- API routes trigger sync if stale; later move to scheduled jobs.

### Share card generation

- Server-side image generation endpoint (no external services required).
- Store generated images under `public/share/` or object storage later.

### API conventions

- Normalize API responses:
  - Success: `{ ok: true, data }`
  - Error: `{ ok: false, error: { code, message } }`

---

## Next execution rule

Agents should pick the **next highest-impact, smallest-scope ticket** that:
- does not require Spotify API live calls in tests
- passes `lint`, `test`, and `build`
