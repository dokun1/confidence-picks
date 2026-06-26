# World Cup Picks — Scoring & Tiebreaker Rules

> Reference specification for the World Cup 2026 pool pick type.
> Source: the "WC2022 Picks" spreadsheet rules (external, not committed to the repo),
> snapshotted here on 2026-06-05 as the authoritative rule list for implementation.

## Tournament Context

- **Tournament:** FIFA World Cup 2026
- **Dates:** June 11 – July 19, 2026
- **Hosts:** United States, Mexico, Canada
- **Format:** Group stage followed by a single-elimination knockout bracket.
- **Pick type:** `world_cup_2026` pool. Each user picks an outcome for every match
  (Home win / Draw / Away win). **There is no confidence multiplier** — every match
  is worth a flat point value determined solely by the pick outcome versus the actual
  match result. This is the key difference from the NFL `confidence` pools.

For each match a user selects one of three outcomes:

- the **home** team to win,
- the **away** team to win, or
- a **draw**.

Points are awarded per match using the tables below. A user's tournament score is the
sum of points across all matches they picked.

---

## Group-Stage Scoring (flat, no confidence multiplier)

During the group stage a match can genuinely end in a draw, so the `draw` pick is live.

Plain-language rules (verbatim from the source spreadsheet):

- Pick a team and **they win** → **3 points**.
- Pick a team and **they draw** (the match ended level) → **1 point**.
- Pick a team and **they lose** → **0 points**.
- Pick **draw** and the match **drew** → **2 points**.
- Pick **draw** and **a team won** → **1 point**.

### Scoring matrix

Read this table as: *(the outcome you picked)* × *(the actual match result)* → *points*.
"Picked team won" means the team you selected was the team that won; "picked team lost"
means the team you selected was the team that lost.

| Your pick            | Actual result: that team won | Actual result: draw | Actual result: that team lost |
|----------------------|:----------------------------:|:-------------------:|:-----------------------------:|
| **Home team**        | 3                            | 1                   | 0                             |
| **Away team**        | 3                            | 1                   | 0                             |
| **Draw**             | 1 (a team won)               | 2                   | 1 (a team won)                |

Equivalent statement for a backend implementer:

| Your pick   | Match drew? | Picked team is the winner? | Points |
|-------------|:-----------:|:--------------------------:|:------:|
| Home / Away | no          | yes                        | 3      |
| Home / Away | no          | no (picked team lost)      | 0      |
| Home / Away | yes         | n/a                        | 1      |
| Draw        | yes         | n/a                        | 2      |
| Draw        | no          | n/a                        | 1      |

Notes:

- A pick of `home` or `away` scores identically for the symmetric outcome — the only
  thing that matters is whether the *selected* team won (3), drew (1), or lost (0).
- The `draw` pick is the only outcome that can never score 0 in the group stage:
  it scores 2 on an actual draw and 1 otherwise. (This is *not* true in the knockout
  stage — see below.)

---

## Knockout-Stage Scoring (flat, no confidence multiplier)

Knockout matches (stages `r32`, `r16`, `qf`, `sf`, `third`, `final`) **cannot end in a
draw as a scoring result.** Every knockout match produces exactly one **advancing team**
— the team that progresses to the next round (or, for the `final`, the champion; for
`third`, the third-place winner). The advancing team is the scoring "winner," **regardless
of how they advanced.**

### The advancing team is the result

- The **advancing team counts as the winner**, full stop. It does not matter whether they
  won in regulation (90'), in extra time (120'), or on a **penalty shootout** after the
  90'/120' score was level.
- A **penalty-shootout result counts as a win for the advancing team.** There is **no draw
  scoring** in the knockout stage even when regulation/extra time ended level — the level
  90'/120' score is irrelevant to scoring; only who advanced matters.
- The non-advancing (eliminated) team counts as the **loser**.

### Scoring rules

- Pick the **advancing team** → **3 points**.
- Pick the **eliminated team** → **0 points**.
- Pick **draw** → **0 points**. A `draw` pick **can never score in a knockout match**,
  because a knockout match never resolves to a draw for scoring purposes — there is always
  an advancing team. (In the UI, the draw option is disabled for knockout matches; if a
  stored pick is nonetheless `draw`, it scores 0.)

### Scoring matrix

