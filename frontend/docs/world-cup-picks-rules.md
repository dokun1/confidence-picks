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

## Knockout Scoring

<!-- PLACEHOLDER — filled in by a following sub-task.
     Summary of intended content (do not treat as final spec):
     knockout matches always have an advancing team (the advancer is the scoring
     "winner" even when 90 minutes were level and the result came via extra time or
     penalties); a `draw` pick on a knockout match scores 0. -->

_To be authored in a following sub-task._

---

## Tiebreakers

<!-- PLACEHOLDER — filled in by a following sub-task.
     Summary of intended content (do not treat as final spec), applied in order:
       1. Most wins correctly picked
       2. Fewest losses
       3. Most draws correctly picked
       4. Fewest draws incorrectly picked
       5. Split the pot among those still tied. -->

_To be authored in a following sub-task._
