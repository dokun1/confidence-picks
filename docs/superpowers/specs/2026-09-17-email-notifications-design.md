# Email notifications for NFL groups — design

Date: 2026-09-17
Status: approved for implementation

## Problem

Confidence-picks has never sent a user an email. Members find out they owe
picks only by opening the site, and a finished week produces no artifact at
all — you have to go look at the leaderboard to learn how you did.

Two emails close both gaps:

1. **Pick reminder** — "you have picks to make today before kickoff", sent
   once per day, four hours before the first game of that day's slate, to
   members who still owe a pick.
2. **Weekly summary** — the group's pick grid and leaderboard, sent the
   morning after the week's last game goes final.

Both are strictly opt-in, configured per group.

## Decisions

| Question | Decision |
|---|---|
| Provider | Resend. Free tier is 3,000/mo and 100/**UTC day**, permanently free, no trial cliff. |
| Scope | NFL (`pool_type = 'nfl_weekly'`) only. World Cup groups show no email settings. |
| Opt-in | Two booleans per (user, group), default **false**. Nothing sends to anyone who has not acted. |
| Scheduler | GitHub Actions hourly cron. Free — this repo is public. |
| Job shape | A standalone Node script, the `cleanupInvites.js` shape. Not an HTTP endpoint. |
| Reminder batching | **One consolidated email per user per ET day**, listing every opted-in group where they owe picks. |
| Summary batching | **One email per group**, each with that group's own pick grid and leaderboard. |
| Summary timing | The 08:00 ET hour after every game in the week reads `FINAL`. Not a fixed weekday. |
| Unsubscribe | Signed link kills that type in that group. Plus a global "pause all email" on ProfilePage. |
| From | `Confidence Picks <noreply@confidence-picks.com>`, Reply-To `hello@noetalabs.tech`. |
| Delivery guarantee | **At-most-once**, enforced by a claim row. A missed send beats a duplicate. |

### Why a script, not an endpoint

The Action already has `DATABASE_URL` and a Node runtime. A script gets real
exit codes, no function timeout, and no shared-secret header to authenticate.
An HTTP endpoint only wins if the scheduler later moves to Vercel Cron, and
that swap is a small refactor of the entry point, not of the job bodies.

### Why GitHub Actions rather than Vercel Cron

Vercel's Hobby plan caps crons at **once per day**, which structurally cannot
serve a four-hours-before-kickoff window (Thursday and Monday night games need
a ~16:15 ET send). Hourly on Vercel means upgrading the backend project to Pro
at $20/mo. This repo is public, so Actions minutes are free, and
`cleanup-invites.yml` is already a working end-to-end template.

Two known Actions caveats, both handled by design rather than worked around:

- Scheduled runs fire late under load, sometimes 5–30 minutes. The job is
  therefore **window-based** (`0 < hours_to_kickoff <= 4`), never
  "exactly T-4h", so lateness narrows the window instead of missing it.
- GitHub disables scheduled workflows on public repos after 60 days with no
  commits. Worth knowing; not worth engineering around.

### Why at-most-once

The claim row is inserted *before* the provider call. A crash between claim and
send loses that one email. The alternative ordering — send, then record — turns
every crash, retry, and duplicate cron dispatch into a duplicate inbox
delivery. Duplicate email is the failure that makes people unsubscribe; a
missed reminder is a nuisance. The asymmetry decides it.

## Architecture

### Data model

Three schema changes, all self-healing through the `ensureDuesSchema()` pattern
(`Group.js:122-156`). Production runs with `INIT_DB` unset, so `schema.sql`
never executes on deploy and lazy `ADD COLUMN IF NOT EXISTS` is the only
migration that actually runs. Each column is declared **twice** per repo
convention: inline in `CREATE TABLE` for fresh databases, and in a trailing
`DO $$` guard for existing ones.

```sql
-- group_memberships — mirrors the dues_paid_at precedent
email_reminders  BOOLEAN NOT NULL DEFAULT false
email_summaries  BOOLEAN NOT NULL DEFAULT false

-- users — the global kill switch
email_paused_at  TIMESTAMP NULL          -- non-null: send this user nothing
```

One new table carries idempotency and an audit trail:

```sql
CREATE TABLE IF NOT EXISTS email_sends (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NULL REFERENCES groups(id) ON DELETE CASCADE,
  email_type VARCHAR(32) NOT NULL,        -- 'pick_reminder' | 'weekly_summary'
  dedupe_key VARCHAR(120) NOT NULL,
  provider_message_id VARCHAR(80) NULL,
  status VARCHAR(20) NOT NULL,            -- 'claimed' | 'sent' | 'failed' | 'skipped'
  error TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, email_type, dedupe_key)
);
```

Dedupe keys:

- reminder: `reminder:<ET date>` — e.g. `reminder:2026-09-20`. One per user per
  Eastern calendar day, independent of how many groups or slates are involved.
- summary: `summary:<groupId>:<season>:<seasonType>:<week>`.

`group_id` is NULL on reminder rows because a reminder spans groups.

**No unsubscribe-token column.** Tokens are HMAC-SHA256 over
`userId|groupId|type` using a dedicated `EMAIL_TOKEN_SECRET`. They never
expire (the email that carries one lives forever in an inbox), and rotating
`JWT_SECRET` must not break them — hence a separate secret rather than reuse.

### New backend modules

| Module | Responsibility |
|---|---|
| `backend/src/services/EmailService.js` | Thin Resend wrapper over native `fetch`. No SDK dependency. Owns dry-run, the `.local` address refusal, `Idempotency-Key`, and `List-Unsubscribe` headers. |
| `backend/src/services/NflScoreboardService.js` | `buildScoreboard()` + `gradeWeek()`, extracted from the `GET /scoreboard` route closure. |
| `backend/src/services/NflEmailJobs.js` | `runPickReminders({ now })` and `runWeeklySummaries({ now })`. Pure functions of a clock and the DB; take an injected sender. |
| `backend/src/utils/emailTokens.js` | `signUnsubscribe()` / `verifyUnsubscribe()`. |
| `backend/src/emails/pickReminder.js` | `{ subject, html, text }`. |
| `backend/src/emails/weeklySummary.js` | `{ subject, html, text }`. |
| `backend/src/scripts/sendNflEmails.js` | CLI entry. Runs both jobs, closes the pool, exits non-zero on failure. |

### The scoreboard extraction

NFL standings currently exist **only** inside the `GET /scoreboard` handler
(`backend/src/routes/picks.js:543-605`) — not a function, dependent on
`req`/`res`, uncallable from a job. The World Cup has a proper service
(`WorldCupLeaderboardService.buildGroupLeaderboard`); NFL has no analogue.

`NflScoreboardService.buildScoreboard(pool, groupId, season, seasonType)`
returns today's exact response shape:

```js
{ season, seasonType,
  weeks: number[],
  users: [{ userId, name, pictureUrl, weekly: [{ week, points }], totalPoints }] }
```

The route becomes a thin caller. Its existing tests are the safety net, plus a
characterization test that pins the shape across the refactor.

`gradeWeek()` carries the other half: `user_picks.won` and `points` are
**graded lazily** — they stay NULL until a browser hits `/picks` or
`/scoreboard`, which grade in memory and write back
(`picks.js:60-74`, `:211-224`). A Tuesday-morning job reading the table cold
will find an ungraded week, so the summary grades and persists before
rendering. Duplicating the ±confidence rule into the email job instead would
mean two copies of a scoring rule, which is how scoring bugs are born.

### Reminder job

Runs hourly. Reads the week via `computeClosestWeek` (currently module-private
in `picks.js`; must be exported) and refreshes through
`GameService.getGamesForWeek(season, seasonType, week, false)` so
postponements are current. Its internal freshness rules bound this to roughly
one ESPN call per hour.

1. Bucket the week's games by **America/New_York** calendar date; take today's.
2. `firstKickoff = min(game_date)` over today's games that are not locked
   (`isPickLocked`, `backend/src/utils/pickLock.js`).
3. If `hours_to_first_kickoff` is not in `(0, 4]`, stop.
4. For each `nfl_weekly` group: members with `email_reminders = true`,
   `email_paused_at IS NULL`, a sendable address, and at least one incomplete
   pick among today's games.
5. Group by user. One email per user naming each such group, its outstanding
   count, and the kickoff time.
6. Claim `reminder:<ET date>`; on conflict, skip silently.

**"Incomplete" means `picked_team_id IS NULL OR confidence_level IS NULL`, not
row-absence.** `UserPick.clearPending` (`UserPick.js:213`) writes NULL rows
rather than deleting, so an `EXISTS` test would silently skip members who
cleared a pick — exactly the people who most need the reminder.

### Summary job

Same hourly run. Fires when all three hold:

- every game in week W reads `FINAL`;
- the current Eastern hour is 08;
- no `email_sends` row exists for that user, group, and week.

Then, per group with at least one opted-in member: grade and persist the week,
build the scoreboard, render the pick grid, send one email per opted-in member.

Deriving the week from "all games FINAL" rather than a fixed Tuesday means
Saturday-heavy weeks, flexed games, and Tuesday postponement makeups are all
handled without a special case.

### API surface

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/groups/:identifier/email-prefs` | member | `{ emailReminders?, emailSummaries? }`. Mirrors `POST /:identifier/messages/read` — member-scoped, not admin. |
| `POST /api/users/me/email-pause` | member | `{ paused: boolean }` → sets/clears `email_paused_at`. |
| `GET /api/email/unsubscribe?token=…` | **public** | Renders a confirmation page. |
| `POST /api/email/unsubscribe` | **public** | RFC 8058 one-click target for `List-Unsubscribe-Post`. |

There is **no GET for prefs.** `Group.findByIdentifier` already LEFT JOINs the
caller's `group_memberships` row for `user_role`; the two booleans ride along
on that join, so the Settings tab reads them from the group payload it already
fetches. Zero extra requests.

MCP tokens need no change — `mcpAuth.js` is deny-by-default, so new routes are
unreachable to them automatically.

### Frontend

- **`designsystem/components/EmailPrefs/`** — Card, two `Toggle`s, Save button.
  Cloned from `DuesSettings.tsx` (draft state → `patch()` → `handleSave()` with
  `saving`/`error`/`savedAt`). Anchored `id="email-prefs"`.
- **`SettingsTab.tsx`** — slot below `DuesSettings`, NFL groups only.
- **`Banner.tsx`** — one new optional prop, `onDismiss?: () => void`, rendering
  an ✕. Nothing else about the component changes.
- **`GroupDetailsPage.tsx`** — the announcement banner: `variant="info"`,
  dismissible, shown only on NFL groups where the user has set neither pref,
  suppressed on the Settings tab (as `DuesBanner` already is). CTA follows
  `goToDuesDetails()` — switch tab, sync `?tab=settings`, scroll to
  `#email-prefs`.
- **`ProfilePage.tsx`** — the global pause toggle.
- **`groupsService.js`** + **`groupsService.d.ts`** — `setEmailPrefs`,
  `setEmailPause`, and the two new fields on `GroupDetail`. The `.d.ts` is
  load-bearing: tsconfig is `strict` without `allowJs`, so an export missing
  from the declaration file breaks every `.tsx` importer.

Dismissal persists under localStorage key `email-prefs-announcement-seen`,
read in a `useState` initialiser to avoid a paint flash — the
`ScoreBonusTooltip.tsx:3-21` pattern, including its try/catch guards.

### Email rendering

Hand-written HTML strings in `backend/src/emails/`. No React Email dependency:
these are two templates, and the dependency would buy component ergonomics we
don't need at this size.

Constraints that are not stylistic preferences but email-client requirements:
table-based layout, fully inline styles, 600px max width, no external CSS, no
remote images. Every email carries the unsubscribe footer, and every send sets
`List-Unsubscribe` plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.

## Safety rails

This is the first code in the project that can contact users at scale, so the
rails are part of the design rather than an operational afterthought.

- **`EMAIL_DRY_RUN=true` is the default.** The job logs what it would send.
  Flipped off only after a manual dry run is inspected.
- **`EMAIL_MAX_PER_RUN`** (default 80) — the run aborts rather than exceeding
  it. Resend's free ceiling is 100 per UTC day and the Tuesday summary burst is
  roughly 65 at current membership, so a fan-out bug has very little headroom
  before it becomes a deliverability problem.
- **Addresses ending `@confidence-picks.local` are never sent to.** Apple
  withholds the real address for some users and `User.js:127` mints these
  placeholders. They are guaranteed hard bounces, and bounce rate is what gets
  a sending domain throttled.
- **The workflow lands `workflow_dispatch:`-only.** The `schedule:` block is a
  separate, final commit after a green manual run, per the standing rule that
  no automatic trigger is added without explicit sign-off.

## Configuration

| Variable | Where | Notes |
|---|---|---|
| `RESEND_API_KEY` | GH Actions secret | Only the cron runner sends. Not needed in Vercel. |
| `EMAIL_TOKEN_SECRET` | GH Actions secret **and** Vercel backend | Must be **identical** in both: the script signs, the route verifies. |
| `EMAIL_FROM` | job only | `Confidence Picks <noreply@confidence-picks.com>` |
| `EMAIL_REPLY_TO` | job only | `hello@noetalabs.tech` |
| `EMAIL_DRY_RUN` | job only | Defaults true. |
| `EMAIL_MAX_PER_RUN` | job only | Defaults 80. |
| `TZ=UTC` | workflow | Load-bearing — see below. |
| `DATABASE_URL` | GH Actions secret | Already present. |

### Local secrets: envchain, not `.env`

Locally the secrets live in the macOS Keychain under a `confidence-picks`
envchain namespace, matching the existing `findplayplace` / `still-and-whim`
convention on this machine. Only the job needs them, so only the job is ever
run through envchain:

```bash
envchain --set confidence-picks RESEND_API_KEY EMAIL_TOKEN_SECRET EMAIL_FROM EMAIL_REPLY_TO
envchain confidence-picks node src/scripts/sendNflEmails.js
```

`EMAIL_TOKEN_SECRET` is generated once (`openssl rand -hex 32`) and the
**same** value is set in all three places — envchain, the GH Actions secret,
and the Vercel backend env. If they drift, unsubscribe links signed by the
cron job fail verification on the backend.

Consequence for the script: it reads `process.env` directly and must **not**
`dotenv`-load these particular variables. The repo's existing `.env` stays as
it is for database and OAuth config; no email secret is ever written to disk.

### Timezone dependency

`games.game_date` is `TIMESTAMP WITHOUT TIME ZONE` holding UTC, and `node-pg`
parses it in the **process** timezone. Vercel runs `TZ=UTC`, so kickoffs are
exact in production; a job running under a non-UTC `TZ` would shift every
kickoff and fire reminders at the wrong hour. The workflow pins `TZ=UTC`, and
all Eastern-time bucketing is done explicitly through `Intl`, never by relying
on the ambient zone.

### Week-0 aliasing

Regular-season week 0 is an alias for preseason week 4, with a season-dependent
storage slot (`picks.js:142-161`, `GameService.js:54-66`). Any job querying
games must replicate the mapping or read an empty slot. The email jobs go
through `GameService`/`computeClosestWeek` rather than raw SQL specifically so
this stays in one place.

## Testing

**Backend** (`node --test`):

- `email-token.test.js` — round-trip, tamper rejection, unknown-type rejection.
- `email-prefs-schema.test.js` — self-heal latch: probes once, adds, latches;
  does **not** latch on failure. Mirrors `dues-schema-selfheal.test.js`.
- `email-prefs-routes.test.js` — member can write own prefs; non-member 403.
- `email-service.test.js` — dry-run sends nothing; `.local` refusal; header and
  body shape; per-run cap aborts.
- `nfl-reminder-job.test.js` — window boundaries at the millisecond; ET day
  bucketing across a UTC midnight; NULL-pick rows counted as unpicked; paused
  users skipped; second run in the same ET day is a no-op.
- `nfl-summary-job.test.js` — does not fire with one non-final game; fires in
  the 08 ET hour; once per group-week.
- `nfl-scoreboard-service.test.js` — characterization test pinning the response
  shape across the extraction.

**Frontend** (vitest):

- `EmailPrefs.test.tsx` — props-in/callback-out, no service mocking, the
  `CreateGroupForm.test.tsx` model.
- `Banner.test.tsx` — `onDismiss` renders and fires; absent prop renders no ✕.
- `SettingsTab.test.tsx` — the `groupsService.js` mock factory gains
  `setEmailPrefs` (factories replace the whole module).
- `GroupDetailsPage.test.tsx` — banner appears for an unset NFL group,
  deeplinks to `?tab=settings`, stays dismissed.

### Test seam: localStorage leaks between cases

`GroupDetailsPage.test.tsx` never clears localStorage, and jsdom persists it
across cases within a file. A dismissal flag written by one test would leak
into the next and silently suppress the banner it asserts on. A
`localStorage.clear()` in `beforeEach` is required — the same class of trap as
the `clearWorldCupCache()` requirement already documented in CLAUDE.md.

## Out of scope

- Any email for World Cup groups.
- Digest/frequency controls beyond the two booleans.
- Bounce and complaint webhook handling. Worth adding if volume grows; at
  current scale the `.local` filter covers the known bounce source.
- Marketing or transactional email of any other kind.
- Migrating the scheduler to Vercel Cron.
