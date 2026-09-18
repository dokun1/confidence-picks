# Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send two opt-in emails to NFL group members — a once-daily pick reminder four hours before that day's first kickoff, and a weekly summary with the group's pick grid and leaderboard the morning after the week goes final.

**Architecture:** An hourly GitHub Actions cron runs a standalone Node script that calls two pure job functions. Each job takes an injected clock and sender, so every branch is testable without a network or a real date. Delivery is at-most-once: a claim row in `email_sends` is inserted before the provider call, so cron jitter, retries and double dispatches collapse to no-ops. Preferences are two booleans per (user, group) on `group_memberships`, default false.

**Tech Stack:** Node 20 ESM, Express 4, PostgreSQL via `pg`, Resend HTTP API over native `fetch` (no SDK), `node:test` for backend tests, React 18 + TypeScript + Vitest for frontend, Tailwind design system.

**Spec:** `docs/superpowers/specs/2026-09-17-email-notifications-design.md`

## Global Constraints

- **Opt-in only.** Both preference columns default `false`. No email is ever sent to a member who has not explicitly turned it on.
- **NFL only.** Every query filters `groups.pool_type = 'nfl_weekly'`. World Cup groups get no settings UI and no email.
- **At-most-once delivery.** Always claim the `email_sends` row *before* calling the provider. Never send first and record after.
- **Dry run is the default.** `EMAIL_DRY_RUN` unset or anything but the literal string `false` means log, don't send.
- **Hard send cap.** `EMAIL_MAX_PER_RUN`, default `80`. The run throws rather than exceeding it.
- **Never send to `@confidence-picks.local`.** Apple withholds real addresses for some users and `backend/src/models/User.js:127` mints these placeholders. They are guaranteed hard bounces.
- **Self-healing schema only.** Production runs with `INIT_DB` unset, so `schema.sql` never executes on deploy. Every new column needs (a) an inline `CREATE TABLE` declaration, (b) a trailing `DO $$` guard in `schema.sql`, and (c) a latched `ensure*` method following `Group.ensureDuesSchema` (`backend/src/models/Group.js:122-156`).
- **Never latch an `ensure*` method on failure.** Latch only after a confirmed present-or-added column, so a transient error lets the next call retry.
- **Eastern time is explicit.** Always compute day/hour via `Intl.DateTimeFormat` with `timeZone: 'America/New_York'`. Never rely on the ambient process zone. The workflow pins `TZ=UTC`.
- **`.d.ts` files are load-bearing.** tsconfig is `strict` without `allowJs`. Any new export from `groupsService.js` must be added to `groupsService.d.ts` or every `.tsx` importer fails to compile.
- **No `supertest`.** Route tests mount the single router under test on a bare
  Express app, `listen(0)`, and drive it with `fetch`. Auth is faked at
  `AuthService.verifyAccessToken` + `User.findById`; models are stubbed with
  `mock.method` per test. Template: `backend/tests/dues-routes.test.js`.
- **Commit message trailers.** Every commit ends with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
  ```
- **Do not push, open a PR, or add any workflow trigger** without explicit sign-off. `deploy-backend.yml` and `backend-tests.yml` auto-trigger on push/PR.

## Deviation from the spec

The spec says the summary job should "grade and persist" the week before rendering. **This plan grades in memory only and never writes to `user_picks`.** `buildScoreboard` already computes points in memory for rows where `points IS NULL` (that is exactly what the existing `/scoreboard` route does), so persistence buys nothing for the email and would make a read-only reporting job into a writer of scoring data. Less risk, less code, identical output. Everything else follows the spec as written.

## File Structure

**Backend — created:**

| File | Responsibility |
|---|---|
| `backend/src/utils/emailTokens.js` | HMAC sign/verify for unsubscribe links. No I/O. |
| `backend/src/utils/etTime.js` | `etDateKey` / `etHour`. Eastern-time bucketing, no I/O. |
| `backend/src/models/EmailSend.js` | The claim table: `ensureSchema`, `claim`, `markSent`, `markFailed`. |
| `backend/src/services/EmailService.js` | Resend wrapper. Dry run, address filter, per-run cap, unsubscribe headers. |
| `backend/src/services/NflScoreboardService.js` | `buildScoreboard` + `buildWeekPickGrid`, extracted from the route closure. |
| `backend/src/services/NflEmailJobs.js` | `runPickReminders`, `runWeeklySummaries`. Pure functions of injected deps. |
| `backend/src/emails/pickReminder.js` | `{ subject, html, text }`. |
| `backend/src/emails/weeklySummary.js` | `{ subject, html, text }`. |
| `backend/src/emails/layout.js` | Shared HTML shell + unsubscribe footer. |
| `backend/src/routes/email.js` | Public unsubscribe routes. |
| `backend/src/scripts/sendNflEmails.js` | CLI entry point. |
| `.github/workflows/nfl-emails.yml` | `workflow_dispatch:` only. |

**Backend — modified:** `Group.js` (prefs + self-heal), `User.js` (pause), `picks.js` (extract scoreboard, export `computeClosestWeek`), `groups.js` (prefs route), `auth.js` (pause route), `app.js` (mount email router), `schema.sql`, `package.json`.

**Frontend — created:** `designsystem/components/EmailPrefs/{EmailPrefs.tsx,EmailPrefs.test.tsx,index.ts}`.

**Frontend — modified:** `Banner.tsx` (+`onDismiss`), `SettingsTab.tsx`, `GroupDetailsPage.tsx`, `ProfilePage.tsx`, `groupsService.js`, `groupsService.d.ts`, plus the three test files whose mock factories must grow.

---

### Task 1: Email preference columns + self-heal

**Files:**
- Modify: `backend/src/database/schema.sql`
- Modify: `backend/src/models/Group.js:20-30` (latch), after `:156` (method)
- Test: `backend/tests/email-prefs-schema.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `Group.ensureEmailPrefsSchema()` → `Promise<void>`; static latch `Group._emailPrefsSchemaEnsured`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/email-prefs-schema.test.js
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/database.js';
import { Group } from '../src/models/Group.js';

