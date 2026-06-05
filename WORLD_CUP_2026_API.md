# ESPN API Endpoints for World Cup 2026

## Overview

The ESPN public API supports FIFA World Cup 2026 data. The tournament runs **June 11 – July 19, 2026** across the USA, Mexico, and Canada.

- **League ID:** 606
- **Slug:** `fifa.world`
- **Base URL:** `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world`

---

## Endpoints

### Core Scoreboard

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
```

Returns all games for the current day with scores, status, odds, and team info.

---

### Scoreboard by Date

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611
```

Returns games for a specific date (format: `YYYYMMDD`).

---

### Scoreboard by Group/Round

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611&groups=1
```

Filter by tournament stage using the `groups` parameter:

| Value | Stage |
|-------|-------|
| `1` | Group Stage |
| `2` | Round of 32 |
| `3` | Round of 16 |
| `4` | Quarterfinals |
| `5` | Semifinals |
| `6` | 3rd-Place Match |
| `7` | Final |

---

### Single Game Details

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=760415
```

Returns detailed match info including lineups, play-by-play, and stats.

---

### Team Info

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/203
```

Returns all teams or a specific team by ID (e.g., `203` = Mexico).

---

### Standings/Groups

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/standings
```

Returns group stage standings with points, goal difference, etc.

---

### Schedule (Full Tournament)

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719
```

Date range covering the entire tournament.

---

## Tournament Calendar

| Stage | Dates | API Value |
|-------|-------|-----------|
| Group Stage | Jun 11-27 | `1` |
| Round of 32 | Jun 28-Jul 3 | `2` |
| Round of 16 | Jul 4-7 | `3` |
| Quarterfinals | Jul 9-11 | `4` |
| Semifinals | Jul 14-15 | `5` |
| 3rd-Place Match | Jul 18 | `6` |
| Final | Jul 19 | `7` |

---

## Data Structure Differences (vs NFL)

| Field | NFL | World Cup |
|-------|-----|-----------|
| Teams | `homeTeam` / `awayTeam` | `competitors[]` with `homeAway` field |
| Score | `homeScore` / `awayScore` | `competitors[].score` |
| Status | `status.type.name` | Same (`STATUS_SCHEDULED`, `STATUS_FINAL`, etc.) |
| Odds | 2-way (home/away) | 3-way (home/draw/away) |
| Venue | Present | Present (slightly different structure) |

---

## Key Considerations for Implementation

### 1. Draw Handling
Soccer games can end in a draw during group stage. The API includes `drawOdds` in the odds data:

```json
"drawOdds": {
  "moneyLine": 300
}
```

For confidence picks scoring:
- **Group Stage:** Draws are possible — decide how to score (0 points? push?)
- **Knockout Rounds:** Games go to extra time/penalties — always a winner

### 2. Competitor Array Structure
Unlike NFL with separate `homeTeam`/`awayTeam`, World Cup uses:

```json
"competitors": [
  {
    "id": "203",
    "homeAway": "home",
    "score": "0",
    "team": {
      "abbreviation": "MEX",
      "displayName": "Mexico",
      "logo": "..."
    }
  },
  {
    "id": "467",
    "homeAway": "away",
    "score": "0",
    "team": {
      "abbreviation": "RSA",
      "displayName": "South Africa"
    }
  }
]
```

### 3. Playoff Placeholders
Before qualifiers finish, some games show placeholder teams:
- `"Winner Playoff Path D"`
- `"Winner Group A"`

Check `team.isActive` field — placeholders have `isActive: false`.

### 4. Game Status Values
Same as NFL:
- `STATUS_SCHEDULED` — not started
- `STATUS_IN_PROGRESS` — live
- `STATUS_HALFTIME` — halftime
- `STATUS_FINAL` — completed
- `STATUS_POSTPONED` — delayed

---

## Sample API Response (Abbreviated)

```json
{
  "leagues": [{
    "id": "606",
    "name": "FIFA World Cup",
    "slug": "fifa.world",
    "season": {
      "year": 2026,
      "displayName": "2026 FIFA World Cup"
    }
  }],
  "events": [{
    "id": "760415",
    "date": "2026-06-11T19:00Z",
    "name": "South Africa at Mexico",
    "shortName": "RSA @ MEX",
    "status": {
      "type": {
        "name": "STATUS_SCHEDULED",
        "state": "pre",
        "completed": false
      }
    },
    "competitions": [{
      "competitors": [
        { "homeAway": "home", "score": "0", "team": { "abbreviation": "MEX" }},
        { "homeAway": "away", "score": "0", "team": { "abbreviation": "RSA" }}
      ],
      "odds": [{
        "moneyline": {
          "home": { "close": { "odds": "-175" }},
          "away": { "close": { "odds": "+500" }},
          "draw": { "close": { "odds": "+300" }}
        }
      }]
    }]
  }]
}
```

---

## Notes

- **No API key required** — public endpoints
- **Rate limiting** — unknown, but be reasonable with request frequency
- **CORS** — may need backend proxy for browser requests
- **Odds provider** — DraftKings (same as NFL)
