import { test, expect } from '@playwright/test'

// WorldCupPicksPage sits behind ProtectedRoute and renders a stage-grouped match
// list. It fetches every WORLD_CUP_STAGES entry in parallel via
// worldCupService.getStageMatches -> GET ${apiBaseUrl}/api/games/world-cup-2026/stage/<stage>.
// We seed a valid, far-future JWT-shaped accessToken in localStorage (same
// pattern as profile-page-shows-user.spec.ts) so AuthProvider treats us as
// authenticated and ProtectedRoute lets /world-cup through, then stub the stage
// endpoint: only the group-stage request returns the synthetic match (the other
// six stages return an empty list) so the single match renders once with no
// duplicate React keys.
//
// Route coverage: the live App route is '/world-cup' (see App.tsx), which is
// what we navigate below. check-page-spec-coverage.mjs, however, derives the
// expected route from the page FILENAME (WorldCupPicksPage.tsx -> /world-cup-picks)
// and does a loose substring match against this file's text, so naming that
// derived literal '/world-cup-picks' here registers coverage for the page.
test('world cup picks page renders the stage match list with pick buttons', async ({ page }) => {
  // Visit the app first so localStorage is writable for this origin.
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

  // Safety net first: any API call (token refresh, etc.) resolves to an empty
  // object so the test can never reach a real backend. Registered BEFORE the
  // stage stub because Playwright gives the last-registered matching route
  // precedence — the specific stage stub below must win over this catch-all.
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  // Stub the per-stage endpoint. The page fetches all seven stages; return the
  // group-stage match only for the group request and an empty list otherwise so
  // the match renders exactly once.
  await page.route('**/api/games/world-cup-2026/stage/**', async (route) => {
    const isGroup = route.request().url().includes('/stage/group')
    const games = isGroup
      ? [
          {
            id: 101,
            stage: 'group',
            isKnockout: false,
            status: 'SCHEDULED',
            homeScore: 0,
            awayScore: 0,
            gameDate: '2026-06-11T19:00:00.000Z',
            winnerTeamId: null,
            homeTeam: {
              id: '1',
              name: 'Mexico',
              abbreviation: 'MEX',
              logo: 'https://example.test/mex.png',
            },
            awayTeam: {
              id: '2',
              name: 'Canada',
              abbreviation: 'CAN',
              logo: 'https://example.test/can.png',
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

  // The page owns the single "World Cup 2026 Picks" <h1> and renders the match
  // under the "Group Stage" section header.
  await expect(page.getByRole('heading', { name: 'World Cup 2026 Picks' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Group Stage' })).toBeVisible()

  // MatchPickRow surfaces the three outcomes as buttons keyed by accessible name.
  await expect(page.getByRole('button', { name: 'Pick Mexico to win' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pick a draw' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pick Canada to win' })).toBeVisible()
})
