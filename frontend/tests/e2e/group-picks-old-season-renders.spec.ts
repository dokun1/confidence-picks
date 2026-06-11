import { test, expect } from '@playwright/test'

// Regression guard for old groups losing their pick history after the NFL
// season rolls over. An NFL group whose pick data lives in a past season (2025
// here) must still land on that season's picks: the Picks tab resolves the
// group's seasons (GET .../picks/seasons), defaults to the newest one WITH
// data — not the empty current calendar season — resolves that season's
// closest week, and renders the member-picks matrix for it. All API calls are
// stubbed so the flow never reaches a real backend and never depends on the
// machine's calendar date.
test('old NFL group picks tab renders the past season picks matrix', async ({ page }) => {
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

  // Catch-all safety net first (lowest precedence): any unstubbed API call
  // resolves to an empty object so the test can never reach a real backend.
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  // Capture the picks request so the asserted season/week are the ones the
  // frontend actually asked for.
  let picksQuery: URLSearchParams | null = null

  await page.route('**/api/groups/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path.endsWith('/members')) {
      await route.fulfill({
        json: [
          { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin', joined_at: '2025-08-01', picture_url: null },
          { id: 2, name: 'Grace Hopper', email: 'grace@example.com', role: 'member', joined_at: '2025-08-02', picture_url: null },
        ],
      })
      return
    }
    if (path.endsWith('/messages')) {
      await route.fulfill({ json: [] })
      return
    }
    if (path.endsWith('/picks/seasons')) {
      // The group's only pick data is in 2025 — an "old" season by the time
      // this runs (the current calendar season is whatever today says).
      await route.fulfill({ json: { seasons: [2025] } })
      return
    }
    if (path.endsWith('/picks/closest')) {
      await route.fulfill({ json: { season: 2025, seasonType: 2, week: 18 } })
      return
    }
    if (path.endsWith('/picks')) {
      picksQuery = url.searchParams
      await route.fulfill({
        json: {
          games: [
            {
              id: 101,
              espnId: 'e101',
              homeTeam: { id: '1', name: 'Patriots', abbreviation: 'NE', logo: '' },
              awayTeam: { id: '2', name: 'Bills', abbreviation: 'BUF', logo: '' },
              homeScore: 20,
              awayScore: 24,
              status: 'FINAL',
              gameDate: '2026-01-04T18:00:00.000Z',
              week: 18,
              season: 2025,
              seasonType: 2,
            },
          ],
          picks: [
            { memberId: '1', picks: [{ gameId: 101, pickedTeamId: '2', confidence: 5, won: true, points: 5 }] },
            { memberId: '2', picks: [{ gameId: 101, pickedTeamId: '1', confidence: 7, won: false, points: -7 }] },
          ],
          availableConfidences: [],
          totalGames: 1,
          pickedCount: 1,
          weekPoints: 5,
        },
      })
      return
    }
    // Group detail mount fetch: a plain NFL pool (no pool_type).
    await route.fulfill({
      json: {
        id: '1',
        name: 'Sunday Squad',
        identifier: 'sunday-squad',
        description: 'Old NFL group',
        memberCount: 2,
        userRole: 'member',
      },
    })
  })

  await page.goto('/group-details?group=sunday-squad')
  await expect(page.getByRole('heading', { name: 'Sunday Squad' })).toBeVisible()

  await page.getByRole('tab', { name: 'Picks' }).click()

  // Season selector defaulted to the old season with data; week resolved to
  // that season's closest (final) week.
  await expect(page.getByLabel('Select season')).toHaveValue('2025')
  await expect(page.getByLabel('Select week')).toHaveValue('18')

  // The matrix renders the 2025 finale with both members' graded picks: Ada's
  // winning BUF pick (+5) and Grace's losing NE pick (-7).
  await expect(page.getByText('BUF @ NE')).toBeVisible()
  await expect(page.getByText('Final 24-20')).toBeVisible()
  await expect(page.getByTitle('Won 5')).toBeVisible()
  await expect(page.getByTitle('Lost -7')).toBeVisible()

  // And the request that produced it targeted the old season, not the current one.
  expect(picksQuery).not.toBeNull()
  expect(picksQuery!.get('season')).toBe('2025')
  expect(picksQuery!.get('week')).toBe('18')
})