| Your pick        | Picked team advanced? | Points |
|------------------|:---------------------:|:------:|
| Home / Away      | yes                   | 3      |
| Home / Away      | no (eliminated)       | 0      |
| Draw             | n/a                   | 0      |

"Advanced" is determined by which team progresses, not by the 90'/120' scoreline. A team
that draws 0–0 over 120 minutes and wins on penalties **advanced**, so a pick for that team
scores 3 and a pick for the other team scores 0.

### How this differs from group-stage scoring

This is the **only** structural difference between the two stages, and it is deliberate:

| Aspect                          | Group stage                                  | Knockout stage                              |
|---------------------------------|----------------------------------------------|---------------------------------------------|
| Can the match result be a draw? | **Yes** — a level final score is a draw.     | **No** — there is always an advancing team. |
| `draw` pick can score?          | **Yes**: 2 on an actual draw, 1 if a team won. | **No**: always **0**.                     |
| Team pick on a level scoreline  | **1 point** (the picked team drew).          | **3 or 0** by whether that team *advanced* (a level 90'/120' score is ignored; PKs decide). |
| Team pick when that team wins    | **3 points**.                               | **3 points** (the team advanced).           |
| Team pick when that team loses   | **0 points**.                               | **0 points** (the team was eliminated).     |

In short: the group stage has three live outcomes (win / draw / loss) and a `draw` pick
that can score up to 2; the knockout stage collapses to two outcomes (advanced / eliminated),
a team pick scores 3 or 0, and a `draw` pick is dead (always 0).

---

## Score-Prediction Bonus (Knockout)

For every **knockout-stage** match (stages `r32`, `r16`, `qf`, `sf`, `third`, `final`) you
may optionally predict the **final score** to earn extra points on top of your advance pick.

### What the bonus is (and is not)

- **Optional.** You may submit a score prediction, or leave it blank — your advance pick is
  unaffected either way.
- **Independent of the advance pick.** The bonus is calculated purely from the score
  prediction vs. the actual score; it does not require your advance pick to be correct.
- **Independent of who advanced.** The advancing team is determined separately for base
  scoring (3 or 0 points). The score-prediction bonus only compares scorelines.

### The scoring rule

The bonus compares your predicted scoreline `(predicted home score, predicted away score)`
to the **actual on-field score** — the 90-minute / extra-time result, **excluding
penalty-shootout kicks**. A match decided by penalties therefore counts as a **draw score**
(e.g. 1–1) for bonus purposes; the advancing side is tracked separately.

> **Exact score = +2; off by one goal, or the right scoreline with the teams flipped = +1.
> PK shootouts count as a draw score.**

In full:

- **+2** — exact match: your home prediction equals the actual home score **and** your away
  prediction equals the actual away score.
- **+1** — either of:
  - **Off by one goal:** L1 distance 1, meaning exactly one team's score is off by one and
    the other is exact (e.g. predict 3–1, actual 3–2 — away side off by one); **or**
  - **Right scoreline, teams flipped (mirror):** your predicted home equals the actual away
    **and** your predicted away equals the actual home (and they are not identical).
- **+0** — anything else.

### Reference table — actual score 3–2

| Predicted | Bonus | Why |
|-----------|:-----:|-----|
| 3–2       | +2    | Exact match |
| 3–3, 2–2, 4–2, 3–1 | +1 | One team off by one goal |
| 2–3       | +1    | Right scoreline, teams flipped (mirror) |
| 4–3, 2–1  | 0     | Both teams off by one (L1 = 2), not a mirror |
| 1–0       | 0     | Not close |

### Score used for the bonus

Extra-time goals **count** toward the score. Only penalty-shootout kicks are excluded. A
match that finishes 1–1 after extra time and is then decided on penalties uses **1–1** as the
actual score for bonus purposes.

### Leaderboard display

The leaderboard shows a **Bonus** column reflecting accumulated score-prediction bonus points
for all World Cup pool types. In knockout-only pools the **Draws Correct** and **Draws
Incorrect** columns are hidden (knockouts never produce scoring draws, so those columns are
always 0 there and are omitted to keep the table readable).

---

## Tiebreakers

When two or more users finish with the **same total score**, rank them by applying the
following criteria **in this exact order**. Each criterion is only consulted when all
earlier criteria are equal; the first criterion that distinguishes two tied users
determines their relative order. If all four criteria are equal, the users remain tied
and step 5 applies.

