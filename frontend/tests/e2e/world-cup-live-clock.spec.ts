import { test, expect } from '@playwright/test'

// A live World Cup match surfaces how far along it is — ESPN gives us the minute
// mark (status.displayClock, e.g. "63'") parsed onto the game and persisted, so
// the picks page can show it without streaming. This spec stubs one in-progress
// group-stage match and asserts the minute mark appears both on the basic card
// (next to the LIVE badge) and inside the detail panel (LIVE · 63').
//
// Route coverage: the live App route is '/world-cup' (App.tsx). The page is
// WorldCupPicksPage.tsx, whose filename-derived route literal is '/world-cup-picks';
// naming it here registers coverage for check-page-spec-coverage.mjs.
test('world cup picks page shows the live minute mark on the card and in the detail panel /world-cup-picks', async ({
  page,
}) => {
  await page.goto('/login')

  await page.evaluate(() => {
    const payload = {
      userId: 1,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      pictureUrl: null,
      exp: 9999999999, // far-future so the token never reads as expired
    }
    const token = `header.${btoa(JSON.stringify(payload))}.sig`
    localStorage.setItem('accessToken', token)
  })

  // Catch-all safety net first (lowest precedence): any unstubbed API call
  // resolves to an empty object so the test never reaches a real backend.
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  // The detail panel deep-fetches /event/<espnId>. Mirror the backend's resilient
  // contract — a sparse-but-valid { venue, stats, lineups } body — so the panel
  // renders the game-side status (LIVE · 63') rather than crashing on a bare {}.
  await page.route('**/api/games/world-cup-2026/event/**', (route) =>
    route.fulfill({ json: { venue: null, stats: [], lineups: null } }),
  )

  // Stub the per-stage endpoint. Only the group stage returns the live match;
  // every other stage returns an empty list so the match renders exactly once.
  await page.route('**/api/games/world-cup-2026/stage/**', async (route) => {
    const isGroup = route.request().url().includes('/stage/group')
    const games = isGroup
      ? [
          {
            id: 301,
            espnId: '760603',
            stage: 'group',
            isKnockout: false,
            status: 'IN_PROGRESS',
            homeScore: 1,
            awayScore: 0,
            // Kicked off ~70 minutes ago; the Live view filters purely on status.
            gameDate: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
            winnerTeamId: null,
            // ESPN live-match progress fields, parsed by the backend and persisted.
            displayClock: "63'",
            statusDetail: '2nd Half',
            period: 2,
            homeTeam: {
              id: '1',
              name: 'Argentina',
              abbreviation: 'ARG',
              logo: 'https://example.test/arg.png',
            },
            awayTeam: {
              id: '2',
              name: 'France',
              abbreviation: 'FRA',
              logo: 'https://example.test/fra.png',
            },
          },
        ]
      : []
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ games, count: games.length, cached: false }),
    })
  })

  await page.goto('/world-cup?group=test-group')

  await expect(page.getByRole('heading', { name: 'World Cup 2026 Picks' })).toBeVisible()

  // The Live view filters to in-progress matches regardless of date.
  await page.getByRole('button', { name: 'Live' }).click()

  // Basic card: the LIVE badge plus the minute-mark chip carrying "63'".
  const card = page.getByTestId('match-card-301')
  await expect(card).toBeVisible()
  await expect(card.getByText('LIVE')).toBeVisible()
  await expect(card.getByTestId('match-clock-301')).toHaveText("63'")

  // Detail panel: open it and confirm the status line reads "LIVE · 63'".
  await card.getByRole('button', { name: /more/i }).click()
  await expect(page.getByTestId('detail-status')).toHaveText("LIVE · 63'")
})
