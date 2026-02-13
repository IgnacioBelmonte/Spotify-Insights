# Spotify-Insights — AI Tickets (Ready for Frontend/Backend)

Each ticket is sized for ~1–2 focused sessions.

Legend:
- **Owner**: `frontend` | `backend`
- **Size**: S | M | L

---

## T1 — Share Cards (Weekly Recap) — MVP

**Owner:** frontend + backend (split)

### T1a (backend, M): Share card data endpoint
- **Goal:** Provide a stable JSON payload for a weekly recap card.
- **API:** `GET /api/share/weekly-recap`
- **Data:** top artists (5), top tracks (5), discovery score, time window.
- **Acceptance criteria:**
  - returns `{ ok: true, data }`
  - mocked implementation allowed initially (feature flag / dev mode)
  - unit test with mocked data

### T1b (frontend, M): Share card UI + download
- **Goal:** Render weekly recap card and let user download as PNG.
- **UI:** new section on `/dashboard` or `/share`.
- **Copy:** EN+ES.
- **Acceptance criteria:**
  - card looks good on mobile
  - download works
  - loading/empty/error states

### T1c (backend, M): Server-side PNG generation (optional)
- **Goal:** Generate image server-side for consistency.
- **API:** `GET /api/share/weekly-recap.png`
- **Acceptance criteria:** returns `image/png` and uses same data contract as T1a.

---

## T2 — Taste Profile (Your Music DNA)

### T2a (backend, M): Compute taste profile snapshot
- **Goal:** Produce derived metrics: genres, decades, energy/valence averages.
- **API:** `GET /api/insights/taste-profile`
- **Acceptance criteria:** cached snapshot; stable schema; tests.

### T2b (frontend, M): Taste profile page/section
- **Goal:** Visualize profile + change over time (simple first: current snapshot only).
- **Acceptance criteria:** responsive charts, EN+ES labels.

---

## T3 — Time Intelligence (When you listen)

### T3a (backend, S/M): Aggregation endpoint
- **API:** `GET /api/insights/time-intelligence`
- **Data:** heatmap buckets (weekday x hour) + simple narrative.

### T3b (frontend, M): Heatmap component
- **Goal:** Show heatmap and “most active time” text.

---

## T4 — Goals & Streaks

### T4a (backend, M): Goals model + progress API
- **DB:** `Goal` table + `GoalProgress` or computed.
- **API:** `GET/POST /api/goals`

### T4b (frontend, M): Goals UI
- **Goal:** Create/view goal; show streak.

---

## T5 — Artist Deep Dive

### T5a (backend, M): Artist detail insight
- **API:** `GET /api/artist/:spotifyArtistId/insights`

### T5b (frontend, M): Artist page
- **UI:** charts + top tracks + trends.

---

## T6 — Smart Playlists

### T6a (backend, L): Playlist rules + dry-run preview
- **API:** `POST /api/playlists/rules` (create)
- **API:** `GET /api/playlists/rules/:id/preview`

### T6b (backend, L): Apply rule to Spotify playlist (later)
- Requires Spotify write scopes; keep behind explicit toggle.

### T6c (frontend, M): Rules UI

---

## T7 — Compare Modes

### T7a (backend, M): period comparison endpoint
- **API:** `GET /api/compare?from=...&to=...`

### T7b (frontend, M): compare UI

---

## T8 — Discovery Engine

### T8a (backend, M): discovery metrics endpoint
- **Metrics:** new artists %, repeats %, top new artists.

### T8b (frontend, S/M): Discovery widget

---

## T9 — Export / Data Ownership

### T9a (backend, S/M): export endpoint
- **API:** `GET /api/export?format=json|csv`

### T9b (frontend, S): export UI

---

## T10 — Personality + Recommendations

### T10a (backend, M): classify user into archetype
- Simple rules-based classification.

### T10b (frontend, S/M): personality card + recommended actions
