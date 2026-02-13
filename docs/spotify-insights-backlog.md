# Spotify Insights Technical Backlog (Non-deprecated API Focus)

## Goal
Maximize user-facing insights using Spotify endpoints and fields that are not deprecated as of 2026-02.

## Workstreams
- [x] W1. Expand sync payload for richer, stable metadata
- [x] W2. Build Spotify live insights aggregation service
- [x] W3. Extend overview API contract and fault isolation
- [x] W4. Implement dashboard UX modules for the new insights
- [x] W5. Harden auth scopes and player diagnostics
- [ ] W6. Tests, lint, and regression checks

## W1. Expand sync payload for richer metadata
- [x] Persist playback context (`contextType`, `contextUri`) on `ListeningEvent`
- [x] Persist track profile metadata (`explicit`, `albumType`, `albumReleaseDate`, `albumReleaseDatePrecision`)
- [x] Keep backward-compatible upsert behavior

## W2. Spotify live insights modules
- [x] Top trends windows (`short_term`, `medium_term`, `long_term`) with rank movement
- [x] Discovery vs repetition KPIs
- [x] Library growth and backlog (saved vs listened)
- [x] Playlist intelligence (size, visibility, collaborative, activity)
- [x] Followed artists release radar
- [x] Playback health summary (device/action readiness)

## W3. Overview API
- [x] Return unified DTO: local insights + Spotify live insights
- [x] Partial failure strategy (section-level fallback instead of full 500)
- [x] Include permission/scopes hints when access is denied

## W4. UX delivery in dashboard
- [x] Add compact, readable cards for key KPIs
- [x] Add trend tables/lists with clear labels and legends
- [x] Keep responsive behavior for mobile/tablet/desktop

## W5. Auth/scopes
- [x] Add required scopes for new modules
- [x] Keep relogin hint flow for missing permissions

## W6. Validation
- [x] Unit tests for new services and mappers
- [x] API route tests for expanded contract
- [ ] Lint + type check (`next build` currently blocked by pre-existing missing `dotenv` in test setup)
