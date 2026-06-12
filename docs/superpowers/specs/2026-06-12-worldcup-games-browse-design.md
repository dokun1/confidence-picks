# World Cup games — browse / filter / pick view (list + detail)

**Date:** 2026-06-12
**Status:** Approved design, ready to prototype with mock data
**Surfaces:** `frontend/src/pages/GroupDetails/WorldCupPicksTab.tsx` (and the `/world-cup` standalone page that mounts it)

## Problem

The World Cup picks tab renders every game (72 group-stage matches plus knockouts,
~100+) in one long stage-grouped scroll, with inline pick controls per row. As the
tournament progresses this is increasingly hard to scan — you can't quickly find the
games you still need to pick before they lock, or see results, without scrolling the
whole tournament.

## Primary job (decided)

**Finishing picks.** The view's first duty is surfacing games that are *unpicked and
not yet locked*, soonest kickoff first. Results-tracking is secondary but first-class.
Picking stays **inline** (fast bulk completion) and the submit-all bar is retained.

## Goals

- A scannable, **flat, kickoff-sorted** list with **saved views**, search, filter, and
  sort — replacing the long stage-grouped scroll.
- A per-event **detail view (N+1)** for depth: pick-with-context before kickoff, and the
  live timeline + match stats after.
- Surface betting odds + W-D-L record on the basic card; full context (form, H2H,
  standings, lineups) in the detail.

## Non-goals

- No change to scoring or the pick/submit data contract.
- **The leaderboard is a separate surface** — it does NOT live on the picks page. The
  prototyped **result chips** (each a member's pick for a match, shaded by the same
  `resultShade` scale) are parked for that separate leaderboard work; only the shared
  shade scale is settled here.
- No pitch/formation graphic for lineups in v1 (a grouped list is enough; pitch is a
  later nice-to-have).
- No live win-probability (ESPN's soccer scoreboard doesn't carry it).

---

## Surface N — the list

### Delineation

**N (list) = triage.** One row per event, lightweight, inline-pickable, rendered purely
from the existing stage endpoints (no per-event fetch). Job: "what do I act on, and what
happened."

### Toolbar (sticky)

- **Saved-view chips:** `Needs pick` (default) · `Today` · `Live` · `All` · `Correct` · `Incorrect`.
  - *Needs pick* = unpicked AND not locked (shows a count).
  - *Today* = kickoff today (any state). *Live* = in progress. *All* = everything.
  - *Correct* / *Incorrect* = finished games whose pick matched / didn't match the
    outcome, each with a **running count** that grows as the tournament progresses.
    A no-pick on a finished game is in neither (`pickVerdict` returns null).
- **Search:** matches team/country name (e.g. "mex", "korea"), case/diacritic-insensitive.
- **Filters sheet (AND-combined with the active view):** Stage · Status
  (Scheduled/Live/Final) · Pick-state (Picked/Unpicked).
- **Sort:** Kickoff (default, with date dividers) · Stage.
- All view/filter/sort/search logic lives in **pure, unit-tested helpers** (mirroring
  `pollIntervalFor`): `applyView`, `applyFilters`, `sortGames`, `matchesSearch`, plus a
  `groupByDate` for the dividers.

### Date dividers

Flat list segmented by kickoff day. The divider carries **date + stage**:
`TODAY · THU JUN 11 · GROUP STAGE`. (Stage rides with the date chip because the
tournament advances through stages over time, so a date range maps cleanly to a stage.)

### The card

A **subheader above the card** (outside the border), left-aligned, carrying
**time + full country names** ("5:00 PM  United States vs Paraguay"), wrapping
gracefully on narrow widths, with a roomy **"More ›"** pinned top-right that opens the
detail. The card body is the bet only.

**Pickable state** (not locked): three choice buttons, each self-contained —
- primary: **flag + country code**, prominent
- secondary: **DraftKings moneyline**, color-coded — **green** for minus (favorite),
  **red** for plus (underdog); the selected button keeps white odds for contrast on the
  accent fill
- tertiary: **W-D-L record** (Draw has none)
- uniform vertical rhythm: fixed-height primary row (absorbs the flag's height so the
  flag-less Draw aligns) + a reserved record line, so odds/records align across all three.

**Locked state** (live/final): same frame; the three buttons collapse to a **result
strip** — score + the pick's points; odds are dropped (ESPN nulls them at kickoff),
record may persist.

### Result shading (final cards)

