# World Cup Games Browse View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long stage-grouped World Cup picks scroll with a flat, kickoff-sorted, filterable browse list (then progressively add a per-match detail view and richer data).

**Architecture:** Three stacked PRs. P1 is frontend-only: an adapter maps the existing `WorldCupMatch` API shape + the user's draft into the `BrowseGame` view model, and a controlled `WorldCupGamesList` (already prototyped, pure helpers already unit-tested) renders it inside `WorldCupPicksTab`, replacing the `MatchPickRow` scroll. P2 adds backend scoreboard parsing (3-way odds, W-D-L record, form, statistics) + the detail panel. P3 adds the `/event/:espnId` summary endpoint (venue, head-to-head, standings, lineups).

**Tech Stack:** React 18 + Vite + TS, Tailwind design-system tokens, vitest (Node 20), backend Express + `node --test`.

Spec: `docs/superpowers/specs/2026-06-12-worldcup-games-browse-design.md`

---

## Scope decisions (read first)

The prototype card shows per-outcome **odds** and **W-D-L record** under each button, and a **More ›** detail. The real `WorldCupMatch` API shape (`frontend/src/lib/types.ts`) carries **none of those** — only `id, stage, homeTeam/awayTeam {id,name,abbreviation,logo}, homeScore, awayScore, status, isKnockout, gameDate, winnerTeamId, events`. So per the spec's phasing:

- **P1 (this plan, in detail):** flat filterable list wired to real data. Cards = **team logo + code + pick buttons + result shading**. Subheader = time + full names (no "More ›"). **No** per-outcome odds, **no** record, **no** detail panel. Result shading + Correct/Incorrect chips work (they key off the score, which is present). Frontend-only, no backend changes.
- **P2 (outlined):** backend parses 3-way moneyline + over/under + W-D-L record + form + the 9 match stats into the stage response; cards gain odds + record; add the **detail panel** (More ›) with pick-context (odds/form) + timeline + match stats.
- **P3 (outlined):** new `GET /api/games/world-cup-2026/event/:espnId` (ESPN `/summary`) → venue, head-to-head, standings, lineups in the detail.

## Stacking mechanics

The prototype branch `claude/wc-games-browse` (spec + mock prototype) is a **throwaway reference** — not merged. The shippable stack is built fresh:

```
main
 └─ claude/wc-browse-spec   (spec doc only)            → PR → main
     └─ claude/wc-browse-p1 (P1 list, real data)       → PR → claude/wc-browse-spec
         └─ claude/wc-browse-p2 (odds/record + detail) → PR → claude/wc-browse-p1
             └─ claude/wc-browse-p3 (/event endpoint)  → PR → claude/wc-browse-p2
```

Each PR targets the branch below it. The real components are cherry-picked from the prototype branch (excluding the mock/dev-route scaffolding).

---

## P1 file structure

**Reused from the prototype (cherry-pick as-is):**
- `frontend/src/lib/wcGamesView.ts` + `wcGamesView.test.ts` — pure view logic (22 tests, unchanged).
- `frontend/src/designsystem/components/WorldCupBrowse/resultShade.ts` — shade colors.

**Modified for real data:**
- `frontend/src/lib/wcGamesView.ts` — `BrowseTeam`: rename `flag` → `logo` (URL); make `record`/`moneyline` optional; `BrowseGame`: make `drawOdds`/`overUnder` optional.
- `frontend/src/designsystem/components/WorldCupBrowse/ChoiceButton.tsx` — render a logo `<img>` instead of an emoji; hide the odds/record lines when absent.
- `frontend/src/designsystem/components/WorldCupBrowse/MatchListCard.tsx` — logo `<img>` in the result strip; drop the "More ›" button (no detail in P1).
- `frontend/src/designsystem/components/WorldCupBrowse/WorldCupGamesList.tsx` — make it **controlled**: take `games` + `onPick` from props (no internal `games`/pick state, no detail panel, no submit bar — the host owns those).
- `frontend/src/pages/GroupDetails/WorldCupPicksTab.tsx` — replace the stage-grouped `MatchPickRow` render with `WorldCupGamesList`, fed by the new adapter; keep the draft, submit bar, person selector, and polling.