1. **Most wins correctly picked** (`wins_correct`) — higher is better.
2. **Fewest losses** (`losses`) — lower is better.
3. **Most draws correctly picked** (`draws_correct`) — higher is better.
4. **Fewest draws incorrectly picked** (`draws_incorrect`) — lower is better.
5. **Split the pot** — any users still tied after criteria 1–4 share the prize equally.

### Field definitions (for the backend implementer)

These four counts ship as part of the leaderboard endpoint payload so the frontend can
display them as columns. Each is computed per user by iterating over **only that user's
scored picks** (a match the user did not pick contributes to none of the counts). A match
is scored once its `status` from ESPN reports completion.

For every match, resolve two facts first:

- **The actual result.** Group stage: `home_win`, `away_win`, or `draw` (level final
  score). Knockout stage: there is never a draw — exactly one team is the **advancing
  team** (the winner), determined by who progresses, including via extra time or a
  penalty shootout. The eliminated team is the loser. (See the Knockout-Stage Scoring
  section: a PK result counts as a win for the advancing team.)
- **The user's pick:** `home`, `away`, or `draw`.

Then increment the counts as follows:

| Field             | Increment when…                                                                                     |
|-------------------|-----------------------------------------------------------------------------------------------------|
| `wins_correct`    | the user picked a **team** (`home`/`away`) and that team **won** (group) or **advanced** (knockout). |
| `losses`          | the user picked a **team** (`home`/`away`) and that team **lost** (group) or was **eliminated** (knockout). |
| `draws_correct`   | the user picked **`draw`** and the match **actually drew** (group stage only; knockouts never draw). |
| `draws_incorrect` | the user picked **`draw`** but a team won/advanced, **or** the user picked a **team** but the match **drew**. |

Stated precisely:

- **`wins_correct`** = count of matches where the user picked the team that won
  (group) or advanced (knockout). These are the user's 3-point picks.
- **`losses`** = count of matches where the user picked the team that lost (group) or
  was eliminated (knockout). In the group stage these are 0-point team picks; in the
  knockout stage these are 0-point team picks. A `draw` pick is **never** counted as a
  loss.
- **`draws_correct`** = count of matches where the user picked `draw` **and** the match
  drew. Only group-stage matches can satisfy this (a knockout match never resolves to a
  draw). These are the user's 2-point picks.
- **`draws_incorrect`** = count of matches where the user's pick and the actual result
  disagree **on the draw axis** — i.e. exactly one of (pick, result) is a draw:
  - the user picked `draw` but a team won/advanced
    (group: a 1-point pick; knockout: a 0-point pick — draw picks are disabled in the
    knockout UI but a stored `draw` is still counted here), **or**
  - the user picked a team (`home`/`away`) but the match drew
    (group stage only: a 1-point pick — the picked team drew).

### Worked relationship to scoring

The four tiebreaker counts are derived from the same (pick, result) pair as the points,
so they partition every scored pick exactly once:

| Group-stage outcome                          | Points | Counts toward      |
|----------------------------------------------|:------:|--------------------|
| Picked team, that team won                   | 3      | `wins_correct`     |
| Picked team, that team lost                  | 0      | `losses`           |
| Picked team, match drew                      | 1      | `draws_incorrect`  |
| Picked `draw`, match drew                    | 2      | `draws_correct`    |
| Picked `draw`, a team won                    | 1      | `draws_incorrect`  |

| Knockout-stage outcome                       | Points | Counts toward      |
|----------------------------------------------|:------:|--------------------|
| Picked team, that team advanced              | 3      | `wins_correct`     |
| Picked team, that team eliminated            | 0      | `losses`           |
| Picked `draw` (any knockout result)          | 0      | `draws_incorrect`  |

Every scored pick lands in exactly one of the four buckets, so for any user
`wins_correct + losses + draws_correct + draws_incorrect` equals the number of matches
that user picked and that have been scored.

### Comparator semantics

Implement the leaderboard ordering as a **stable comparator** that returns ordered rows
from the API. To compare two users A and B:

1. Higher `total_score` ranks first.
2. If equal, higher `wins_correct` ranks first.
3. If equal, lower `losses` ranks first.
4. If equal, higher `draws_correct` ranks first.
5. If equal, lower `draws_incorrect` ranks first.
6. If still equal, the users are **tied** — present them at the same rank (pot is split).

The comparator must be stable so that genuinely-tied users keep a deterministic,
repeatable order in the response even though they share a rank.