A **final** result strip is tinted by how the pick scored (the WC group scale,
`resultShade`): **win = green (3)**, **correct draw = yellow (2)**, **partial = orange
(1)** (picked a team that drew, or Draw when a team won), **loss / no-pick = red (0)**.
The points label matches (`✓ +3` / `✓ +2` / `~ +1` / `✗ 0`). Live games stay neutral
(no settled result). The same scale is the source of truth for the **leaderboard result
chips** (below). Build note: promote the four shades to **semantic tokens**
(`--color-result-win/draw/partial/loss` — there's no orange in the palette yet) so they
theme and safelist instead of inline hexes.

---

## Surface N+1 — the detail

### Presentation

Opened from a card's **More ›**, URL-driven (`?match=:espnId`, deep-linkable):
**slide-over panel on desktop, full-screen route on mobile.**

### Header

Flags + **full names**; the center shows **score + status** (live/final) or **KICKOFF**
(scheduled) + stage. A single meta line always pairs **date · time · venue** in every
state (e.g. `Fri, Jun 12 · 2:00 PM · SoFi Stadium · Inglewood`) — the venue is on both
the scoreboard and `/summary`. (Earlier the date/time only showed for scheduled games;
it must appear for live/final too.)

### Sections, top → bottom

**Scheduled / pick-with-context:**
1. **Your pick** — the same three-way card; **O/U** shown as a small caption beneath
   (the moneylines are already on the buttons, so there is **no separate odds section**).
2. **Form** — last 5 as W/D/L pills (green/gray/red).
3. **Head-to-head** — last-5 tally + most-recent result.
4. **Group standings** — mini table; the two teams in *this* match auto-bolded.
5. **Lineups** — "Probable XI posts ~1h before kickoff" until ESPN publishes them.

**Live / final** swaps sections 2–4 for:
- **Goal/card timeline** (the existing `MatchTimeline`, already shipped/parsed).
- **Match stats** — possession %, shots, shots on target, fouls, corners (paired bars).
- **Lineups** (below) once published.

### Lineups

Per-team (**team toggle**), grouped by line (GK / DEF / MID / FWD) with the **formation**
(e.g. `4-1-4-1`), jersey #, name, and per-player markers with minutes: ⚽ goal, 🟨/🟥
card, **↓ subbed-off** (red). A **Substitutes used** group shows **↑ on** (green) with the
minute. Built from `/summary` `rosters` (starter/subbedIn/subbedOut) + `keyEvents`
(substitution minutes via `participants[on, off]`).

---

## Backend

### Augment the stage response (no new fetch)

Parse from the scoreboard competitor (already fetched per stage) into `Game`, included in
`toJSON()`:
- **`record`** — W-D-L from `competitors[].records[].summary` ("1-0-0").
- **`form`** — `competitors[].form` ("WWWWD").
- **`statistics`** — the 9 per-team match stats (possession, shots, etc.).

### New per-event detail endpoint

`GET /api/games/world-cup-2026/event/:espnId` → fetches ESPN `/summary?event=`, returns a
bundle: `{ venue, headToHead, standings, lineups }` (plus the game's own
events/stats/odds). **Status-aware cached** (reuse the `isStageCacheFresh` TTL pattern:
short while live, long when scheduled/final). **Resilient to schema/shape drift** — never
throw the whole response on a missing field (the events-column SEV lesson:
`[[worldcup-backend-gaps]]`).

---

## Frontend architecture

- **Pure helpers** (`frontend/src/lib/wcGamesView.ts`): `applyView`, `applyFilters`,
  `sortGames`, `matchesSearch`, `groupByDate`. Fully unit-tested, no React.
- **Components** (`frontend/src/designsystem/components/` or a `WorldCupBrowse/` module):
  `MatchListCard` (the card above), `GamesToolbar` (chips + search + filter sheet),
  `WorldCupGamesList` (dividers + cards + submit bar), `MatchDetailPanel` (N+1 shell),
  plus detail sub-sections (`Form`, `HeadToHead`, `GroupStandings`, `MatchStats`,
  `Lineups`).
- **Data adapter:** the list consumes the existing `getStageMatches`; the detail consumes
  a new `getMatchDetail(espnId)`. For the **local mock-data prototype**, both are backed
  by a `mockWorldCupData` module so the whole UI runs locally with no backend.
- **Token note:** the form/result pills use `bg-success-*` / `bg-error-*` /
  `bg-secondary-*` utilities that Tailwind JIT won't emit unless used elsewhere — **add
  them to the safelist** (or a shared pill component) so they ship.

---

## Phasing — each phase runs locally and is eyeballed before its PR

- **P0 (this step): mock-data prototype.** Real components + pure helpers wired to
  `mockWorldCupData`, reachable at a local dev route. No backend. The artifact we sign off
  on visually (light/dark, mobile/desktop) before wiring anything.
- **P1:** List view (card + toolbar + views/filters/sort/search) wired to the real stage
  endpoint, replacing the stage-grouped scroll. Detail shell on existing data (pick, odds,
  timeline, score). ← the completion win.
- **P2:** Scoreboard extras — parse `form` / `record` / `statistics`; render record on the
  card and form/stats in the detail.
- **P3:** `/event/:espnId` summary endpoint → head-to-head, standings, lineups.

## Verification gate (hard requirement)

Nothing reaches a PR until it **runs on `localhost:5173`** and has been **eyeballed in
light/dark and mobile/desktop**. Tests: pure helpers + components (frontend, vitest on
**Node 20** — `[[vitest-node25-localstorage-break]]`), parsers + endpoint caching
(backend, `node --test`).

## Open questions / deferred

- Pitch/formation graphic for lineups (deferred to post-v1).
- Whether "All" needs sub-grouping by stage for the late knockout rounds (revisit after P1
  with real data volume).
