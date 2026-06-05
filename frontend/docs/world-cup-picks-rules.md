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

## Tiebreakers

<!-- PLACEHOLDER — filled in by a following sub-task.
     Summary of intended content (do not treat as final spec), applied in order:
       1. Most wins correctly picked
       2. Fewest losses
       3. Most draws correctly picked
       4. Fewest draws incorrectly picked
       5. Split the pot among those still tied. -->

_To be authored in a following sub-task._