**New:**
- `frontend/src/lib/worldCupBrowseAdapter.ts` + `.test.ts` — `toBrowseGames(matches, draft)` mapping `WorldCupMatch[]` + `DraftMap` → `BrowseGame[]`.

**Deleted (dev scaffolding):**
- `frontend/src/pages/WorldCupBrowsePreview.tsx`, the `/wc-preview` route in `frontend/src/App.tsx`, `frontend/src/lib/mockWorldCupData.ts`, `frontend/src/designsystem/components/WorldCupBrowse/MockResultsLeaderboard.tsx`, `frontend/preview.html`, `frontend/src/preview-main.tsx`.
- **Not in P1** (added in P2): `frontend/src/lib/wcMatchDetail.ts`, `MatchDetailPanel.tsx`.

---

## P1 Tasks

### Task 0: Branch setup

- [ ] **Step 1: Create the spec branch off main and cherry-pick the spec**

```bash
git fetch origin
git checkout -b claude/wc-browse-spec origin/main
git checkout claude/wc-games-browse -- docs/superpowers/specs/2026-06-12-worldcup-games-browse-design.md docs/superpowers/plans/2026-06-12-worldcup-games-browse.md
git add docs/ && git commit -m "Spec + plan: World Cup games browse view"
```

- [ ] **Step 2: Create the P1 branch off the spec branch**

```bash
git checkout -b claude/wc-browse-p1
# bring the reusable real components over from the prototype branch
git checkout claude/wc-games-browse -- \
  frontend/src/lib/wcGamesView.ts frontend/src/lib/wcGamesView.test.ts \
  frontend/src/designsystem/components/WorldCupBrowse/resultShade.ts \
  frontend/src/designsystem/components/WorldCupBrowse/ChoiceButton.tsx \
  frontend/src/designsystem/components/WorldCupBrowse/MatchListCard.tsx \
  frontend/src/designsystem/components/WorldCupBrowse/WorldCupGamesList.tsx
git add frontend/ && git commit -m "Vendor prototype browse components into P1"
```

Expected: the WorldCupBrowse dir contains only resultShade/ChoiceButton/MatchListCard/WorldCupGamesList (no detail/mock-leaderboard).

### Task 1: Make `BrowseTeam` use a logo and optional odds/record

**Files:**
- Modify: `frontend/src/lib/wcGamesView.ts` (the `BrowseTeam` + `BrowseGame` interfaces near the top)
- Test: `frontend/src/lib/wcGamesView.test.ts` (already imports these types)

- [ ] **Step 1: Update the interfaces**

```ts
export interface BrowseTeam {
  abbr: string;
  name: string;
  /** Crest/flag image URL (TeamData.logo). */
  logo: string;
  /** W-D-L, e.g. "1-0-0". Optional: absent until P2 parses it. */
  record?: string;
  /** Moneyline for this team to win. Optional: absent until P2. */
  moneyline?: string;
}
```
And in `BrowseGame`, make `drawOdds?: string;` and `overUnder?: string;` optional.

- [ ] **Step 2: Update the test fixtures**

In `wcGamesView.test.ts`, change the `team()` helper to `{ abbr, name, logo: '', }` (drop `flag`, drop required `record`/`moneyline`).

- [ ] **Step 3: Run the view tests, expect PASS**

```bash
cd frontend && export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20.17.0
npx vitest run src/lib/wcGamesView.test.ts
```
Expected: 22 passed (logic unchanged; only the team shape changed).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/wcGamesView.ts frontend/src/lib/wcGamesView.test.ts
git commit -m "BrowseTeam: logo + optional odds/record for real-data P1"
```

### Task 2: Render logos and hide absent odds/record in `ChoiceButton`

**Files:**
- Modify: `frontend/src/designsystem/components/WorldCupBrowse/ChoiceButton.tsx`

- [ ] **Step 1: Render a logo image and guard the odds/record lines**

```tsx
<span className="flex h-6 items-center justify-center gap-xs">
  {team && <img src={team.logo} alt="" className="h-icon-sm w-icon-sm object-contain" />}
  <span className={`text-base font-extrabold ${selected ? '' : 'text-content'}`}>{label}</span>