describe('Group.ensureEmailPrefsSchema', () => {
  beforeEach(() => {
    Group._emailPrefsSchemaEnsured = false;
    mock.restoreAll();
  });

  test('adds the columns when the probe finds none, then latches', async () => {
    const calls = [];
    mock.method(pool, 'query', async (sql) => {
      calls.push(sql);
      if (sql.includes('information_schema.columns')) return { rows: [] };
      return { rows: [] };
    });

    await Group.ensureEmailPrefsSchema();
    assert.equal(Group._emailPrefsSchemaEnsured, true);
    assert.ok(calls.some((s) => s.includes('ALTER TABLE group_memberships')));
    assert.ok(calls.some((s) => s.includes('ALTER TABLE users')));

    const before = calls.length;
    await Group.ensureEmailPrefsSchema();
    assert.equal(calls.length, before, 'latched call must issue no queries');
  });

  test('does NOT latch when the probe throws', async () => {
    mock.method(pool, 'query', async () => {
      throw new Error('connection reset');
    });
    await Group.ensureEmailPrefsSchema();
    assert.equal(Group._emailPrefsSchemaEnsured, false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/email-prefs-schema.test.js`
Expected: FAIL — `Group.ensureEmailPrefsSchema is not a function`.

- [ ] **Step 3: Add the latch next to the existing ones**

In `backend/src/models/Group.js`, beside `static _duesSchemaEnsured = false;`:

```js
  // Self-heal latch for the email preference columns (see ensureEmailPrefsSchema).
  static _emailPrefsSchemaEnsured = false;
```

- [ ] **Step 4: Add the method after `ensureDuesSchema`**

```js
  // Self-heal the opt-in email preference columns. Prod runs with INIT_DB unset,
  // so schema.sql never executes on deploy.
  //
  // Like ensureDuesSchema, this gates READS as well as writes: findByIdentifier
  // selects user_gm.email_reminders, and Postgres errors on a missing column in
  // a select list rather than yielding undefined. Without this, the first deploy
  // would 500 every group route.
  static async ensureEmailPrefsSchema() {
    if (this._emailPrefsSchemaEnsured) return; // warm-instance fast path: no query
    try {
      const check = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'group_memberships' AND column_name = 'email_reminders'`
      );
      if (check.rows.length === 0) {
        console.log('[groups] Missing email preference columns – adding');
        await pool.query(`
          ALTER TABLE group_memberships
            ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS email_summaries BOOLEAN NOT NULL DEFAULT false
        `);
        await pool.query(`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email_paused_at TIMESTAMP NULL
        `);
        console.log('[groups] email preference columns added');
      }
      // Latch only after a confirmed present/added column.
      this._emailPrefsSchemaEnsured = true;
    } catch (e) {
      // Do NOT latch on failure — let the next call retry.
      console.warn('[groups] Failed to ensure email preference columns (may already exist):', e.message);
    }
  }
```

- [ ] **Step 5: Declare the columns in `schema.sql` (both places)**

Inside `CREATE TABLE IF NOT EXISTS group_memberships (...)`, after `dues_marked_by`:

```sql
  email_reminders BOOLEAN NOT NULL DEFAULT false, -- opt-in: "you have picks to make today"
  email_summaries BOOLEAN NOT NULL DEFAULT false, -- opt-in: weekly recap + leaderboard
```

Inside `CREATE TABLE IF NOT EXISTS users (...)`:

```sql
  email_paused_at TIMESTAMP NULL, -- non-null: global kill switch, send this user nothing
```

And append a trailing guard next to the other `DO $$` blocks:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'group_memberships' AND column_name = 'email_reminders'
  ) THEN
    ALTER TABLE group_memberships
      ADD COLUMN email_reminders BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN email_summaries BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_paused_at'
  ) THEN
    ALTER TABLE users ADD COLUMN email_paused_at TIMESTAMP NULL;
  END IF;
END $$;
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `cd backend && node --test tests/email-prefs-schema.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/Group.js backend/src/database/schema.sql backend/tests/email-prefs-schema.test.js
git commit -m "$(cat <<'EOF'
feat(email): add self-healing opt-in email preference columns

Two booleans per membership and a global pause on users, defaulting off so
nothing sends to anyone who has not opted in. Follows the ensureDuesSchema
self-heal because prod deploys with INIT_DB unset and these columns gate
reads, not just writes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 2: Read and write preferences through the models

**Files:**
- Modify: `backend/src/models/Group.js` (constructor ~`:32-74`, `findByIdentifier` `:266-319`)
- Modify: `backend/src/models/User.js`
- Test: `backend/tests/email-prefs-model.test.js`

**Interfaces:**
- Consumes: `Group.ensureEmailPrefsSchema()` from Task 1.
- Produces:
  - `group.emailReminders: boolean`, `group.emailSummaries: boolean` on the instance returned by `findByIdentifier` (the caller's own membership row; `false` when not a member).
  - `Group.setEmailPrefs(groupId, userId, { emailReminders, emailSummaries })` → `Promise<{ emailReminders: boolean, emailSummaries: boolean }>`. Throws `Error('User is not a member of this group')` when no row matches.
  - `User.setEmailPaused(userId, paused)` → `Promise<{ emailPausedAt: string | null }>`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/email-prefs-model.test.js
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/database.js';
import { Group } from '../src/models/Group.js';

describe('Group.setEmailPrefs', () => {
  beforeEach(() => {
    Group._emailPrefsSchemaEnsured = true; // skip the self-heal probe
    mock.restoreAll();
  });

  test('updates only the fields provided and returns the new state', async () => {
    let captured = null;
    mock.method(pool, 'query', async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ email_reminders: true, email_summaries: false }] };
    });

    const result = await Group.setEmailPrefs(7, 42, { emailReminders: true });

    assert.deepEqual(result, { emailReminders: true, emailSummaries: false });
    assert.ok(captured.sql.includes('email_reminders'));
    assert.ok(!captured.sql.includes('email_summaries ='), 'omitted field must not be written');
    assert.deepEqual(captured.params.slice(-2), [7, 42]);
  });

  test('throws when the membership row does not exist', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));
    await assert.rejects(
      () => Group.setEmailPrefs(7, 42, { emailSummaries: true }),
      /not a member/i,
    );
  });

  test('rejects a call with no recognised fields', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));
    await assert.rejects(() => Group.setEmailPrefs(7, 42, {}), /No valid fields/);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/email-prefs-model.test.js`
Expected: FAIL — `Group.setEmailPrefs is not a function`.

- [ ] **Step 3: Add `setEmailPrefs` to `Group`**

```js
  /**
   * Set the calling member's own email preferences. Member-scoped, NOT admin —
   * every member owns their own inbox, so there is deliberately no role check
   * here and no path for an admin to set someone else's.
   */
  static async setEmailPrefs(groupId, userId, prefs) {
    await Group.ensureEmailPrefsSchema();

    const sets = [];
    const values = [];
    if (typeof prefs.emailReminders === 'boolean') {
      values.push(prefs.emailReminders);
      sets.push(`email_reminders = $${values.length}`);
    }
    if (typeof prefs.emailSummaries === 'boolean') {
      values.push(prefs.emailSummaries);
      sets.push(`email_summaries = $${values.length}`);
    }
    if (sets.length === 0) throw new Error('No valid fields to update');

    values.push(groupId, userId);
    const { rows } = await pool.query(
      `UPDATE group_memberships SET ${sets.join(', ')}
       WHERE group_id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING email_reminders, email_summaries`,
      values,
    );
    if (rows.length === 0) throw new Error('User is not a member of this group');
    return {
      emailReminders: rows[0].email_reminders,
      emailSummaries: rows[0].email_summaries,
    };
  }
```

- [ ] **Step 4: Surface the prefs on `findByIdentifier`**

`findByIdentifier` already LEFT JOINs the caller's membership as `user_gm` for `user_role`. Add two columns to that select list — no new join, no extra query:

```sql
       user_gm.email_reminders as user_email_reminders,
       user_gm.email_summaries as user_email_summaries,
```

Add `await Group.ensureEmailPrefsSchema();` beside the existing `await Group.ensureDuesSchema();` at the top of the method — the new columns are now named in the select list, so a missing column would 500 the route.

In the `new Group({...})` construction at the end of `findByIdentifier`:

```js
      emailReminders: group.user_email_reminders ?? false,
      emailSummaries: group.user_email_summaries ?? false,
```

And in the constructor, beside the other `?? false` defaults:

```js
    this.emailReminders = data.emailReminders ?? false;
    this.emailSummaries = data.emailSummaries ?? false;
```

- [ ] **Step 5: Add `User.setEmailPaused`**

In `backend/src/models/User.js`:

```js
  // Global kill switch. Overrides every per-group preference: a paused user is
  // filtered out of every send query regardless of what their groups say.
  static async setEmailPaused(userId, paused) {
    const { rows } = await pool.query(
      `UPDATE users SET email_paused_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING email_paused_at`,
      [userId, paused ? new Date() : null],
    );
    if (rows.length === 0) throw new Error('User not found');
    return { emailPausedAt: rows[0].email_paused_at };
  }
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `cd backend && node --test tests/email-prefs-model.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 7: Run the whole backend suite for regressions**

Run: `cd backend && node --test tests/*.test.js`
Expected: no new failures. `findByIdentifier` changed, so group route tests exercise it.

- [ ] **Step 8: Commit**

```bash
git add backend/src/models/Group.js backend/src/models/User.js backend/tests/email-prefs-model.test.js
git commit -m "$(cat <<'EOF'
feat(email): read and write per-member email preferences

Prefs ride along on the membership LEFT JOIN findByIdentifier already does for
user_role, so the settings tab reads them from the group payload it already
fetches — no extra request. Writes are member-scoped by construction: there is
no path for an admin to change someone else's.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 3: The `email_sends` claim table

**Files:**
- Create: `backend/src/models/EmailSend.js`
- Modify: `backend/src/database/schema.sql`
- Test: `backend/tests/email-send-claim.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `EmailSend.ensureSchema()` → `Promise<void>`
  - `EmailSend.claim({ userId, groupId, emailType, dedupeKey })` → `Promise<number | null>` — the row id, or **`null` if already claimed**.
  - `EmailSend.markSent(id, providerMessageId)` → `Promise<void>`
  - `EmailSend.markFailed(id, message)` → `Promise<void>`
  - `EMAIL_TYPES = { REMINDER: 'pick_reminder', SUMMARY: 'weekly_summary' }`

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/email-send-claim.test.js
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/database.js';
import { EmailSend, EMAIL_TYPES } from '../src/models/EmailSend.js';

describe('EmailSend.claim', () => {
  beforeEach(() => {
    EmailSend._schemaEnsured = true;
    mock.restoreAll();
  });

  test('returns the row id when the claim is new', async () => {
    mock.method(pool, 'query', async () => ({ rows: [{ id: 99 }] }));
    const id = await EmailSend.claim({
      userId: 1, groupId: null, emailType: EMAIL_TYPES.REMINDER, dedupeKey: 'reminder:2026-09-20',
    });
    assert.equal(id, 99);
  });

  test('returns null when the same key was already claimed', async () => {
    // ON CONFLICT DO NOTHING yields zero rows.
    mock.method(pool, 'query', async () => ({ rows: [] }));
    const id = await EmailSend.claim({
      userId: 1, groupId: null, emailType: EMAIL_TYPES.REMINDER, dedupeKey: 'reminder:2026-09-20',
    });
    assert.equal(id, null);
  });

  test('claims before sending: status starts as "claimed"', async () => {
    let captured = null;
    mock.method(pool, 'query', async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ id: 1 }] };
    });
    await EmailSend.claim({
      userId: 5, groupId: 3, emailType: EMAIL_TYPES.SUMMARY, dedupeKey: 'summary:3:2026:2:1',
    });
    assert.ok(captured.sql.includes("'claimed'"));
    assert.ok(captured.sql.includes('ON CONFLICT'));
    assert.deepEqual(captured.params, [5, 3, 'weekly_summary', 'summary:3:2026:2:1']);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/email-send-claim.test.js`
Expected: FAIL — cannot find module `EmailSend.js`.

- [ ] **Step 3: Write the model**

```js
// backend/src/models/EmailSend.js
import pool from '../config/database.js';

export const EMAIL_TYPES = {
  REMINDER: 'pick_reminder',
  SUMMARY: 'weekly_summary',
};

/**
 * The send ledger, and the whole idempotency story.
 *
 * A row is claimed BEFORE the provider call, never after. That makes delivery
 * at-most-once: a crash between claim and send loses one email, where the
 * opposite ordering would turn every retry and duplicate cron dispatch into a
 * duplicate inbox delivery. Duplicate mail is what makes people unsubscribe;
 * a missed reminder is a nuisance. The asymmetry decides the ordering.
 */
export class EmailSend {
  static _schemaEnsured = false;

  static async ensureSchema() {
    if (this._schemaEnsured) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_sends (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          group_id INTEGER NULL REFERENCES groups(id) ON DELETE CASCADE,
          email_type VARCHAR(32) NOT NULL,
          dedupe_key VARCHAR(120) NOT NULL,
          provider_message_id VARCHAR(80) NULL,
          status VARCHAR(20) NOT NULL,
          error TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, email_type, dedupe_key)
        )
      `);
      this._schemaEnsured = true;
    } catch (e) {
      console.warn('[email] Failed to ensure email_sends table:', e.message);
    }
  }

  /** Returns the new row id, or null when this key was already claimed. */
  static async claim({ userId, groupId, emailType, dedupeKey }) {
    await EmailSend.ensureSchema();
    const { rows } = await pool.query(
      `INSERT INTO email_sends (user_id, group_id, email_type, dedupe_key, status)
       VALUES ($1, $2, $3, $4, 'claimed')
       ON CONFLICT (user_id, email_type, dedupe_key) DO NOTHING
       RETURNING id`,
      [userId, groupId, emailType, dedupeKey],
    );
    return rows.length > 0 ? rows[0].id : null;
  }

  static async markSent(id, providerMessageId) {
    await pool.query(
      `UPDATE email_sends SET status = 'sent', provider_message_id = $2 WHERE id = $1`,
      [id, providerMessageId ?? null],
    );
  }

  static async markFailed(id, message) {
    await pool.query(
      `UPDATE email_sends SET status = 'failed', error = $2 WHERE id = $1`,
      [id, String(message).slice(0, 2000)],
    );
  }
}
```

- [ ] **Step 4: Add the table to `schema.sql`**

Append next to the other `CREATE TABLE IF NOT EXISTS` blocks, using the exact DDL from Step 3.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `cd backend && node --test tests/email-send-claim.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/models/EmailSend.js backend/src/database/schema.sql backend/tests/email-send-claim.test.js
git commit -m "$(cat <<'EOF'
feat(email): add the email_sends claim table

A unique (user, type, dedupe_key) claimed before the provider call is the
entire idempotency story: cron jitter, a double dispatch and a retry all
collapse to a no-op. Delivery is at-most-once by construction.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 4: Unsubscribe tokens and Eastern-time helpers

**Files:**
- Create: `backend/src/utils/emailTokens.js`, `backend/src/utils/etTime.js`
- Test: `backend/tests/email-tokens.test.js`, `backend/tests/et-time.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `signUnsubscribe({ userId, groupId, type })` → `string`
  - `verifyUnsubscribe(token)` → `{ userId: number, groupId: number | null, type: string } | null`
  - `etDateKey(date)` → `'YYYY-MM-DD'` in America/New_York
  - `etHour(date)` → `0..23` in America/New_York

- [ ] **Step 1: Write the failing tests**

```js
// backend/tests/email-tokens.test.js
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { signUnsubscribe, verifyUnsubscribe } from '../src/utils/emailTokens.js';

describe('unsubscribe tokens', () => {
  before(() => { process.env.EMAIL_TOKEN_SECRET = 'test-secret-do-not-use'; });

  test('round-trips a group-scoped token', () => {
    const token = signUnsubscribe({ userId: 12, groupId: 5, type: 'pick_reminder' });
    assert.deepEqual(verifyUnsubscribe(token), { userId: 12, groupId: 5, type: 'pick_reminder' });
  });

  test('rejects a tampered payload', () => {
    const token = signUnsubscribe({ userId: 12, groupId: 5, type: 'pick_reminder' });
    const [body, mac] = [token.slice(0, token.lastIndexOf('.')), token.slice(token.lastIndexOf('.') + 1)];
    const forged = Buffer.from('99.5.pick_reminder').toString('base64url');
    assert.equal(verifyUnsubscribe(`${forged}.${mac}`), null);
  });

  test('rejects garbage and an unknown type', () => {
    assert.equal(verifyUnsubscribe('not-a-token'), null);
    assert.equal(verifyUnsubscribe(''), null);
    assert.equal(verifyUnsubscribe(null), null);
    assert.throws(() => signUnsubscribe({ userId: 1, groupId: 1, type: 'marketing_blast' }), /Unknown email type/);
  });
});
```

```js
// backend/tests/et-time.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { etDateKey, etHour } from '../src/utils/etTime.js';

describe('Eastern-time bucketing', () => {
  test('a Sunday 8:20pm ET kickoff belongs to Sunday, not Monday UTC', () => {
    // 2026-09-20 20:20 EDT === 2026-09-21 00:20 UTC
    const d = new Date('2026-09-21T00:20:00Z');
    assert.equal(etDateKey(d), '2026-09-20');
    assert.equal(etHour(d), 20);
  });

  test('midnight ET reports hour 0, not 24', () => {
    const d = new Date('2026-09-20T04:00:00Z'); // 00:00 EDT
    assert.equal(etHour(d), 0);
    assert.equal(etDateKey(d), '2026-09-20');
  });

  test('handles standard time after the DST change', () => {
    const d = new Date('2026-12-07T01:00:00Z'); // 2026-12-06 20:00 EST
    assert.equal(etDateKey(d), '2026-12-06');
    assert.equal(etHour(d), 20);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend && node --test tests/email-tokens.test.js tests/et-time.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `etTime.js`**

```js
// backend/src/utils/etTime.js
// NFL scheduling is an Eastern-time concept: "today's slate" and "the morning
// after" both mean ET regardless of where the process runs. Every conversion
// goes through Intl with an explicit zone -- never the ambient process zone,
// which is UTC on Vercel and CI but not on a developer laptop.
export const NFL_TIME_ZONE = 'America/New_York';

const DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: NFL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

// hourCycle h23 rather than hour12:false: the latter renders midnight as "24"
// under some ICU builds.
const HOUR_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: NFL_TIME_ZONE, hour: '2-digit', hourCycle: 'h23',
});

/** 'YYYY-MM-DD' for the Eastern calendar day containing `date`. */
export function etDateKey(date) {
  return DATE_FMT.format(date instanceof Date ? date : new Date(date));
}

/** 0-23, the Eastern hour containing `date`. */
export function etHour(date) {
  return Number(HOUR_FMT.format(date instanceof Date ? date : new Date(date)));
}
```

- [ ] **Step 4: Write `emailTokens.js`**

```js
// backend/src/utils/emailTokens.js
import crypto from 'node:crypto';

const TYPES = new Set(['pick_reminder', 'weekly_summary']);

// A dedicated secret, deliberately NOT JWT_SECRET: unsubscribe links live
// forever in inboxes, so rotating session signing keys must not break them.
function secret() {
  const s = process.env.EMAIL_TOKEN_SECRET;
  if (!s) throw new Error('EMAIL_TOKEN_SECRET is not set');
  return s;
}

function mac(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function signUnsubscribe({ userId, groupId, type }) {
  if (!TYPES.has(type)) throw new Error(`Unknown email type: ${type}`);
  const payload = `${userId}.${groupId ?? ''}.${type}`;
  return `${Buffer.from(payload).toString('base64url')}.${mac(payload)}`;
}

export function verifyUnsubscribe(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const idx = token.lastIndexOf('.');
  const provided = token.slice(idx + 1);
  let payload;
  try {
    payload = Buffer.from(token.slice(0, idx), 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = mac(payload);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const [userId, groupId, type] = payload.split('.');
  if (!TYPES.has(type)) return null;
  const uid = Number(userId);
  if (!Number.isInteger(uid)) return null;
  return { userId: uid, groupId: groupId === '' ? null : Number(groupId), type };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd backend && node --test tests/email-tokens.test.js tests/et-time.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/utils/emailTokens.js backend/src/utils/etTime.js backend/tests/email-tokens.test.js backend/tests/et-time.test.js
git commit -m "$(cat <<'EOF'
feat(email): signed unsubscribe tokens and Eastern-time bucketing

Tokens are HMAC'd against a dedicated secret rather than JWT_SECRET, because
an unsubscribe link lives in an inbox forever and must survive session key
rotation. Verification is length-checked before timingSafeEqual, which throws
on mismatched lengths.

ET helpers use an explicit zone so a Sunday night kickoff buckets to Sunday
rather than to Monday UTC.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 5: EmailService — the Resend wrapper

**Files:**
- Create: `backend/src/services/EmailService.js`
- Test: `backend/tests/email-service.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `isSendableAddress(email)` → `boolean`
  - `createEmailService({ fetchImpl?, env?, logger? })` → `{ send, sentCount, dryRun }`
  - `send({ to, subject, html, text, unsubscribeUrl, idempotencyKey })` → `Promise<{ id: string | null, dryRun?: true, skipped?: string }>`

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/email-service.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createEmailService, isSendableAddress } from '../src/services/EmailService.js';

const BASE_ENV = {
  EMAIL_DRY_RUN: 'false',
  RESEND_API_KEY: 'test-key',
  EMAIL_FROM: 'Confidence Picks <noreply@confidence-picks.com>',
  EMAIL_REPLY_TO: 'hello@noetalabs.tech',
};
const msg = {
  to: 'a@example.com', subject: 'S', html: '<p>h</p>', text: 't',
  unsubscribeUrl: 'https://x/u?token=t', idempotencyKey: 'k1',
};
const noop = { log: () => {}, warn: () => {} };

describe('isSendableAddress', () => {
  test('refuses the Apple placeholder domain', () => {
    assert.equal(isSendableAddress('apple_001@confidence-picks.local'), false);
    assert.equal(isSendableAddress('real@example.com'), true);
    assert.equal(isSendableAddress(null), false);
    assert.equal(isSendableAddress('no-at-sign'), false);
  });
});

describe('createEmailService', () => {
  test('dry run is the default and sends no request', async () => {
    let called = false;
    const svc = createEmailService({
      env: { ...BASE_ENV, EMAIL_DRY_RUN: undefined },
      fetchImpl: async () => { called = true; },
      logger: noop,
    });
    const res = await svc.send(msg);
    assert.equal(called, false);
    assert.equal(res.dryRun, true);
  });

  test('posts to Resend with auth, unsubscribe and idempotency headers', async () => {
    let captured = null;
    const svc = createEmailService({
      env: BASE_ENV,
      fetchImpl: async (url, opts) => {
        captured = { url, opts };
        return { ok: true, json: async () => ({ id: 'abc-123' }) };
      },
      logger: noop,
    });

    const res = await svc.send(msg);

    assert.equal(res.id, 'abc-123');
    assert.equal(captured.url, 'https://api.resend.com/emails');
    assert.equal(captured.opts.headers.Authorization, 'Bearer test-key');
    assert.equal(captured.opts.headers['Idempotency-Key'], 'k1');
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.from, BASE_ENV.EMAIL_FROM);
    assert.equal(body.reply_to, BASE_ENV.EMAIL_REPLY_TO);
    assert.equal(body.headers['List-Unsubscribe'], '<https://x/u?token=t>');
    assert.equal(body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  });

  test('skips an unsendable address without calling the provider', async () => {
    let called = false;
    const svc = createEmailService({
      env: BASE_ENV, fetchImpl: async () => { called = true; }, logger: noop,
    });
    const res = await svc.send({ ...msg, to: 'apple_1@confidence-picks.local' });
    assert.equal(called, false);
    assert.equal(res.skipped, 'unsendable-address');
  });

  test('throws rather than exceeding EMAIL_MAX_PER_RUN', async () => {
    const svc = createEmailService({
      env: { ...BASE_ENV, EMAIL_MAX_PER_RUN: '2' },
      fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'x' }) }),
      logger: noop,
    });
    await svc.send(msg);
    await svc.send(msg);
    await assert.rejects(() => svc.send(msg), /EMAIL_MAX_PER_RUN/);
    assert.equal(svc.sentCount, 2);
  });

  test('a non-ok provider response rejects with the body text', async () => {
    const svc = createEmailService({
      env: BASE_ENV,
      fetchImpl: async () => ({ ok: false, status: 422, text: async () => 'domain not verified' }),
      logger: noop,
    });
    await assert.rejects(() => svc.send(msg), /422.*domain not verified/s);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/email-service.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the service**

```js
// backend/src/services/EmailService.js
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Apple withholds the real address for some Sign-in-with-Apple users, and
// User.createOrUpdateApple mints a placeholder on this domain. Sending to one
// is a guaranteed hard bounce, and bounce rate is what gets a sending domain
// throttled -- so this filter protects deliverability for everyone else.
const UNSENDABLE_SUFFIX = '@confidence-picks.local';

export function isSendableAddress(email) {
  return (
    typeof email === 'string' &&
    email.includes('@') &&
    !email.toLowerCase().endsWith(UNSENDABLE_SUFFIX)
  );
}

/**
 * A thin Resend client over native fetch. No SDK: this is one POST, and the
 * dependency would only add a version to keep current.
 *
 * `fetchImpl` and `env` are injected so every branch is testable without a
 * network or process-wide environment mutation.
 */
export function createEmailService({ fetchImpl = fetch, env = process.env, logger = console } = {}) {
  // Dry run is the DEFAULT. Only the literal string 'false' enables sending, so
  // a missing or misspelled variable fails safe rather than mailing people.
  const dryRun = String(env.EMAIL_DRY_RUN ?? 'true').toLowerCase() !== 'false';
  const maxPerRun = Number.parseInt(env.EMAIL_MAX_PER_RUN || '80', 10);
  let sent = 0;

  return {
    dryRun,
    get sentCount() {
      return sent;
    },

    async send({ to, subject, html, text, unsubscribeUrl, idempotencyKey }) {
      if (!isSendableAddress(to)) {
        logger.warn(`[email] skipping unsendable address: ${to}`);
        return { id: null, skipped: 'unsendable-address' };
      }
      if (sent >= maxPerRun) {
        throw new Error(
          `EMAIL_MAX_PER_RUN (${maxPerRun}) reached — refusing to send more this run`,
        );
      }
      sent += 1;

      if (dryRun) {
        logger.log(`[email][dry-run] to=${to} subject=${JSON.stringify(subject)}`);
        return { id: null, dryRun: true };
      }

      const res = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to,
          reply_to: env.EMAIL_REPLY_TO,
          subject,
          html,
          text,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Resend rejected the send: ${res.status} ${body}`);
      }
      const data = await res.json().catch(() => ({}));
      return { id: data.id ?? null };
    },
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && node --test tests/email-service.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/EmailService.js backend/tests/email-service.test.js
git commit -m "$(cat <<'EOF'
feat(email): Resend client with dry-run, address filter and a send cap

Dry run is the default and only the literal string 'false' enables sending, so
a missing variable fails safe. The per-run cap throws rather than exceeding
itself: Resend's free tier is 100 per UTC day and a fan-out bug has very
little headroom before it becomes a deliverability problem.

Refuses @confidence-picks.local outright — those are Apple placeholder
addresses and every one is a guaranteed hard bounce.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 6: Extract the NFL scoreboard into a callable service

**Files:**
- Create: `backend/src/services/NflScoreboardService.js`
- Modify: `backend/src/routes/picks.js:22` (export `computeClosestWeek`), `:543-605` (route becomes a thin caller)
- Test: `backend/tests/nfl-scoreboard-service.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildScoreboard(groupId, season, seasonType)` → `Promise<{ season, seasonType, weeks: number[], users: Array<{ userId, name, pictureUrl, weekly: Array<{week, points}>, totalPoints }> }>` — **byte-identical to today's `GET /scoreboard` body.**
  - `buildWeekPickGrid(groupId, season, seasonType, week)` → `Promise<{ games: Array<{ gameId, homeAbbr, awayAbbr, homeScore, awayScore, status }>, rows: Array<{ userId, name, picks: Array<{ gameId, pickedTeamId, confidence, won, points }>, weekPoints }> }>`
  - `computeClosestWeek(season, seasonType)` — now exported from `picks.js`.

- [ ] **Step 1: Write the characterization test**

```js
// backend/tests/nfl-scoreboard-service.test.js
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/database.js';
import { buildScoreboard } from '../src/services/NflScoreboardService.js';

const HOME = { id: '1', abbreviation: 'SF' };
const AWAY = { id: '2', abbreviation: 'LAR' };

function stubQueries({ users, picks }) {
  mock.method(pool, 'query', async (sql) => {
    if (sql.includes('group_memberships')) return { rows: users };
    return { rows: picks };
  });
}

describe('buildScoreboard', () => {
  beforeEach(() => mock.restoreAll());

  test('grades ungraded FINAL picks in memory: +confidence win, -confidence loss', async () => {
    stubQueries({
      users: [{ id: 1, name: 'Ann', picture_url: null }],
      picks: [
        { user_id: 1, week: 1, confidence_level: 5, picked_team_id: '1', points: null, won: null,
          status: 'FINAL', home_team: HOME, away_team: AWAY, home_score: 20, away_score: 10 },
        { user_id: 1, week: 1, confidence_level: 3, picked_team_id: '2', points: null, won: null,
          status: 'FINAL', home_team: HOME, away_team: AWAY, home_score: 20, away_score: 10 },
      ],
    });

    const board = await buildScoreboard(7, 2026, 2);
    assert.deepEqual(board.weeks, [1]);
    assert.equal(board.users[0].totalPoints, 2); // +5 - 3
  });

  test('a tie scores zero and leaves won null', async () => {
    stubQueries({
      users: [{ id: 1, name: 'Ann', picture_url: null }],
      picks: [
        { user_id: 1, week: 2, confidence_level: 9, picked_team_id: '1', points: null, won: null,
          status: 'FINAL', home_team: HOME, away_team: AWAY, home_score: 17, away_score: 17 },
      ],
    });
    const board = await buildScoreboard(7, 2026, 2);
    assert.equal(board.users[0].totalPoints, 0);
  });

  test('members with no picks still appear, sorted last', async () => {
    stubQueries({
      users: [
        { id: 1, name: 'Ann', picture_url: null },
        { id: 2, name: 'Bo', picture_url: null },
      ],
      picks: [
        { user_id: 1, week: 1, confidence_level: 4, picked_team_id: '1', points: null, won: null,
          status: 'FINAL', home_team: HOME, away_team: AWAY, home_score: 20, away_score: 10 },
      ],
    });
    const board = await buildScoreboard(7, 2026, 2);
    assert.equal(board.users.length, 2);
    assert.equal(board.users[0].name, 'Ann');
    assert.equal(board.users[1].totalPoints, 0);
    assert.deepEqual(board.users[1].weekly, [{ week: 1, points: 0 }]);
  });

  test('a non-final game contributes nothing', async () => {
    stubQueries({
      users: [{ id: 1, name: 'Ann', picture_url: null }],
      picks: [
        { user_id: 1, week: 3, confidence_level: 7, picked_team_id: '1', points: null, won: null,
          status: 'IN_PROGRESS', home_team: HOME, away_team: AWAY, home_score: 7, away_score: 0 },
      ],
    });
    const board = await buildScoreboard(7, 2026, 2);
    assert.equal(board.users[0].totalPoints, 0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/nfl-scoreboard-service.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the service by moving the route body verbatim**

Copy the logic from `backend/src/routes/picks.js:549-602` unchanged — same queries, same grading, same sort. Do not "improve" it during the move; a behaviour change here silently rewrites everyone's standings.

```js
// backend/src/services/NflScoreboardService.js
import pool from '../config/database.js';

// Extracted verbatim from the GET /:identifier/scoreboard route closure so the
// weekly summary email can compute standings server-side. The route is now a
// thin caller. Grading is in memory only -- this never writes to user_picks.
function parseTeam(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

/** Winning team id for a FINAL row, or null on a tie. */
function winnerOf(row) {
  const home = parseTeam(row.home_team);
  const away = parseTeam(row.away_team);
  if (row.home_score > row.away_score) return home.id;
  if (row.away_score > row.home_score) return away.id;
  return null;
}

/** Grade in place, matching the existing on-demand scoring exactly. */
function gradeRows(pickRows) {
  for (const r of pickRows) {
    if (r.status !== 'FINAL' || r.confidence_level == null || !r.picked_team_id) continue;
    const winnerTeamId = winnerOf(r);
    if (winnerTeamId === null) {
      r.points = 0;
      r.won = null;
    } else if (r.points == null) {
      const didWin = String(winnerTeamId) === String(r.picked_team_id);
      r.points = didWin ? r.confidence_level : -r.confidence_level;
      r.won = didWin;
    }
  }
  return pickRows;
}

async function loadMembers(groupId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.picture_url FROM group_memberships gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1`,
    [groupId],
  );
  return rows;
}

export async function buildScoreboard(groupId, season, seasonType) {
  const users = await loadMembers(groupId);
  const { rows: pickRows } = await pool.query(
    `SELECT p.*, g.status, g.home_team, g.away_team, g.home_score, g.away_score
     FROM user_picks p
     JOIN games g ON g.id = p.game_id
     WHERE p.group_id=$1 AND p.season=$2 AND p.season_type=$3`,
    [groupId, season, seasonType],
  );
  gradeRows(pickRows);

  const weeks = [...new Set(pickRows.map((r) => r.week))].sort((a, b) => a - b);
  const userMap = new Map(
    users.map((u) => [u.id, { userId: u.id, name: u.name, pictureUrl: u.picture_url, weekly: [], totalPoints: 0 }]),
  );
  for (const w of weeks) {
    for (const u of users) {
      const picks = pickRows.filter((r) => r.user_id === u.id && r.week === w);
      const points = picks.reduce((sum, p) => sum + (p.points || 0), 0);
      userMap.get(u.id).weekly.push({ week: w, points });
      userMap.get(u.id).totalPoints += points;
    }
  }

  const result = [...userMap.values()].sort((a, b) => b.totalPoints - a.totalPoints);
  return { season, seasonType, weeks, users: result };
}

/** One week's picks per member, for the summary email's grid. */
export async function buildWeekPickGrid(groupId, season, seasonType, week) {
  const users = await loadMembers(groupId);
  const { rows } = await pool.query(
    `SELECT p.*, g.status, g.home_team, g.away_team, g.home_score, g.away_score, g.game_date
     FROM user_picks p
     JOIN games g ON g.id = p.game_id
     WHERE p.group_id=$1 AND p.season=$2 AND p.season_type=$3 AND p.week=$4
     ORDER BY g.game_date ASC, g.id ASC`,
    [groupId, season, seasonType, week],
  );
  gradeRows(rows);

  const seen = new Map();
  for (const r of rows) {
    if (seen.has(r.game_id)) continue;
    const home = parseTeam(r.home_team);
    const away = parseTeam(r.away_team);
    seen.set(r.game_id, {
      gameId: r.game_id,
      homeAbbr: home.abbreviation,
      awayAbbr: away.abbreviation,
      homeScore: r.home_score,
      awayScore: r.away_score,
      status: r.status,
    });
  }

  const gridRows = users.map((u) => {
    const mine = rows.filter((r) => r.user_id === u.id);
    return {
      userId: u.id,
      name: u.name,
      picks: mine.map((r) => ({
        gameId: r.game_id,
        pickedTeamId: r.picked_team_id,
        confidence: r.confidence_level,
        won: r.won,
        points: r.points,
      })),
      weekPoints: mine.reduce((sum, r) => sum + (r.points || 0), 0),
    };
  });
  gridRows.sort((a, b) => b.weekPoints - a.weekPoints);

  return { games: [...seen.values()], rows: gridRows };
}
```

- [ ] **Step 4: Make the route a thin caller**

Replace the body of `GET /:identifier/scoreboard` in `backend/src/routes/picks.js` (everything between `ensureMembership` and the `res.json`) with:

```js
    const group = await ensureMembership(identifier, req.user.id);
    const board = await buildScoreboard(group.id, season, seasonType);
    res.json(board);
```

Add the import at the top of `picks.js`:

```js
import { buildScoreboard } from '../services/NflScoreboardService.js';
```

- [ ] **Step 5: Export `computeClosestWeek`**

Change `backend/src/routes/picks.js:22` from `async function computeClosestWeek(` to:

```js
// Exported so the email jobs resolve the same week the app does. DB-driven, not
// date-driven: the first week holding any non-FINAL game. Returns 0 when the
// season has no ingested games at all.
export async function computeClosestWeek(seasonYear, seasonType) {
```

- [ ] **Step 6: Run the new test and the existing suite**

Run: `cd backend && node --test tests/nfl-scoreboard-service.test.js && node --test tests/*.test.js`
Expected: the new file PASSES (4 tests) and **no existing test regresses** — the route tests are the safety net for this extraction.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/NflScoreboardService.js backend/src/routes/picks.js backend/tests/nfl-scoreboard-service.test.js
git commit -m "$(cat <<'EOF'
refactor(picks): extract the NFL scoreboard into a callable service

Standings lived inside the GET /scoreboard route closure, dependent on req/res
and unreachable from anything else — so the weekly summary email had no way to
render a leaderboard without duplicating the scoring rule. Two copies of a
scoring rule is how scoring bugs are born.

Moved verbatim: same queries, same in-memory grading, same sort, same response
shape. The route is now a thin caller and its existing tests are the safety
net. computeClosestWeek is exported for the same reason.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 7: Email templates

**Files:**
- Create: `backend/src/emails/layout.js`, `backend/src/emails/pickReminder.js`, `backend/src/emails/weeklySummary.js`
- Test: `backend/tests/email-templates.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `renderLayout({ heading, bodyHtml, unsubscribeUrl, footerNote })` → `string`
  - `pickReminder({ userName, groups, kickoffLabel, unsubscribeUrl, appUrl })` → `{ subject, html, text }` where `groups: Array<{ name, identifier, count }>`
  - `weeklySummary({ userName, groupName, week, grid, scoreboard, unsubscribeUrl, appUrl })` → `{ subject, html, text }`

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/email-templates.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pickReminder } from '../src/emails/pickReminder.js';
import { weeklySummary } from '../src/emails/weeklySummary.js';

const UNSUB = 'https://api.confidence-picks.com/api/email/unsubscribe?token=abc';

describe('pickReminder', () => {
  test('names one group and pluralises correctly', () => {
    const { subject, html, text } = pickReminder({
      userName: 'Ann',
      groups: [{ name: 'Sunday Squad', identifier: 'sunday-squad', count: 1 }],
      kickoffLabel: '1:00 PM ET',
      unsubscribeUrl: UNSUB,
      appUrl: 'https://www.confidence-picks.com',
    });
    assert.match(subject, /1 pick/);
    assert.ok(!subject.includes('1 picks'));
    assert.match(html, /Sunday Squad/);
    assert.match(html, /1:00 PM ET/);
    assert.ok(html.includes(UNSUB), 'every email must carry its unsubscribe link');
    assert.match(text, /Sunday Squad/);
  });

  test('sums across several groups in the subject', () => {
    const { subject, html } = pickReminder({
      userName: 'Ann',
      groups: [
        { name: 'Sunday Squad', identifier: 'a', count: 3 },
        { name: 'Work Pool', identifier: 'b', count: 2 },
      ],
      kickoffLabel: '1:00 PM ET',
      unsubscribeUrl: UNSUB,
      appUrl: 'https://www.confidence-picks.com',
    });
    assert.match(subject, /5 picks/);
    assert.match(html, /Work Pool/);
  });

  test('escapes HTML in a group name', () => {
    const { html } = pickReminder({
      userName: 'Ann',
      groups: [{ name: '<script>alert(1)</script>', identifier: 'x', count: 1 }],
      kickoffLabel: '1:00 PM ET',
      unsubscribeUrl: UNSUB,
      appUrl: 'https://www.confidence-picks.com',
    });
    assert.ok(!html.includes('<script>'), 'group names are user input and must be escaped');
    assert.match(html, /&lt;script&gt;/);
  });
});

describe('weeklySummary', () => {
  const grid = {
    games: [{ gameId: 1, homeAbbr: 'SF', awayAbbr: 'LAR', homeScore: 20, awayScore: 10, status: 'FINAL' }],
    rows: [{ userId: 1, name: 'Ann', picks: [{ gameId: 1, pickedTeamId: '1', confidence: 5, won: true, points: 5 }], weekPoints: 5 }],
  };
  const scoreboard = {
    season: 2026, seasonType: 2, weeks: [1],
    users: [{ userId: 1, name: 'Ann', pictureUrl: null, weekly: [{ week: 1, points: 5 }], totalPoints: 5 }],
  };

  test('renders the week, the grid and the standings', () => {
    const { subject, html, text } = weeklySummary({
      userName: 'Ann', groupName: 'Sunday Squad', week: 1,
      grid, scoreboard, unsubscribeUrl: UNSUB, appUrl: 'https://www.confidence-picks.com',
    });
    assert.match(subject, /Week 1/);
    assert.match(subject, /Sunday Squad/);
    assert.match(html, /SF/);
    assert.match(html, /Ann/);
    assert.ok(html.includes(UNSUB));
    assert.match(text, /Week 1/);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/email-templates.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `layout.js`**

```js
// backend/src/emails/layout.js
// Email HTML is not web HTML: no external stylesheets, no remote images, inline
// styles only, table-based layout, 600px max. Clients strip <style> blocks and
// block remote assets by default.

/** Escape user-supplied text. Group names and display names are user input. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function renderLayout({ heading, bodyHtml, unsubscribeUrl, footerNote }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border:1px solid #e7e5e4;">
      <tr><td style="padding:24px 24px 8px 24px;font-family:${FONT};">
        <h1 style="margin:0;font-size:20px;line-height:1.3;color:#1c1917;">${esc(heading)}</h1>
      </td></tr>
      <tr><td style="padding:8px 24px 24px 24px;font-family:${FONT};font-size:14px;line-height:1.5;color:#292524;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #e7e5e4;font-family:${FONT};font-size:12px;line-height:1.5;color:#78716c;">
        ${footerNote ? `<p style="margin:0 0 8px 0;">${esc(footerNote)}</p>` : ''}
        <p style="margin:0;">
          <a href="${unsubscribeUrl}" style="color:#78716c;">Unsubscribe from these emails</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
```

- [ ] **Step 4: Write `pickReminder.js`**

```js
// backend/src/emails/pickReminder.js
import { renderLayout, esc } from './layout.js';

/**
 * One email per user per Eastern day, covering every opted-in group where they
 * still owe a pick on today's slate.
 */
export function pickReminder({ userName, groups, kickoffLabel, unsubscribeUrl, appUrl }) {
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  const noun = total === 1 ? 'pick' : 'picks';
  const subject = `You have ${total} ${noun} to make before ${kickoffLabel}`;

  const items = groups
    .map(
      (g) => `<li style="margin:0 0 8px 0;">
        <a href="${appUrl}/games?groupId=${encodeURIComponent(g.identifier)}" style="color:#1d4ed8;font-weight:600;">${esc(g.name)}</a>
        — ${g.count} ${g.count === 1 ? 'pick' : 'picks'} left
      </li>`,
    )
    .join('');

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${esc(userName)}, today's games start at <strong>${esc(kickoffLabel)}</strong>.</p>
    <ul style="margin:0 0 16px 0;padding-left:20px;">${items}</ul>
    <p style="margin:0;color:#78716c;">Picks lock at each game's kickoff.</p>`;

  const text = [
    `Hi ${userName}, today's games start at ${kickoffLabel}.`,
    '',
    ...groups.map((g) => `- ${g.name}: ${g.count} ${g.count === 1 ? 'pick' : 'picks'} left — ${appUrl}/games?groupId=${g.identifier}`),
    '',
    "Picks lock at each game's kickoff.",
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return {
    subject,
    html: renderLayout({
      heading: `${total} ${noun} to make today`,
      bodyHtml,
      unsubscribeUrl,
      footerNote: 'You get this because you turned on pick reminders for these groups.',
    }),
    text,
  };
}
```

- [ ] **Step 5: Write `weeklySummary.js`**

```js
// backend/src/emails/weeklySummary.js
import { renderLayout, esc } from './layout.js';

const CELL = 'padding:6px 8px;border-bottom:1px solid #e7e5e4;font-size:13px;';
const HEAD = 'padding:6px 8px;border-bottom:2px solid #d6d3d1;font-size:12px;text-align:left;color:#57534e;';

function resultsTable(games) {
  const rows = games
    .map(
      (g) => `<tr>
        <td style="${CELL}">${esc(g.awayAbbr)} @ ${esc(g.homeAbbr)}</td>
        <td style="${CELL}text-align:right;">${g.awayScore}–${g.homeScore}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
    <tr><th style="${HEAD}">Game</th><th style="${HEAD}text-align:right;">Final</th></tr>
    ${rows}
  </table>`;
}

function standingsTable(scoreboard, week) {
  const rows = scoreboard.users
    .map((u, i) => {
      const thisWeek = u.weekly.find((w) => w.week === week);
      return `<tr>
        <td style="${CELL}width:28px;color:#78716c;">${i + 1}</td>
        <td style="${CELL}">${esc(u.name)}</td>
        <td style="${CELL}text-align:right;">${thisWeek ? thisWeek.points : 0}</td>
        <td style="${CELL}text-align:right;font-weight:600;">${u.totalPoints}</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
    <tr>
      <th style="${HEAD}"></th><th style="${HEAD}">Member</th>
      <th style="${HEAD}text-align:right;">Week</th><th style="${HEAD}text-align:right;">Total</th>
    </tr>
    ${rows}
  </table>`;
}

function weekTable(grid) {
  const rows = grid.rows
    .map(
      (r) => `<tr>
        <td style="${CELL}">${esc(r.name)}</td>
        <td style="${CELL}text-align:right;">${r.picks.filter((p) => p.won === true).length}/${r.picks.length}</td>
        <td style="${CELL}text-align:right;font-weight:600;">${r.weekPoints}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
    <tr>
      <th style="${HEAD}">Member</th><th style="${HEAD}text-align:right;">Correct</th>
      <th style="${HEAD}text-align:right;">Points</th>
    </tr>
    ${rows}
  </table>`;
}

/** One email per group, for members who opted into summaries. */
export function weeklySummary({ userName, groupName, week, grid, scoreboard, unsubscribeUrl, appUrl }) {
  const subject = `${groupName}: Week ${week} results`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${esc(userName)}, here's how Week ${week} finished.</p>
    <h2 style="margin:0 0 8px 0;font-size:15px;color:#1c1917;">How everyone did</h2>
    ${weekTable(grid)}
    <h2 style="margin:0 0 8px 0;font-size:15px;color:#1c1917;">Standings</h2>
    ${standingsTable(scoreboard, week)}
    <h2 style="margin:0 0 8px 0;font-size:15px;color:#1c1917;">Results</h2>
    ${resultsTable(grid.games)}
    <p style="margin:0;"><a href="${appUrl}/groups" style="color:#1d4ed8;font-weight:600;">Open ${esc(groupName)}</a></p>`;

  const text = [
    `Hi ${userName}, here's how Week ${week} finished in ${groupName}.`,
    '',
    'How everyone did:',
    ...grid.rows.map((r) => `- ${r.name}: ${r.picks.filter((p) => p.won === true).length}/${r.picks.length} correct, ${r.weekPoints} pts`),
    '',
    'Standings:',
    ...scoreboard.users.map((u, i) => `${i + 1}. ${u.name} — ${u.totalPoints} pts`),
    '',
    `${appUrl}/groups`,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return {
    subject,
    html: renderLayout({
      heading: `Week ${week} results`,
      bodyHtml,
      unsubscribeUrl,
      footerNote: `You get this because you turned on weekly summaries for ${groupName}.`,
    }),
    text,
  };
}
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `cd backend && node --test tests/email-templates.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add backend/src/emails backend/tests/email-templates.test.js
git commit -m "$(cat <<'EOF'
feat(email): pick reminder and weekly summary templates

Table layout, inline styles, no remote assets — email clients strip <style>
blocks and block remote images, so this is a requirement rather than a
stylistic choice. Group and member names are escaped: they are user input and
land in an HTML document.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 8: The pick-reminder job

**Files:**
- Create: `backend/src/services/NflEmailJobs.js`
- Test: `backend/tests/nfl-reminder-job.test.js`

**Interfaces:**
- Consumes: `etDateKey` (Task 4), `isPickLocked`, `createEmailService` (Task 5), `EmailSend`/`EMAIL_TYPES` (Task 3), `signUnsubscribe` (Task 4), `pickReminder` (Task 7), `computeClosestWeek` (Task 6).
- Produces: `runPickReminders({ now, deps })` → `Promise<{ sent: number, reason?: string }>` where `deps = { pool, gameService, computeClosestWeek, emailService, emailSend, season, seasonType, appUrl, apiUrl? }`. `apiUrl` defaults to `appUrl`.
- Also produces `REMINDER_WINDOW_MS = 4 * 60 * 60 * 1000`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/nfl-reminder-job.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runPickReminders, REMINDER_WINDOW_MS } from '../src/services/NflEmailJobs.js';

process.env.EMAIL_TOKEN_SECRET = 'test-secret';

const KICKOFF = new Date('2026-09-20T17:00:00Z'); // Sun 1:00 PM ET

function game(id, date, status = 'SCHEDULED') {
  return { id, gameDate: date, status, postponed: false };
}

/** deps double: one group, one member, one unpicked game. */
function makeDeps({ candidates, completed = [], sent = [] }) {
  return {
    pool: {
      query: async (sql) => {
        if (sql.includes('email_reminders')) return { rows: candidates };
        if (sql.includes('user_picks')) return { rows: completed };
        return { rows: [] };
      },
    },
    gameService: { getGamesForWeek: async () => [game(1, KICKOFF), game(2, KICKOFF)] },
    computeClosestWeek: async () => 3,
    emailService: {
      send: async (m) => { sent.push(m); return { id: 'msg-1' }; },
    },
    emailSend: {
      claim: async () => 1,
      markSent: async () => {},
      markFailed: async () => {},
    },
    season: 2026,
    seasonType: 2,
    appUrl: 'https://www.confidence-picks.com',
  };
}

const CANDIDATE = {
  user_id: 1, name: 'Ann', email: 'ann@example.com',
  group_id: 9, group_name: 'Sunday Squad', identifier: 'sunday-squad',
};

describe('runPickReminders', () => {
  test('sends inside the 4-hour window', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });
    const now = new Date(KICKOFF.getTime() - 3 * 60 * 60 * 1000);

    const res = await runPickReminders({ now, deps });

    assert.equal(res.sent, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'ann@example.com');
    assert.match(sent[0].subject, /2 picks/);
  });

  test('does nothing more than 4 hours out', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });
    const now = new Date(KICKOFF.getTime() - REMINDER_WINDOW_MS - 60_000);

    const res = await runPickReminders({ now, deps });
    assert.equal(res.sent, 0);
    assert.equal(sent.length, 0);
  });

  test('does nothing once the first game has kicked off', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });
    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() + 1000), deps });
    assert.equal(res.sent, 0);
  });

  test('a member with every pick in gets nothing', async () => {
    const sent = [];
    const deps = makeDeps({
      candidates: [CANDIDATE], sent,
      completed: [
        { user_id: 1, group_id: 9, game_id: 1 },
        { user_id: 1, group_id: 9, game_id: 2 },
      ],
    });
    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });
    assert.equal(res.sent, 0);
    assert.equal(sent.length, 0);
  });

  test('a second run the same day is a no-op (claim returns null)', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });
    deps.emailSend.claim = async () => null;
    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });
    assert.equal(res.sent, 0);
    assert.equal(sent.length, 0, 'must not send when the claim was already taken');
  });

  test('one email covers several groups', async () => {
    const sent = [];
    const deps = makeDeps({
      candidates: [
        CANDIDATE,
        { ...CANDIDATE, group_id: 10, group_name: 'Work Pool', identifier: 'work-pool' },
      ],
      sent,
    });
    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });
    assert.equal(res.sent, 1, 'batched per user, not per group');
    assert.match(sent[0].subject, /4 picks/);
  });

  test('marks the claim failed when the provider throws', async () => {
    let failed = null;
    const deps = makeDeps({ candidates: [CANDIDATE] });
    deps.emailService.send = async () => { throw new Error('provider down'); };
    deps.emailSend.markFailed = async (id, msg) => { failed = { id, msg }; };

    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });
    assert.equal(res.sent, 0);
    assert.match(failed.msg, /provider down/);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/nfl-reminder-job.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the job**

```js
// backend/src/services/NflEmailJobs.js
import { etDateKey, etHour, NFL_TIME_ZONE } from '../utils/etTime.js';
import { isPickLocked } from '../utils/pickLock.js';
import { signUnsubscribe } from '../utils/emailTokens.js';
import { EMAIL_TYPES } from '../models/EmailSend.js';
import { pickReminder } from '../emails/pickReminder.js';

export const REMINDER_WINDOW_MS = 4 * 60 * 60 * 1000;

const KICKOFF_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: NFL_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true,
});

function kickoffLabel(date) {
  return `${KICKOFF_FMT.format(date)} ET`;
}

function unsubscribeUrl(apiUrl, { userId, groupId, type }) {
  return `${apiUrl}/api/email/unsubscribe?token=${signUnsubscribe({ userId, groupId, type })}`;
}

/**
 * "You have picks to make today" — one email per user per Eastern day, fired by
 * the hourly cron when the day's first kickoff is 4 hours out or less.
 *
 * Window-based rather than exact-time: a scheduled Action can fire 5-30 minutes
 * late, which narrows the window instead of missing the moment entirely.
 */
export async function runPickReminders({ now = new Date(), deps }) {
  const {
    pool, gameService, computeClosestWeek, emailService, emailSend,
    season, seasonType, appUrl, apiUrl = appUrl,
  } = deps;

  const week = await computeClosestWeek(season, seasonType);
  const games = await gameService.getGamesForWeek(season, seasonType, week, false);

  const todayKey = etDateKey(now);
  const todays = games.filter(
    (g) => etDateKey(new Date(g.gameDate)) === todayKey && !isPickLocked(g, now.getTime()),
  );
  if (todays.length === 0) return { sent: 0, reason: 'no-open-games-today' };

  const firstKickoff = Math.min(...todays.map((g) => new Date(g.gameDate).getTime()));
  const msOut = firstKickoff - now.getTime();
  if (msOut <= 0 || msOut > REMINDER_WINDOW_MS) return { sent: 0, reason: 'outside-window' };

  // Opted-in members of NFL groups who are not globally paused.
  const { rows: candidates } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email,
            g.id AS group_id, g.name AS group_name, g.identifier
     FROM group_memberships gm
     JOIN users u ON u.id = gm.user_id
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.email_reminders = true
       AND u.email_paused_at IS NULL
       AND g.pool_type = 'nfl_weekly'`,
  );
  if (candidates.length === 0) return { sent: 0, reason: 'no-subscribers' };

  const gameIds = todays.map((g) => g.id);
  const groupIds = [...new Set(candidates.map((c) => c.group_id))];

  // A pick counts as MADE only when both columns are set. clearPending writes
  // NULL rows rather than deleting, so an EXISTS test would silently skip the
  // members who cleared a pick — exactly the people who need the reminder.
  const { rows: completed } = await pool.query(
    `SELECT user_id, group_id, game_id FROM user_picks
     WHERE group_id = ANY($1) AND game_id = ANY($2)
       AND picked_team_id IS NOT NULL AND confidence_level IS NOT NULL`,
    [groupIds, gameIds],
  );
  const done = new Set(completed.map((r) => `${r.user_id}:${r.group_id}:${r.game_id}`));

  // Fold (user, group) rows into one entry per user.
  const byUser = new Map();
  for (const c of candidates) {
    const outstanding = gameIds.filter((gid) => !done.has(`${c.user_id}:${c.group_id}:${gid}`)).length;
    if (outstanding === 0) continue;
    if (!byUser.has(c.user_id)) {
      byUser.set(c.user_id, { userId: c.user_id, name: c.name, email: c.email, groups: [] });
    }
    byUser.get(c.user_id).groups.push({ name: c.group_name, identifier: c.identifier, count: outstanding });
  }

  const label = kickoffLabel(new Date(firstKickoff));
  const dedupeKey = `reminder:${todayKey}`;
  let sent = 0;

  for (const user of byUser.values()) {
    // Claim BEFORE sending. At-most-once by construction.
    const claimId = await emailSend.claim({
      userId: user.userId, groupId: null,
      emailType: EMAIL_TYPES.REMINDER, dedupeKey,
    });
    if (claimId === null) continue; // already sent today

    const unsub = unsubscribeUrl(apiUrl, {
      userId: user.userId, groupId: null, type: EMAIL_TYPES.REMINDER,
    });
    const { subject, html, text } = pickReminder({
      userName: user.name, groups: user.groups, kickoffLabel: label,
      unsubscribeUrl: unsub, appUrl,
    });

    try {
      const res = await emailService.send({
        to: user.email, subject, html, text,
        unsubscribeUrl: unsub,
        idempotencyKey: `${dedupeKey}:${user.userId}`,
      });
      await emailSend.markSent(claimId, res.id);
      if (!res.skipped) sent += 1;
    } catch (err) {
      await emailSend.markFailed(claimId, err.message);
    }
  }

  return { sent };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && node --test tests/nfl-reminder-job.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/NflEmailJobs.js backend/tests/nfl-reminder-job.test.js
git commit -m "$(cat <<'EOF'
feat(email): the daily pick-reminder job

Window-based rather than exact-time: a scheduled Action can fire half an hour
late, which should narrow the window rather than miss the send. Batched per
user, so a member of five groups gets one email instead of five.

Counts a pick as made only when both picked_team_id and confidence_level are
set — clearPending leaves NULL rows behind, and an EXISTS test would skip the
members who cleared a pick.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 9: The weekly-summary job

**Files:**
- Modify: `backend/src/services/NflEmailJobs.js`
- Test: `backend/tests/nfl-summary-job.test.js`

**Interfaces:**
- Consumes: everything Task 8 consumes, plus `buildScoreboard` / `buildWeekPickGrid` (Task 6) and `weeklySummary` (Task 7).
- Produces: `runWeeklySummaries({ now, deps })` → `Promise<{ sent: number, reason?: string }>`. `deps` adds `buildScoreboard`, `buildWeekPickGrid`.
- Also produces `SUMMARY_SEND_HOUR_ET = 8`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/nfl-summary-job.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runWeeklySummaries } from '../src/services/NflEmailJobs.js';

process.env.EMAIL_TOKEN_SECRET = 'test-secret';

const TUES_8AM_ET = new Date('2026-09-22T12:00:00Z');
const TUES_2PM_ET = new Date('2026-09-22T18:00:00Z');

const SUBSCRIBER = {
  user_id: 1, name: 'Ann', email: 'ann@example.com',
  group_id: 9, group_name: 'Sunday Squad', identifier: 'sunday-squad',
};

function makeDeps({ weekRows, subscribers, sent = [] }) {
  return {
    pool: {
      query: async (sql) => {
        if (sql.includes('FILTER')) return { rows: weekRows };
        if (sql.includes('email_summaries')) return { rows: subscribers };
        return { rows: [] };
      },
    },
    buildScoreboard: async () => ({
      season: 2026, seasonType: 2, weeks: [3],
      users: [{ userId: 1, name: 'Ann', pictureUrl: null, weekly: [{ week: 3, points: 5 }], totalPoints: 5 }],
    }),
    buildWeekPickGrid: async () => ({
      games: [{ gameId: 1, homeAbbr: 'SF', awayAbbr: 'LAR', homeScore: 20, awayScore: 10, status: 'FINAL' }],
      rows: [{ userId: 1, name: 'Ann', picks: [{ gameId: 1, pickedTeamId: '1', confidence: 5, won: true, points: 5 }], weekPoints: 5 }],
    }),
    emailService: { send: async (m) => { sent.push(m); return { id: 'msg-1' }; } },
    emailSend: { claim: async () => 1, markSent: async () => {}, markFailed: async () => {} },
    season: 2026, seasonType: 2,
    appUrl: 'https://www.confidence-picks.com',
  };
}

const COMPLETE_WEEK = [{ week: 3, total: '16', final_count: '16' }];

describe('runWeeklySummaries', () => {
  test('sends in the 8am ET hour for a fully final week', async () => {
    const sent = [];
    const deps = makeDeps({ weekRows: COMPLETE_WEEK, subscribers: [SUBSCRIBER], sent });
    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });
    assert.equal(res.sent, 1);
    assert.match(sent[0].subject, /Week 3/);
    assert.match(sent[0].subject, /Sunday Squad/);
  });

  test('does nothing outside the 8am ET hour', async () => {
    const sent = [];
    const deps = makeDeps({ weekRows: COMPLETE_WEEK, subscribers: [SUBSCRIBER], sent });
    const res = await runWeeklySummaries({ now: TUES_2PM_ET, deps });
    assert.equal(res.sent, 0);
    assert.equal(res.reason, 'not-send-hour');
  });

  test('does nothing while any game is unfinished', async () => {
    const sent = [];
    const deps = makeDeps({
      weekRows: [{ week: 3, total: '16', final_count: '15' }],
      subscribers: [SUBSCRIBER], sent,
    });
    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });
    assert.equal(res.sent, 0);
    assert.equal(res.reason, 'no-completed-week');
  });

  test('a second run for the same week is a no-op', async () => {
    const sent = [];
    const deps = makeDeps({ weekRows: COMPLETE_WEEK, subscribers: [SUBSCRIBER], sent });
    deps.emailSend.claim = async () => null;
    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });
    assert.equal(res.sent, 0);
    assert.equal(sent.length, 0);
  });

  test('sends one email per group, not one per user', async () => {
    const sent = [];
    const deps = makeDeps({
      weekRows: COMPLETE_WEEK,
      subscribers: [
        SUBSCRIBER,
        { ...SUBSCRIBER, group_id: 10, group_name: 'Work Pool', identifier: 'work-pool' },
      ],
      sent,
    });
    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });
    assert.equal(res.sent, 2);
    assert.deepEqual(sent.map((m) => m.subject).sort(), [
      'Sunday Squad: Week 3 results',
      'Work Pool: Week 3 results',
    ]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/nfl-summary-job.test.js`
Expected: FAIL — `runWeeklySummaries is not a function`.

- [ ] **Step 3: Append the job to `NflEmailJobs.js`**

Add the import at the top of the file:

```js
import { weeklySummary } from '../emails/weeklySummary.js';
```

and append:

```js
export const SUMMARY_SEND_HOUR_ET = 8;

/**
 * The week-in-review email, one per group.
 *
 * "The morning after the last game" is derived, not hardcoded to a weekday: the
 * most recent week whose games are ALL final, sent in the 8am ET hour. That
 * handles Saturday-heavy weeks, flexed games and Tuesday postponement makeups
 * without a special case. Only the most recent such week is considered, so the
 * job never backfills history; the claim row stops it re-sending.
 */
export async function runWeeklySummaries({ now = new Date(), deps }) {
  const {
    pool, buildScoreboard, buildWeekPickGrid, emailService, emailSend,
    season, seasonType, appUrl, apiUrl = appUrl,
  } = deps;

  if (etHour(now) !== SUMMARY_SEND_HOUR_ET) return { sent: 0, reason: 'not-send-hour' };

  const { rows: weekRows } = await pool.query(
    `SELECT week, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'FINAL') AS final_count
     FROM games
     WHERE season = $1 AND season_type = $2 AND league = 'nfl'
     GROUP BY week ORDER BY week DESC`,
    [season, seasonType],
  );
  const complete = weekRows.find(
    (r) => Number(r.total) > 0 && Number(r.total) === Number(r.final_count),
  );
  if (!complete) return { sent: 0, reason: 'no-completed-week' };
  const week = Number(complete.week);

  const { rows: subscribers } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email,
            g.id AS group_id, g.name AS group_name, g.identifier
     FROM group_memberships gm
     JOIN users u ON u.id = gm.user_id
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.email_summaries = true
       AND u.email_paused_at IS NULL
       AND g.pool_type = 'nfl_weekly'`,
  );
  if (subscribers.length === 0) return { sent: 0, reason: 'no-subscribers' };

  // Group members together so the scoreboard is computed once per group, not
  // once per recipient.
  const byGroup = new Map();
  for (const s of subscribers) {
    if (!byGroup.has(s.group_id)) {
      byGroup.set(s.group_id, { groupId: s.group_id, name: s.group_name, identifier: s.identifier, members: [] });
    }
    byGroup.get(s.group_id).members.push({ userId: s.user_id, name: s.name, email: s.email });
  }

  let sent = 0;
  for (const group of byGroup.values()) {
    const [scoreboard, grid] = await Promise.all([
      buildScoreboard(group.groupId, season, seasonType),
      buildWeekPickGrid(group.groupId, season, seasonType, week),
    ]);
    const dedupeKey = `summary:${group.groupId}:${season}:${seasonType}:${week}`;

    for (const member of group.members) {
      const claimId = await emailSend.claim({
        userId: member.userId, groupId: group.groupId,
        emailType: EMAIL_TYPES.SUMMARY, dedupeKey,
      });
      if (claimId === null) continue;

      const unsub = unsubscribeUrl(apiUrl, {
        userId: member.userId, groupId: group.groupId, type: EMAIL_TYPES.SUMMARY,
      });
      const { subject, html, text } = weeklySummary({
        userName: member.name, groupName: group.name, week,
        grid, scoreboard, unsubscribeUrl: unsub, appUrl,
      });

      try {
        const res = await emailService.send({
          to: member.email, subject, html, text,
          unsubscribeUrl: unsub,
          idempotencyKey: `${dedupeKey}:${member.userId}`,
        });
        await emailSend.markSent(claimId, res.id);
        if (!res.skipped) sent += 1;
      } catch (err) {
        await emailSend.markFailed(claimId, err.message);
      }
    }
  }

  return { sent };
}
```

- [ ] **Step 4: Run both job test files**

Run: `cd backend && node --test tests/nfl-summary-job.test.js tests/nfl-reminder-job.test.js`
Expected: PASS, 12 tests total.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/NflEmailJobs.js backend/tests/nfl-summary-job.test.js
git commit -m "$(cat <<'EOF'
feat(email): the weekly summary job

"The morning after the last game" is derived rather than pinned to a weekday:
the most recent week whose games are all final, sent in the 8am ET hour. That
covers Saturday-heavy weeks, flex scheduling and Tuesday makeups without a
special case, and taking only the most recent complete week means it never
backfills history.

Scoreboard is computed once per group rather than once per recipient.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 10: The CLI entry point

**Files:**
- Create: `backend/src/scripts/sendNflEmails.js`
- Modify: `backend/package.json` (scripts)

**Interfaces:**
- Consumes: `runPickReminders`, `runWeeklySummaries`, `createEmailService`, `EmailSend`, `buildScoreboard`, `buildWeekPickGrid`, `computeClosestWeek`, `GameService`, `getCurrentNFLSeason`.
- Produces: `pnpm run email:send` — exit 0 on success, 1 on failure.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * Send NFL pick reminders and weekly summaries.
 *
 * Runs hourly from .github/workflows/nfl-emails.yml. Both jobs are cheap no-ops
 * outside their windows, so an hourly invocation is the whole schedule.
 *
 * Environment variables:
 *  RESEND_API_KEY       required to actually send
 *  EMAIL_TOKEN_SECRET   required — signs unsubscribe links
 *  EMAIL_FROM           e.g. "Confidence Picks <noreply@confidence-picks.com>"
 *  EMAIL_REPLY_TO       e.g. hello@noetalabs.tech
 *  EMAIL_DRY_RUN        defaults TRUE; only the literal 'false' enables sending
 *  EMAIL_MAX_PER_RUN    defaults 80
 *  FRONTEND_BASE_URL    links in emails point here
 *  API_BASE_URL         unsubscribe links point here
 *
 * Exit codes: 0 success, 1 failure.
 */
import '../config/database.js'; // loads env + pool listeners
import pool from '../config/database.js';
import { GameService } from '../services/GameService.js';
import { getCurrentNFLSeason } from '../utils/nflSeasonUtils.js';
import { computeClosestWeek } from '../routes/picks.js';
import { buildScoreboard, buildWeekPickGrid } from '../services/NflScoreboardService.js';
import { createEmailService } from '../services/EmailService.js';
import { EmailSend } from '../models/EmailSend.js';
import { runPickReminders, runWeeklySummaries } from '../services/NflEmailJobs.js';

async function main() {
  const emailService = createEmailService();
  if (emailService.dryRun) {
    console.log('[email] DRY RUN — no mail will be sent. Set EMAIL_DRY_RUN=false to send.');
  }

  await EmailSend.ensureSchema();

  const deps = {
    pool,
    gameService: GameService,
    computeClosestWeek,
    buildScoreboard,
    buildWeekPickGrid,
    emailService,
    emailSend: EmailSend,
    season: getCurrentNFLSeason(),
    seasonType: 2,
    appUrl: process.env.FRONTEND_BASE_URL || 'https://www.confidence-picks.com',
    apiUrl: process.env.API_BASE_URL || 'https://api.confidence-picks.com',
  };

  const now = new Date();
  const reminders = await runPickReminders({ now, deps });
  console.log(`[email] reminders: sent=${reminders.sent}${reminders.reason ? ` reason=${reminders.reason}` : ''}`);

  const summaries = await runWeeklySummaries({ now, deps });
  console.log(`[email] summaries: sent=${summaries.sent}${summaries.reason ? ` reason=${summaries.reason}` : ''}`);

  console.log(`[email] total sent this run: ${emailService.sentCount}`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Email send failed', err);
    pool.end(() => process.exit(1));
  });
```

- [ ] **Step 2: Add the package script**

In `backend/package.json`, beside `"cleanup:invites"`:

```json
    "email:send": "node src/scripts/sendNflEmails.js",
```

- [ ] **Step 3: Run it locally in dry-run mode**

Run: `cd backend && envchain confidence-picks pnpm run email:send`
Expected: exits 0, prints `[email] DRY RUN`, then a `reminders:` line and a `summaries:` line. Outside a game window both report `sent=0` with a reason — that is success, not failure.

- [ ] **Step 4: Verify it fails loudly without the token secret**

Run: `cd backend && EMAIL_TOKEN_SECRET= node src/scripts/sendNflEmails.js`
Expected: either a clean `sent=0` (no window, so no token is signed) or a non-zero exit naming `EMAIL_TOKEN_SECRET`. It must never exit 0 having silently skipped a send it should have made.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/sendNflEmails.js backend/package.json
git commit -m "$(cat <<'EOF'
feat(email): CLI entry point for the hourly email run

Follows cleanupInvites.js: shebang, shared pool, main(), pool.end(), non-zero
exit on failure. Both jobs are cheap no-ops outside their windows, so a single
hourly invocation is the entire schedule.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 11: Preference and pause routes

**Files:**
- Modify: `backend/src/routes/groups.js`, `backend/src/routes/auth.js`
- Test: `backend/tests/email-prefs-routes.test.js`

**Interfaces:**
- Consumes: `Group.setEmailPrefs`, `User.setEmailPaused` (Task 2).
- Produces:
  - `POST /api/groups/:identifier/email-prefs` → `{ emailReminders, emailSummaries }`; 403 for a non-member, 400 for an empty body.
  - `POST /auth/me/email-pause` → `{ emailPausedAt }`.

- [ ] **Step 1: Write the failing test**

> **Harness note:** this repo has **no `supertest`**. Route tests mount the one
> router under test on a bare Express app, `listen(0)`, and drive it with
> `fetch` — see `backend/tests/dues-routes.test.js`. Follow that exactly.

```js
// backend/tests/email-prefs-routes.test.js
import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import groupsRouter from '../src/routes/groups.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';

const AUTH_HEADER = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

describe('email preference routes', () => {
  let server;
  let baseURL;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/groups', groupsRouter);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    mock.method(AuthService, 'verifyAccessToken', () => ({ userId: 1 }));
    mock.method(User, 'findById', async () => ({ id: 1, name: 'Ann', email: 'ann@example.com' }));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  function postPrefs(body) {
    return fetch(`${baseURL}/api/groups/sunday-squad/email-prefs`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify(body),
    });
  }

  test('rejects an unauthenticated request', async () => {
    const res = await fetch(`${baseURL}/api/groups/sunday-squad/email-prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailReminders: true }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('a member updates their own preferences', async () => {
    mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({
      emailReminders: true, emailSummaries: false,
    }));

    const res = await postPrefs({ emailReminders: true });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { emailReminders: true, emailSummaries: false });
    const [groupId, userId] = setPrefs.mock.calls[0].arguments;
    assert.strictEqual(groupId, 9);
    assert.strictEqual(userId, 1);
  });

  test('a non-member gets 403 and the model is never called', async () => {
    mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: null }));
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({}));
    const res = await postPrefs({ emailReminders: true });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(setPrefs.mock.calls.length, 0);
  });

  test('a missing group gets 404', async () => {
    mock.method(Group, 'findByIdentifier', async () => null);
    const res = await postPrefs({ emailReminders: true });
    assert.strictEqual(res.status, 404);
  });

  test('a body with no boolean fields gets 400 before any lookup', async () => {
    const find = mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
    const res = await postPrefs({ emailReminders: 'yes' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(find.mock.calls.length, 0, 'validate before touching the DB');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/email-prefs-routes.test.js`
Expected: FAIL — 404, route not mounted.

- [ ] **Step 3: Add the group route**

In `backend/src/routes/groups.js`, beside `POST /:identifier/messages/read`:

```js
// Set the CALLING member's own email preferences. Member-scoped on purpose:
// every member owns their own inbox, so there is no admin path to this and no
// :userId in the URL.
router.post('/:identifier/email-prefs', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const { emailReminders, emailSummaries } = req.body;

    if (typeof emailReminders !== 'boolean' && typeof emailSummaries !== 'boolean') {
      return res.status(400).json({
        error: 'Body must include a boolean "emailReminders" and/or "emailSummaries"',
      });
    }

    const group = await Group.findByIdentifier(identifier, req.user.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!group.userRole) {
      return res.status(403).json({ error: 'Must be a group member to set email preferences' });
    }

    const prefs = await Group.setEmailPrefs(group.id, req.user.id, { emailReminders, emailSummaries });
    res.json(prefs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 4: Add the pause route**

In `backend/src/routes/auth.js`, beside the `/me` handler:

```js
// Global email kill switch. Overrides every per-group preference — the single
// honest off switch, and the safety valve if a send ever misfires.
router.post('/me/email-pause', authenticateToken, async (req, res) => {
  try {
    const { paused } = req.body;
    if (typeof paused !== 'boolean') {
      return res.status(400).json({ error: 'Body must include a boolean "paused" field' });
    }
    const result = await User.setEmailPaused(req.user.id, paused);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

Make sure `authenticateToken` and `User` are imported in `auth.js`; add whichever is missing.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `cd backend && node --test tests/email-prefs-routes.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/groups.js backend/src/routes/auth.js backend/tests/email-prefs-routes.test.js
git commit -m "$(cat <<'EOF'
feat(email): member-scoped preference routes and a global pause

No :userId in the preferences URL and no admin branch: every member owns their
own inbox, so there is deliberately no path for someone else to subscribe them.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 12: Public unsubscribe routes

**Files:**
- Create: `backend/src/routes/email.js`
- Modify: `backend/src/app.js` (mount)
- Test: `backend/tests/email-unsubscribe-route.test.js`

**Interfaces:**
- Consumes: `verifyUnsubscribe` (Task 4), `Group.setEmailPrefs` (Task 2).
- Produces: `GET /api/email/unsubscribe?token=…` → 200 HTML; `POST /api/email/unsubscribe` → 200 JSON. Both **unauthenticated** — the token is the credential.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/email-unsubscribe-route.test.js
import { test, describe, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';

process.env.EMAIL_TOKEN_SECRET = 'test-secret';

const { default: emailRouter } = await import('../src/routes/email.js');
const { Group } = await import('../src/models/Group.js');
const { User } = await import('../src/models/User.js');
const { signUnsubscribe } = await import('../src/utils/emailTokens.js');

describe('unsubscribe routes', () => {
  let server;
  let baseURL;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/email', emailRouter);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test('GET with a valid token turns that preference off, with no auth header', async () => {
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({
      emailReminders: false, emailSummaries: true,
    }));

    const token = signUnsubscribe({ userId: 3, groupId: 9, type: 'pick_reminder' });
    const res = await fetch(`${baseURL}/api/email/unsubscribe?token=${token}`);

    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type'), /html/);
    const [groupId, userId, prefs] = setPrefs.mock.calls[0].arguments;
    assert.strictEqual(groupId, 9);
    assert.strictEqual(userId, 3);
    assert.deepStrictEqual(prefs, { emailReminders: false });
  });

  test('a summary token turns off summaries, not reminders', async () => {
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({}));
    const token = signUnsubscribe({ userId: 3, groupId: 9, type: 'weekly_summary' });
    await fetch(`${baseURL}/api/email/unsubscribe?token=${token}`);
    const [, , prefs] = setPrefs.mock.calls[0].arguments;
    assert.deepStrictEqual(prefs, { emailSummaries: false });
  });

  test('a forged token is rejected and changes nothing', async () => {
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({}));
    const res = await fetch(`${baseURL}/api/email/unsubscribe?token=bogus.token`);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(setPrefs.mock.calls.length, 0);
  });

  test('POST is the one-click target and returns JSON', async () => {
    mock.method(Group, 'setEmailPrefs', async () => ({}));
    const token = signUnsubscribe({ userId: 3, groupId: 9, type: 'pick_reminder' });
    const res = await fetch(`${baseURL}/api/email/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).ok, true);
  });

  test('a group-less reminder token pauses the user globally', async () => {
    const pause = mock.method(User, 'setEmailPaused', async () => ({ emailPausedAt: new Date() }));
    const token = signUnsubscribe({ userId: 3, groupId: null, type: 'pick_reminder' });
    const res = await fetch(`${baseURL}/api/email/unsubscribe?token=${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(pause.mock.calls[0].arguments[0], 3);
  });
});
```

> **Note on the last case:** reminder emails are batched across groups, so their
> token carries no group id. The only honest thing a group-less unsubscribe can
> do is pause the user globally — which is also what the recipient means when
> they click it on an email covering five groups.

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && node --test tests/email-unsubscribe-route.test.js`
Expected: FAIL — 404.

- [ ] **Step 3: Write the router**

```js
// backend/src/routes/email.js
import express from 'express';
import { verifyUnsubscribe } from '../utils/emailTokens.js';
import { Group } from '../models/Group.js';
import { User } from '../models/User.js';

const router = express.Router();

// Deliberately unauthenticated: the signed token IS the credential. A recipient
// clicking unsubscribe from their mail client is not logged in, and requiring a
// login to stop email would make the link useless — and non-compliant.
async function applyUnsubscribe(token) {
  const claim = verifyUnsubscribe(token);
  if (!claim) return null;

  // Reminder emails are batched across groups, so their token has no group id.
  // The only honest reading of a click there is "stop emailing me".
  if (claim.groupId === null) {
    await User.setEmailPaused(claim.userId, true);
    return { scope: 'all' };
  }

  const prefs =
    claim.type === 'weekly_summary' ? { emailSummaries: false } : { emailReminders: false };
  await Group.setEmailPrefs(claim.groupId, claim.userId, prefs);
  return { scope: claim.type };
}

function page(message) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
<body style="margin:0;padding:48px 16px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1917;">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:8px;padding:24px;">
<h1 style="margin:0 0 12px 0;font-size:20px;">${message}</h1>
<p style="margin:0;font-size:14px;color:#57534e;">You can change this any time in your group settings.</p>
</div></body></html>`;
}

router.get('/unsubscribe', async (req, res) => {
  try {
    const result = await applyUnsubscribe(req.query.token);
    if (!result) return res.status(400).type('html').send(page('That unsubscribe link is not valid.'));
    return res.type('html').send(
      page(result.scope === 'all' ? 'All emails are paused.' : "You're unsubscribed."),
    );
  } catch (e) {
    return res.status(500).type('html').send(page('Something went wrong. Please try again.'));
  }
});

// RFC 8058 one-click target, referenced by the List-Unsubscribe-Post header.
router.post('/unsubscribe', async (req, res) => {
  try {
    const token = req.body?.token ?? req.query.token;
    const result = await applyUnsubscribe(token);
    if (!result) return res.status(400).json({ error: 'Invalid token' });
    return res.json({ ok: true, scope: result.scope });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

export default router;
```

- [ ] **Step 4: Mount it**

In `backend/src/app.js`, beside the other `app.use('/api/...')` mounts:

```js
import emailRoutes from './routes/email.js';
// ...
app.use('/api/email', emailRoutes);
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `cd backend && node --test tests/email-unsubscribe-route.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && node --test tests/*.test.js`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/email.js backend/src/app.js backend/tests/email-unsubscribe-route.test.js
git commit -m "$(cat <<'EOF'
feat(email): public one-click unsubscribe

Unauthenticated by design — the signed token is the credential. Someone
clicking unsubscribe in their mail client is not logged in, and requiring a
login to stop email makes the link useless and non-compliant.

A reminder token carries no group (those emails are batched across groups), so
a click there pauses the user globally, which is what the recipient means.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 13: Frontend service layer

**Files:**
- Modify: `frontend/src/lib/groupsService.js`, `frontend/src/lib/groupsService.d.ts`

**Interfaces:**
- Consumes: the routes from Tasks 11-12.
- Produces:
  - `setEmailPrefs(identifier, prefs)` → `Promise<{ emailReminders: boolean; emailSummaries: boolean }>`
  - `setEmailPause(paused)` → `Promise<{ emailPausedAt: string | null }>`
  - `GroupDetail` gains `emailReminders?: boolean`, `emailSummaries?: boolean`.

- [ ] **Step 1: Add the service functions**

In `frontend/src/lib/groupsService.js`, following the `setMemberDues` shape:

```js
/** Set the calling member's own email preferences for one group. */
export async function setEmailPrefs(identifier, prefs) {
  const res = await authFetch(`${apiBase()}/${identifier}/email-prefs`, {
    method: 'POST',
    body: JSON.stringify(prefs)
  });
  if (res.status === 404) throw new Error('Group not found');
  if (res.status === 403) throw new Error('Must be a group member to set email preferences');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save email preferences');
  }
  return res.json();
}

/** Global email kill switch for the signed-in user. */
export async function setEmailPause(paused) {
  const res = await authFetch(`${AuthService.getApiBaseUrl()}/auth/me/email-pause`, {
    method: 'POST',
    body: JSON.stringify({ paused })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update email settings');
  }
  return res.json();
}
```

- [ ] **Step 2: Declare them in the `.d.ts`**

tsconfig is `strict` without `allowJs`, so an undeclared export breaks every `.tsx` importer. In `frontend/src/lib/groupsService.d.ts`, add to `GroupDetail`:

```ts
  /** This member's own opt-in: "you have picks to make today" emails. */
  emailReminders?: boolean;
  /** This member's own opt-in: weekly recap + leaderboard emails. */
  emailSummaries?: boolean;
```

and at module level:

```ts
export function setEmailPrefs(
  identifier: string,
  prefs: { emailReminders?: boolean; emailSummaries?: boolean },
): Promise<{ emailReminders: boolean; emailSummaries: boolean }>;

export function setEmailPause(paused: boolean): Promise<{ emailPausedAt: string | null }>;
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: only the two **pre-existing** `AuthContext` errors for `getCachedUser` / `isAccessTokenValid`. Anything else is yours.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/groupsService.js frontend/src/lib/groupsService.d.ts
git commit -m "$(cat <<'EOF'
feat(email): frontend service calls for email preferences

Declarations land in the .d.ts alongside the implementation: tsconfig is strict
without allowJs, so an undeclared export breaks every .tsx importer rather than
degrading to any.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 14: `Banner` gains a dismiss affordance

**Files:**
- Modify: `frontend/src/designsystem/components/Banner/Banner.tsx`
- Test: `frontend/src/designsystem/components/Banner/Banner.test.tsx`

**Interfaces:**
- Produces: `BannerProps.onDismiss?: () => void`. When present, a trailing ✕ button with `aria-label="Dismiss"` renders after `action`.

- [ ] **Step 1: Write the failing test**

Append to `Banner.test.tsx`:

```tsx
  it('renders no dismiss control by default', () => {
    render(<Banner>Heads up</Banner>);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('calls onDismiss when the dismiss control is clicked', () => {
    const onDismiss = vi.fn();
    render(<Banner onDismiss={onDismiss}>Heads up</Banner>);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps the action alongside the dismiss control', () => {
    const onClick = vi.fn();
    const onDismiss = vi.fn();
    render(<Banner action={{ label: 'Open settings', onClick }} onDismiss={onDismiss}>Heads up</Banner>);
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
```

Make sure `fireEvent` and `vi` are imported at the top of the file.

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd frontend && pnpm exec vitest run --no-coverage src/designsystem/components/Banner`
Expected: FAIL — no Dismiss button.

- [ ] **Step 3: Add the prop**

In `BannerProps`:

```tsx
  /**
   * Optional dismiss control. When provided, a trailing ✕ renders and calls
   * this. The banner does NOT hide itself — the parent owns visibility, so it
   * can also persist the dismissal.
   */
  onDismiss?: () => void;
```

In the signature and the JSX:

```tsx
export default function Banner({ variant = 'info', children, action, actions, onDismiss }: BannerProps) {
```

after the `action` block, before the closing `</div>`:

```tsx
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="self-start rounded-base p-xxs leading-none opacity-70 hover:opacity-100 sm:self-auto"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
```

and add `XMarkIcon` to the heroicons import at the top.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd frontend && pnpm exec vitest run --no-coverage src/designsystem/components/Banner`
Expected: PASS, all cases including the pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/designsystem/components/Banner/Banner.tsx frontend/src/designsystem/components/Banner/Banner.test.tsx
git commit -m "$(cat <<'EOF'
feat(ds): optional dismiss control on Banner

The banner does not hide itself — the parent owns visibility, so it can also
persist the dismissal. Absent the prop, nothing about the component changes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 15: `EmailPrefs` panel and Settings tab wiring

**Files:**
- Create: `frontend/src/designsystem/components/EmailPrefs/EmailPrefs.tsx`, `EmailPrefs.test.tsx`, `index.ts`
- Modify: `frontend/src/pages/GroupDetails/SettingsTab.tsx`, `frontend/src/pages/GroupDetails/SettingsTab.test.tsx`

**Interfaces:**
- Consumes: `Toggle`, `Card`, `Button`, `setEmailPrefs` (Task 13).
- Produces: `EmailPrefsValues = { emailReminders: boolean; emailSummaries: boolean }`; `EmailPrefsProps = { values, onSave: (v: EmailPrefsValues) => Promise<void> }`. The section is anchored `id="email-prefs"`.

- [ ] **Step 1: Write the failing component test**

```tsx
// frontend/src/designsystem/components/EmailPrefs/EmailPrefs.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EmailPrefs from './EmailPrefs';

function renderPanel(props = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <EmailPrefs
      values={{ emailReminders: false, emailSummaries: false }}
      onSave={onSave}
      {...props}
    />,
  );
  return { onSave };
}

describe('EmailPrefs', () => {
  it('reflects the persisted values', () => {
    renderPanel({ values: { emailReminders: true, emailSummaries: false } });
    expect(screen.getByRole('switch', { name: /pick reminders/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: /weekly summaries/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('saves the edited draft', async () => {
    const { onSave } = renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: /pick reminders/i }));
    fireEvent.click(screen.getByRole('button', { name: /save email settings/i }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ emailReminders: true, emailSummaries: false }),
    );
  });

  it('shows a confirmation after a successful save', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: /weekly summaries/i }));
    fireEvent.click(screen.getByRole('button', { name: /save email settings/i }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('surfaces a save failure without losing the draft', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network down'));
    render(
      <EmailPrefs values={{ emailReminders: false, emailSummaries: false }} onSave={onSave} />,
    );
    fireEvent.click(screen.getByRole('switch', { name: /pick reminders/i }));
    fireEvent.click(screen.getByRole('button', { name: /save email settings/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    expect(screen.getByRole('switch', { name: /pick reminders/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('anchors the section so the announcement banner can deeplink to it', () => {
    const { container } = render(
      <EmailPrefs values={{ emailReminders: false, emailSummaries: false }} onSave={vi.fn()} />,
    );
    expect(container.querySelector('#email-prefs')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd frontend && pnpm exec vitest run --no-coverage src/designsystem/components/EmailPrefs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/designsystem/components/EmailPrefs/EmailPrefs.tsx
import { useState } from 'react';
import Button from '../Button';
import Card from '../Card';
import Toggle from '../Toggle';

export interface EmailPrefsValues {
  emailReminders: boolean;
  emailSummaries: boolean;
}

export interface EmailPrefsProps {
  /** Current persisted preferences for the viewing member. */
  values: EmailPrefsValues;
  /** Persist the member's edits. Rejects with an Error whose message is shown. */
  onSave: (values: EmailPrefsValues) => Promise<void>;
}

/**
 * Per-member email preferences for one group.
 *
 * Save-on-button rather than save-on-toggle, matching DuesSettings: two related
 * switches read as one decision, and a single Save makes it obvious when that
 * decision has been recorded. Both default off — nothing is ever sent to a
 * member who has not acted.
 */
export default function EmailPrefs({ values, onSave }: EmailPrefsProps) {
  const [draft, setDraft] = useState<EmailPrefsValues>(values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function patch(next: Partial<EmailPrefsValues>) {
    setDraft((d) => ({ ...d, ...next }));
    setSavedAt(null);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave(draft);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save email settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section" padding="lg" className="space-y-md" id="email-prefs">
      <h2 className="text-lg font-heading font-semibold text-[var(--color-text-primary)]">Email</h2>

      <Toggle
        id="email-reminders"
        checked={draft.emailReminders}
        onChange={(next) => patch({ emailReminders: next })}
        label="Send me pick reminders"
        description="One email on game days, about four hours before the first kickoff, if you still have picks to make."
      />

      <Toggle
        id="email-summaries"
        checked={draft.emailSummaries}
        onChange={(next) => patch({ emailSummaries: next })}
        label="Send me weekly summaries"
        description="How everyone did and where the standings landed, the morning after the week's last game."
      />

      <div className="flex items-center gap-sm">
        <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
          Save email settings
        </Button>
        {savedAt !== null && (
          <span className="text-sm text-success-600 dark:text-success-400">Saved</span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
    </Card>
  );
}
```

```ts
// frontend/src/designsystem/components/EmailPrefs/index.ts
export { default, default as EmailPrefs } from './EmailPrefs';
export type { EmailPrefsProps, EmailPrefsValues } from './EmailPrefs';
```

- [ ] **Step 4: Run the component test and confirm it passes**

Run: `cd frontend && pnpm exec vitest run --no-coverage src/designsystem/components/EmailPrefs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire it into `SettingsTab`**

Add imports:

```tsx
import EmailPrefs from '../../designsystem/components/EmailPrefs';
import type { EmailPrefsValues } from '../../designsystem/components/EmailPrefs';
import { deleteGroup, leaveGroup, updateGroup, setMemberDues, setEmailPrefs } from '../../lib/groupsService.js';
```

Add the handler beside `handleSaveDues`:

```tsx
  // Member-scoped: this writes the caller's own preferences, so there is no
  // admin branch and no member id.
  async function handleSaveEmailPrefs(values: EmailPrefsValues) {
    await setEmailPrefs(identifier, values);
    onDuesChanged?.(); // re-fetches group + members, refreshing the prefs too
  }
```

Render it immediately after `<DuesSettings … />`, NFL groups only:

```tsx
      {/* Email — per-member opt-in, so every member sees it regardless of role.
          World Cup pools send no email, so the panel stays hidden for them. */}
      {group.poolType !== 'world_cup_2026' && (
        <EmailPrefs
          values={{
            emailReminders: group.emailReminders ?? false,
            emailSummaries: group.emailSummaries ?? false,
          }}
          onSave={handleSaveEmailPrefs}
        />
      )}
```

- [ ] **Step 6: Extend the `SettingsTab` mock factory**

`vi.mock` factories replace the whole module, so `SettingsTab.test.tsx` throws at mount unless `setEmailPrefs` is added:

```tsx
vi.mock('../../lib/groupsService.js', () => ({
  deleteGroup: vi.fn(),
  leaveGroup: vi.fn(),
  updateGroup: vi.fn(),
  setMemberDues: vi.fn(),
  setEmailPrefs: vi.fn().mockResolvedValue({ emailReminders: false, emailSummaries: false }),
}));
```

- [ ] **Step 7: Run both suites**

Run: `cd frontend && pnpm exec vitest run --no-coverage src/designsystem/components/EmailPrefs src/pages/GroupDetails`
Expected: PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/designsystem/components/EmailPrefs frontend/src/pages/GroupDetails/SettingsTab.tsx frontend/src/pages/GroupDetails/SettingsTab.test.tsx
git commit -m "$(cat <<'EOF'
feat(email): per-member email settings in the group settings tab

Save-on-button rather than save-on-toggle, matching DuesSettings: two related
switches read as one decision. Every member sees the panel regardless of role,
because these are their own preferences — World Cup pools hide it since they
send no email.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 16: The announcement banner

**Files:**
- Modify: `frontend/src/pages/GroupDetailsPage.tsx`, `frontend/src/pages/GroupDetailsPage.test.tsx`

**Interfaces:**
- Consumes: `Banner.onDismiss` (Task 14), `group.emailReminders` / `group.emailSummaries` (Task 13), the `#email-prefs` anchor (Task 15).
- Produces: no new exports. localStorage key `email-prefs-announcement-seen`.

- [ ] **Step 1: Write the failing test**

Add a `describe` block to `GroupDetailsPage.test.tsx`:

```tsx
describe('email settings announcement', () => {
  it('offers the announcement on an NFL group with no preferences set', async () => {
    getGroup.mockResolvedValue({ ...memberGroup, emailReminders: false, emailSummaries: false });
    renderPage();
    expect(await screen.findByText(/choose email settings/i)).toBeInTheDocument();
  });

  it('deeplinks to the settings tab', async () => {
    getGroup.mockResolvedValue({ ...memberGroup, emailReminders: false, emailSummaries: false });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /email settings/i }));
    expect(await screen.findByText('Email')).toBeInTheDocument();
  });

  it('stays dismissed once dismissed', async () => {
    getGroup.mockResolvedValue({ ...memberGroup, emailReminders: false, emailSummaries: false });
    const { unmount } = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/choose email settings/i)).toBeNull();

    unmount();
    renderPage();
    await screen.findByText(memberGroup.name);
    expect(screen.queryByText(/choose email settings/i)).toBeNull();
  });

  it('does not nag a member who already chose', async () => {
    getGroup.mockResolvedValue({ ...memberGroup, emailReminders: true, emailSummaries: false });
    renderPage();
    await screen.findByText(memberGroup.name);
    expect(screen.queryByText(/choose email settings/i)).toBeNull();
  });

  it('is hidden for World Cup pools', async () => {
    getGroup.mockResolvedValue({
      ...memberGroup, poolType: 'world_cup_2026', emailReminders: false, emailSummaries: false,
    });
    renderPage();
    await screen.findByText(memberGroup.name);
    expect(screen.queryByText(/choose email settings/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Add the required `localStorage` reset**

`GroupDetailsPage.test.tsx` never clears localStorage today, and jsdom persists it across cases in a file — so the dismissal written by one test leaks into the next and silently suppresses the banner other cases assert on. Add to the existing top-level `beforeEach`, beside `clearWorldCupCache()`:

```tsx
    localStorage.clear();
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `cd frontend && pnpm exec vitest run --no-coverage src/pages/GroupDetailsPage`
Expected: FAIL — no announcement text.

- [ ] **Step 4: Add the dismissal flag helpers**

Near the top of `GroupDetailsPage.tsx`, module scope:

```tsx
// One-time announcement, not per group: the feature ships once, so seeing it in
// any group is seeing it. Guarded like ScoreBonusTooltip — storage can be
// disabled or throw, and the correct fallback is simply to show the banner.
const EMAIL_ANNOUNCE_KEY = 'email-prefs-announcement-seen';

function readAnnounceSeen(): boolean {
  try {
    return localStorage.getItem(EMAIL_ANNOUNCE_KEY) === '1';
  } catch {
    return false;
  }
}

function setAnnounceSeen() {
  try {
    localStorage.setItem(EMAIL_ANNOUNCE_KEY, '1');
  } catch {
    // Storage unavailable — the banner re-shows next mount. Acceptable.
  }
}
```

- [ ] **Step 5: Add the state, the handler and the banner**

State, initialised synchronously so there is no paint flash:

```tsx
  const [announceDismissed, setAnnounceDismissed] = useState<boolean>(() => readAnnounceSeen());
```

Handlers, beside `goToDuesDetails()`:

```tsx
  // Banner CTA: the preferences live in the settings tab, so switch to it and
  // scroll the panel into view.
  function goToEmailPrefs() {
    setActiveTab('settings');
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'settings');
    setSearchParams(next, { replace: true });
    // The panel mounts with the tab, so defer the scroll a frame.
    requestAnimationFrame(() => {
      document.getElementById('email-prefs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function dismissAnnouncement() {
    setAnnounceSeen();
    setAnnounceDismissed(true);
  }
```

The visibility rule and the banner, rendered in the existing banner stack above the tab bar:

```tsx
  // Announce only to people who have not already chosen. Once either preference
  // is on, the member knows the feature exists and the banner is just noise.
  const hasChosenEmailPrefs = Boolean(group?.emailReminders || group?.emailSummaries);
  const showEmailAnnouncement =
    !isWorldCup && !announceDismissed && !hasChosenEmailPrefs && activeTab !== 'settings';
```

```tsx
        {showEmailAnnouncement && (
          <Banner
            variant="info"
            action={{ label: 'Email settings', onClick: goToEmailPrefs }}
            onDismiss={dismissAnnouncement}
          >
            New: you can now choose email settings for this group — pick reminders before
            kickoff and a weekly recap.
          </Banner>
        )}
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `cd frontend && pnpm exec vitest run --no-coverage src/pages/GroupDetailsPage`
Expected: PASS, including every pre-existing case.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/GroupDetailsPage.tsx frontend/src/pages/GroupDetailsPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(email): announce email settings once, to people who have not chosen

Shown only while both preferences are off: once a member has chosen, they know
the feature exists and the banner is noise. Dismissal is a single global flag,
not per group — the feature ships once.

Also clears localStorage between cases in GroupDetailsPage.test.tsx. jsdom
persists it across a file, so a dismissal written by one test would leak into
the next and silently suppress the banner others assert on.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 17: The global pause switch on ProfilePage

**Files:**
- Modify: `frontend/src/pages/ProfilePage.tsx`
- Test: `frontend/src/pages/ProfilePage.test.tsx`

**Interfaces:**
- Consumes: `setEmailPause` (Task 13), `Toggle`, `Card`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

```tsx
  describe('email pause', () => {
    it('pauses all email when switched on', async () => {
      setEmailPause.mockResolvedValue({ emailPausedAt: '2026-09-17T00:00:00Z' });
      renderProfile();
      fireEvent.click(await screen.findByRole('switch', { name: /pause all email/i }));
      await waitFor(() => expect(setEmailPause).toHaveBeenCalledWith(true));
    });

    it('surfaces a failure', async () => {
      setEmailPause.mockRejectedValue(new Error('Network down'));
      renderProfile();
      fireEvent.click(await screen.findByRole('switch', { name: /pause all email/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    });
  });
```

Add `setEmailPause` to whatever `groupsService.js` mock factory `ProfilePage.test.tsx` uses; if it has none, add one exporting only `setEmailPause`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd frontend && pnpm exec vitest run --no-coverage src/pages/ProfilePage`
Expected: FAIL — no such switch.

- [ ] **Step 3: Add the card**

```tsx
import Toggle from '../designsystem/components/Toggle';
import { setEmailPause } from '../lib/groupsService.js';
```

```tsx
  const [emailPaused, setEmailPaused] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);

  async function handleTogglePause(next: boolean) {
    setPauseError(null);
    const previous = emailPaused;
    setEmailPaused(next); // optimistic: the switch should feel immediate
    try {
      await setEmailPause(next);
    } catch (err) {
      setEmailPaused(previous);
      setPauseError(err instanceof Error ? err.message : 'Failed to update email settings');
    }
  }
```

```tsx
      {/* The single off switch. Overrides every per-group preference, so a
          member who wants out entirely does not have to visit each group. */}
      <Card as="section" padding="lg" className="space-y-md">
        <h2 className="text-lg font-heading font-semibold text-[var(--color-text-primary)]">Email</h2>
        <Toggle
          id="email-pause-all"
          checked={emailPaused}
          onChange={handleTogglePause}
          label="Pause all email"
          description="Stops every confidence-picks email, whatever your individual groups are set to."
        />
        {pauseError && (
          <p role="alert" className="text-sm text-error-600 dark:text-error-400">
            {pauseError}
          </p>
        )}
      </Card>
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd frontend && pnpm exec vitest run --no-coverage src/pages/ProfilePage`
Expected: PASS.

- [ ] **Step 5: Run the whole frontend suite and typecheck**

Run: `cd frontend && pnpm exec vitest run --no-coverage && pnpm exec tsc --noEmit`
Expected: all tests green; only the two pre-existing `AuthContext` type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ProfilePage.tsx frontend/src/pages/ProfilePage.test.tsx
git commit -m "$(cat <<'EOF'
feat(email): global pause switch on the profile page

One honest off switch that overrides every per-group preference, so someone who
wants out entirely does not have to visit each group — and so there is a single
place to stop everything if a send ever misfires.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

### Task 18: The workflow — dispatch only

**Files:**
- Create: `.github/workflows/nfl-emails.yml`

**Interfaces:**
- Consumes: `pnpm run email:send` (Task 10).
- Produces: a manually dispatchable workflow. **No `schedule:` block in this task.**

> **Standing rule:** this file lands with `workflow_dispatch:` only. Adding the
> `schedule:` trigger is a separate commit, made only after a green manual
> dry run and explicit sign-off. Do not add it here.

- [ ] **Step 1: Write the workflow**

```yaml
name: Send NFL Emails

# Manual dispatch only, matching the convention in this repo. The hourly
# schedule: trigger is added in a separate commit after a green dry run.
on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Log instead of sending'
        type: boolean
        default: true

jobs:
  send:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install backend dependencies (frozen)
        working-directory: ./backend
        run: pnpm install --frozen-lockfile

      - name: Send NFL emails
        working-directory: ./backend
        env:
          NODE_ENV: production
          # games.game_date is a naive timestamp holding UTC and node-pg parses
          # it in the PROCESS zone. A non-UTC runner would shift every kickoff.
          TZ: UTC
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DEV_DATABASE_URL: ${{ secrets.DATABASE_URL }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          EMAIL_TOKEN_SECRET: ${{ secrets.EMAIL_TOKEN_SECRET }}
          EMAIL_FROM: 'Confidence Picks <noreply@confidence-picks.com>'
          EMAIL_REPLY_TO: hello@noetalabs.tech
          EMAIL_DRY_RUN: ${{ inputs.dry_run }}
          EMAIL_MAX_PER_RUN: '80'
          FRONTEND_BASE_URL: https://www.confidence-picks.com
          API_BASE_URL: https://api.confidence-picks.com
        run: pnpm run email:send

      - name: Summary
        if: always()
        run: echo 'NFL email run completed.' >> $GITHUB_STEP_SUMMARY
```

- [ ] **Step 2: Verify the YAML parses**

Run: `cd /Users/davidokun/Developer/Web/confidence-picks && node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/nfl-emails.yml','utf8');if(/^\s*schedule:/m.test(s)){console.error('FAIL: schedule: trigger must not be in this commit');process.exit(1)}console.log('ok — dispatch only')"`
Expected: `ok — dispatch only`.

- [ ] **Step 3: Confirm no run is triggered**

This file has no `push` or `pull_request` trigger, so committing it dispatches nothing. Do not run `gh workflow run` — that needs sign-off.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/nfl-emails.yml
git commit -m "$(cat <<'EOF'
ci(email): manually dispatchable NFL email run

workflow_dispatch only, defaulting to a dry run. The hourly schedule: trigger
is deliberately not in this commit — it lands separately after a green manual
run, per the standing rule that no automatic trigger is added unasked.

TZ is pinned to UTC: games.game_date is a naive timestamp holding UTC and
node-pg parses it in the process zone, so a non-UTC runner would shift every
kickoff.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011Rgr3HtDpstdjqboo24Yu7
EOF
)"
```

---

## Verification before hand-off

- [ ] `cd backend && node --test tests/*.test.js` — all green.
- [ ] `cd frontend && pnpm exec vitest run --no-coverage` — all green.
- [ ] `cd frontend && pnpm exec tsc --noEmit` — only the two pre-existing `AuthContext` errors.
- [ ] `cd backend && envchain confidence-picks pnpm run email:send` — exits 0, prints `[email] DRY RUN`.
- [ ] `git log --oneline origin/main..HEAD` — one commit per task, nothing pushed.
- [ ] `grep -rn "schedule:" .github/workflows/nfl-emails.yml` — no match.

## Deferred to sign-off

1. **Adding the `schedule:` trigger** (`- cron: '0 * * * *'`). Needs explicit approval; GitHub schedules only fire from the default branch, so it takes effect on merge to `main`.
2. **Setting `EMAIL_TOKEN_SECRET` in Vercel** — the same value as the GH secret, needed by the unsubscribe route.
3. **Flipping `EMAIL_DRY_RUN` to `false`** — after inspecting a dry-run log.
4. **Pushing / opening a PR** — `deploy-backend.yml` and `backend-tests.yml` auto-trigger.