</span>
{odds && <span className={`text-xs font-bold tabular-nums ${oddsClass(odds, selected)}`}>{odds}</span>}
{record && (
  <span className={`text-[0.62rem] tabular-nums ${selected ? 'text-accent-fg/70' : 'text-content-subtle'}`}>{record}</span>
)}
```
Make `odds?: string` optional in `ChoiceButtonProps`. When neither odds nor record is present the button is just logo + code (the P1 state).

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```
Expected: clean (preview-main/MockResultsLeaderboard will error — they're deleted in Task 6; ignore until then or do Task 6 first).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/designsystem/components/WorldCupBrowse/ChoiceButton.tsx
git commit -m "ChoiceButton: logo image + optional odds/record"
```

### Task 3: Update `MatchListCard` (logo strip, drop More ›)

**Files:**
- Modify: `frontend/src/designsystem/components/WorldCupBrowse/MatchListCard.tsx`

- [ ] **Step 1: Use logos in the ResultStrip and remove the More button**

In `ResultStrip`, replace the two `{game.home.flag}` / `{game.away.flag}` spans with `<img src={game.home.logo} alt="" className="h-5 w-5 object-contain" />` (and away). In the subheader, delete the `onOpenDetail` "More ›" `<button>` and drop `onOpenDetail` from `MatchListCardProps`.

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```
Expected: `WorldCupGamesList` will error on the removed `onOpenDetail` — fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/designsystem/components/WorldCupBrowse/MatchListCard.tsx
git commit -m "MatchListCard: team logos, drop More (no detail in P1)"
```

### Task 4: Make `WorldCupGamesList` a controlled, list-only component

**Files:**
- Modify: `frontend/src/designsystem/components/WorldCupBrowse/WorldCupGamesList.tsx`

- [ ] **Step 1: New props — controlled games + onPick, no internal state for games/detail/submit**

```tsx
export interface WorldCupGamesListProps {
  games: BrowseGame[];          // derived by the host from matches + draft
  now: Date;
  onPick: (gameId: number, result: MatchResult) => void;
  disabled?: boolean;           // read-only viewer
}
```
Remove: `useState<BrowseGame[]>(initialGames)`, the internal `pick`, the `selectedId`/`MatchDetailPanel`, and the sticky **Submit bar** (the host `WorldCupPicksTab` already owns submit). Keep: `view`, `query`, `filters`, `sort`, `showFilters` state; the chips/search/filter toolbar; `buildSections`; the date-grouped `MatchListCard` render. Counts (`needsPickCount`, `correctCount`, `incorrectCount`) read from the `games` prop. `MatchListCard` gets `onPick={onPick}` (no `onOpenDetail`).

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```
Expected: clean except the to-be-deleted scaffolding (Task 6).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/designsystem/components/WorldCupBrowse/WorldCupGamesList.tsx
git commit -m "WorldCupGamesList: controlled, list-only (host owns picks + submit)"
```

### Task 5: The adapter — `WorldCupMatch` + draft → `BrowseGame`

**Files:**
- Create: `frontend/src/lib/worldCupBrowseAdapter.ts`
- Test: `frontend/src/lib/worldCupBrowseAdapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { toBrowseGames } from './worldCupBrowseAdapter';
import type { WorldCupMatch } from './types';

const match = (over: Partial<WorldCupMatch> = {}): WorldCupMatch => ({
  id: 1, stage: 'group', homeTeam: { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: 'mex.png' },
  awayTeam: { id: '2', name: 'South Africa', abbreviation: 'RSA', logo: 'rsa.png' },
  homeScore: 0, awayScore: 0, status: 'SCHEDULED', isKnockout: false,
  gameDate: '2026-06-12T17:00:00Z', ...over,
});

describe('toBrowseGames', () => {
  it('maps fields, labels the stage, and carries the draft pick', () => {
    const [g] = toBrowseGames([match({ id: 7, homeScore: 2, awayScore: 0, status: 'FINAL' })], { 7: 'home' });
    expect(g).toMatchObject({
      id: 7, espnId: '7', stage: 'group', stageLabel: 'Group Stage',
      kickoff: '2026-06-12T17:00:00Z', status: 'FINAL', homeScore: 2, awayScore: 0, picked: 'home',
    });
    expect(g.home).toMatchObject({ abbr: 'MEX', name: 'Mexico', logo: 'mex.png' });
    expect(g.home.record).toBeUndefined(); // no record until P2
  });
  it('omits a pick when the draft has none', () => {
    expect(toBrowseGames([match({ id: 9 })], {})[0].picked).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** (`toBrowseGames is not a function`)

```bash
cd frontend && npx vitest run src/lib/worldCupBrowseAdapter.test.ts
```

- [ ] **Step 3: Implement the adapter**

```ts
import type { BrowseGame, GameStatus, MatchResult, SortKey } from './wcGamesView';
import type { WorldCupMatch, WorldCupStage } from './types';

type DraftMap = Record<number, MatchResult>;

const STAGE_LABEL: Record<WorldCupStage, string> = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarterfinals', sf: 'Semifinals', third: 'Third Place', final: 'Final',
};

const NORMALIZED: Record<string, GameStatus> = {
  SCHEDULED: 'SCHEDULED', IN_PROGRESS: 'IN_PROGRESS', FINAL: 'FINAL',
};

export function toBrowseGames(matches: WorldCupMatch[], draft: DraftMap): BrowseGame[] {
  return matches.map((m) => ({
    id: m.id,
    espnId: String(m.id),
    stage: m.stage,
    stageLabel: STAGE_LABEL[m.stage] ?? m.stage,
    kickoff: m.gameDate ?? '',
    home: { abbr: m.homeTeam.abbreviation, name: m.homeTeam.name, logo: m.homeTeam.logo },
    away: { abbr: m.awayTeam.abbreviation, name: m.awayTeam.name, logo: m.awayTeam.logo },
    status: NORMALIZED[m.status] ?? 'SCHEDULED',
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    picked: draft[m.id],
  }));
}

export type { SortKey };
```
Note: `SortKey` re-export is a convenience for the host; drop if unused.

- [ ] **Step 4: Run the test, expect PASS**

```bash
cd frontend && npx vitest run src/lib/worldCupBrowseAdapter.test.ts
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/worldCupBrowseAdapter.ts frontend/src/lib/worldCupBrowseAdapter.test.ts
git commit -m "Adapter: WorldCupMatch + draft -> BrowseGame"
```

### Task 6: Delete the dev scaffolding

**Files:**
- Delete: `frontend/src/pages/WorldCupBrowsePreview.tsx`, `frontend/src/lib/mockWorldCupData.ts`, `frontend/src/designsystem/components/WorldCupBrowse/MockResultsLeaderboard.tsx`, `frontend/preview.html`, `frontend/src/preview-main.tsx`
- Modify: `frontend/src/App.tsx` (remove the import + the `/wc-preview` `<Route>`)

- [ ] **Step 1: Remove files and the route**

```bash
cd frontend
git rm src/pages/WorldCupBrowsePreview.tsx src/lib/mockWorldCupData.ts \
  src/designsystem/components/WorldCupBrowse/MockResultsLeaderboard.tsx
rm -f preview.html src/preview-main.tsx
```
In `src/App.tsx` delete `import WorldCupBrowsePreview …` and the `<Route path="/wc-preview" … />` line (and its comment).

- [ ] **Step 2: Typecheck — now clean**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Remove WC browse dev scaffolding (mock, preview route, harness)"
```

### Task 7: Wire `WorldCupGamesList` into `WorldCupPicksTab`

**Files:**
- Modify: `frontend/src/pages/GroupDetails/WorldCupPicksTab.tsx`

- [ ] **Step 1: Derive `BrowseGame[]` from the existing matches + draft**

After the existing `stageGroups` memo, add:

```tsx
import WorldCupGamesList from '../../designsystem/components/WorldCupBrowse/WorldCupGamesList';
import { toBrowseGames } from '../../lib/worldCupBrowseAdapter';
// …
const browseGames = useMemo(
  () => toBrowseGames(fetchState.matches, draft),
  [fetchState.matches, draft],
);
const now = useMemo(() => new Date(), []); // single stable "now" per render pass
```

- [ ] **Step 2: Replace the stage-grouped render block with the list**

Replace the `stageGroups.map(group => <section>…<MatchPickRow/>…</section>)` block (the `else` branch of the loading/error/empty conditional) with:

```tsx
<WorldCupGamesList
  games={browseGames}
  now={now}
  onPick={(gameId, result) => pickResult(gameId, result)}
  disabled={submitting || readOnly}
/>
```
Keep the loading / error / empty-state branches, the sticky **submit bar**, the person selector, and the polling exactly as they are. `pickResult(matchId, result)` already toggles the draft — the signatures match (`MatchResult` === `MatchPickResult`).

- [ ] **Step 3: Remove the now-unused `MatchPickRow` import and `STAGE_LABEL`/`stageGroups`** if nothing else references them (grep first).

- [ ] **Step 4: Typecheck + run the tab's tests**

```bash
cd frontend && npx tsc --noEmit
npx vitest run src/pages/GroupDetails/WorldCupPicksTab.test.tsx
```
Expected: tsc clean. Some existing tab tests assert the old stage-section/`MatchPickRow` markup and **will fail** — update them in Step 5.

- [ ] **Step 5: Update the tab tests to the new list markup**

Adjust assertions that looked for stage `<h2>` sections or per-row `MatchPickRow` structure to instead assert the list renders the matchups (e.g., `getByText('Mexico vs South Africa')`) and that picking a game calls submit with the right draft. Keep the person-selector / read-only / submit tests intact (that logic is unchanged).

- [ ] **Step 6: Run the full frontend suite + build**

```bash
cd frontend && export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20.17.0
npx vitest run && npm run build
```
Expected: all green; build OK.

- [ ] **Step 7: Local visual verify (the spec's hard gate)**

Run `npm run dev`, sign in locally (token-injection shortcut), open a World Cup group's **Picks** tab. Confirm: flat list, "Needs pick" default, chips + counts, search/filter/sort, result shading on finals, picking + submit still work — light/dark, mobile/desktop. Screenshot before opening the PR.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/GroupDetails/WorldCupPicksTab.tsx frontend/src/pages/GroupDetails/WorldCupPicksTab.test.tsx
git commit -m "WorldCupPicksTab: flat browse list replaces the stage-grouped scroll"
```

### Task 8: Open the P1 PR (stacked on the spec branch)

- [ ] **Step 1: Push and open**

```bash
git push -u origin claude/wc-browse-spec
git push -u origin claude/wc-browse-p1
gh pr create --base claude/wc-browse-spec --head claude/wc-browse-p1 \
  --title "WC browse P1: flat filterable picks list (frontend)" \
  --body "Replaces the stage-grouped scroll with a flat, kickoff-sorted, filterable list (views/filters/sort/search, Correct/Incorrect chips, result shading). Frontend-only; cards show logo+code+pick (odds/record + detail arrive in P2). Spec: docs/superpowers/specs/2026-06-12-worldcup-games-browse-design.md"
```
(Also open the spec PR: `gh pr create --base main --head claude/wc-browse-spec …`.)

---

## P2 — Scoreboard extras + detail panel (outline; detail-plan when reached)

Backend (`backend/src/models/Game.js` `fromESPNData` + `toJSON`):
- Parse `competition.odds[0].moneyline` (home/draw/away) + `overUnder` → `odds.threeWay`.
- Parse `competitors[].records[].summary` → `record`; `competitors[].form` → `form`; `competitors[].statistics` (9) → `statistics`.

### ⚠️ Prod-safety guardrails (audit — this is the SEV-risk phase)
The events-column SEV happened because a new column + `save()` writing it deployed BEFORE prod had the column (prod schema sync is gated behind `INIT_DB=true`, not auto-run). P2 must not repeat that:
1. **3-way odds + over/under** ride inside the EXISTING `odds` JSONB column — richer content, **no schema change**. Safe.
2. **record / form / statistics**: do NOT add a column and blindly `save()` it. Either
   (a) **reuse the proven events-column resilience** — the `Game.eventsColumnAvailable` pattern (detect Postgres `42703`, persist without the column, never 500) — AND run the `INIT_DB` migration as part of the release; or
   (b) serve them in `toJSON` from the in-memory ESPN parse without persisting (note: a cache-hit DB read then lacks them, so the detail's stats are blank until the next live refresh — weaker but zero-schema).
   Prefer (a). NEVER ship "add column → `save()` writes it → deploy" without the resilient guard.
3. Deploy order is frontend-tolerant: the frontend already treats `record`/`moneyline`/`drawOdds`/`overUnder` as optional (P1), so a frontend that ships before the backend just shows cards without odds — no break.

Frontend:
- Extend `WorldCupMatch` + the adapter to fill `BrowseTeam.record`/`moneyline`, `BrowseGame.drawOdds`/`overUnder` (the card already renders them when present).
- Re-introduce `MatchDetailPanel` + the "More ›" affordance + `?match=` slide-over; detail shows pick + odds/form + timeline + match stats. (Cherry-pick `MatchDetailPanel.tsx` from `claude/wc-games-browse`, wire to a real `getMatchDetail` built from the now-richer game.)
- Promote the result-shade hexes to semantic tokens (`--color-result-*`) + safelist.

PR `claude/wc-browse-p2` → `claude/wc-browse-p1`.

## P3 — Summary endpoint (outline)

- Backend `GET /api/games/world-cup-2026/event/:espnId` → ESPN `/summary`; parse venue, head-to-head, standings, lineups (rosters + keyEvents sub minutes).
- Frontend `getMatchDetail(espnId)` calls it; detail gains venue (header), H2H, group standings, lineups (team toggle, markers).

### ⚠️ Prod-safety guardrails (audit)
1. **Prefer NO new schema.** The detail is opened per-match (N+1), not on every list load, so fetch `/summary` **on demand, live, un-persisted** — a short in-process/HTTP-cache TTL at most. This sidesteps the migration class entirely. Only if a DB cache is truly needed, reuse the events-resilience pattern + migrate.
2. **The endpoint must be resilient and isolated.** It must NEVER 500 the whole response on a missing/changed `/summary` field — degrade and return what's available (the events lesson). It is a SEPARATE fetch from the stage list, so even total failure only blanks the detail panel, not the picks/list flow.
3. **Use the real `espnId`.** The detail must key off the ESPN event id, but P1's adapter currently sets `espnId = String(m.id)` (the DB id). The real `espnId` IS already in the stage response (`Game.toJSON` returns it) — P2/P3 must add `espnId` to the `WorldCupMatch` type and map `espnId: m.espnId` in the adapter, else `/event/:espnId` hits the wrong id.

PR `claude/wc-browse-p3` → `claude/wc-browse-p2`.

---

## Self-review

- **Spec coverage:** list/views/filters/sort/search ✔ (P1, helpers tested); result shading ✔ (P1); Correct/Incorrect chips ✔ (P1); card odds/record ✔ (P2); detail (pick-context, timeline, stats) ✔ (P2); H2H/standings/lineups/venue ✔ (P3); date·time·venue header ✔ (P3 header, P2 panel); leaderboard explicitly out of scope ✔.
- **Placeholder scan:** adapter, interface, and component changes all show concrete code; mechanical deletes list exact paths. P2/P3 are intentionally outlines (the user asked to plan P1 in detail) — they get their own detailed plans when reached.
- **Type consistency:** `MatchResult` (wcGamesView) === `MatchPickResult` (types) — both `'home'|'draw'|'away'`; `onPick(gameId, result)` matches `pickResult(matchId, result)`. `BrowseTeam.logo` used consistently in ChoiceButton + MatchListCard. `toBrowseGames` returns `BrowseGame[]` consumed by the controlled `WorldCupGamesList`.
