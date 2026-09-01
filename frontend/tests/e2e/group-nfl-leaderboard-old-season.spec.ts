import { test, expect } from '@playwright/test'

// Regression guard for old groups losing their scores after the NFL season
// rolls over. In the OFFSEASON an NFL (non-World-Cup) group's Leaderboard tab —
// the page's default tab — must render real standings from GET .../scoreboard
// for the newest season that has pick data (2025 here), not an empty "current
// season" view or the old "Leaderboard coming soon" placeholder. Once the new
// season is under way the tab lands on it instead; that case is covered below.
// All API calls are stubbed so the flow never reaches a real backend, and the
// clock is pinned so the result never depends on the machine's calendar date.
test('old NFL group leaderboard renders past-season standings', async ({ page }) => {
  // The season default is now date-aware: the current season wins while it is
  // under way, and the newest season with data wins in the offseason. Pin the
  // clock to June so this spec keeps its original meaning (and its promise not
  // to depend on the machine's calendar date).
  await page.clock.setFixedTime(new Date('2026-06-15T12:00:00Z'))

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

  // Capture the scoreboard request so the asserted season is the one the
  // frontend actually asked for.
  let scoreboardQuery: URLSearchParams | null = null

  await page.route('**/api/groups/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path.endsWith('/members') || path.endsWith('/messages')) {
      await route.fulfill({ json: [] })
      return
    }
    if (path.endsWith('/picks/seasons')) {
      // The group's only pick data is in 2025 — the leaderboard must default
      // its season selector here instead of the empty current season.
      await route.fulfill({ json: { seasons: [2025] } })
      return
    }
    if (path.endsWith('/scoreboard')) {
      scoreboardQuery = url.searchParams
      await route.fulfill({
        json: {
          season: 2025,
          seasonType: 2,
          weeks: [1, 2],
          users: [
            {
              userId: 1,
              name: 'Ada Lovelace',
              pictureUrl: null,
              weekly: [
                { week: 1, points: 10 },
                { week: 2, points: 5 },
              ],
              totalPoints: 15,
            },
            {
              userId: 2,
              name: 'Grace Hopper',
              pictureUrl: null,
              weekly: [
                { week: 1, points: 3 },
                { week: 2, points: 4 },
              ],
              totalPoints: 7,
            },
          ],
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

  // The leaderboard is the default tab: the old placeholder is gone and the
  // standings render for the 2025 season, ranked by total points.
  await expect(page.getByText('Leaderboard coming soon')).toHaveCount(0)
  await expect(page.getByLabel('Select season')).toHaveValue('2025')

  const standings = page.getByRole('list')
  await expect(standings.getByText('Ada Lovelace')).toBeVisible()
  await expect(standings.getByText('15')).toBeVisible()
  await expect(standings.getByText('Grace Hopper')).toBeVisible()
  await expect(standings.getByText('7')).toBeVisible()

  // Weekly breakdown table shows each scored week plus the total column.
  await expect(page.getByRole('columnheader', { name: 'W1' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'W2' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Total' })).toBeVisible()

  // And the request that produced it targeted the old season with data.
  expect(scoreboardQuery).not.toBeNull()
  expect(scoreboardQuery!.get('season')).toBe('2025')
})

// The companion case: once the new season is under way, the same group with the
// same past-season data lands on the CURRENT season instead. A season is a
// fresh slate, so Week 1 must not open on last season's final standings — and
// the prior season stays one dropdown click away.
test('in-season, the same old group lands on the current season', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-15T12:00:00Z'))

  await page.goto('/login')

  await page.evaluate(() => {
    const payload = {
      userId: 1,
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      pictureUrl: null,
      exp: 9999999999,
    }
    const token = `header.${btoa(JSON.stringify(payload))}.sig`
    localStorage.setItem('accessToken', token)
  })

  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  const requestedSeasons: string[] = []

  await page.route('**/api/groups/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path.endsWith('/members') || path.endsWith('/messages')) {
      await route.fulfill({ json: [] })
      return
    }
    if (path.endsWith('/picks/seasons')) {
      // Same old group: its only pick data is 2025, and 2026 has nothing yet.
      await route.fulfill({ json: { seasons: [2025] } })
      return
    }
    if (path.endsWith('/scoreboard')) {
      const season = url.searchParams.get('season') ?? ''
      requestedSeasons.push(season)
      if (season === '2025') {
        await route.fulfill({
          json: {
            season: 2025,
            seasonType: 2,
            weeks: [1],
            users: [
              { userId: 1, name: 'Ada Lovelace', pictureUrl: null, weekly: [{ week: 1, points: 15 }], totalPoints: 15 },
            ],
          },
        })
        return
      }
      // 2026 has no scored picks yet.
      await route.fulfill({ json: { season: 2026, seasonType: 2, weeks: [], users: [] } })
      return
    }
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

  // Lands on the current season, empty, with the reason spelled out.
  await expect(page.getByLabel('Select season')).toHaveValue('2026')
  await expect(page.getByText(/No points yet for the 2026 season/)).toBeVisible()
  expect(requestedSeasons).toContain('2026')

  // Last season's standings are still one click away.
  await page.getByLabel('Select season').selectOption('2025')
  await expect(page.getByRole('list').getByText('Ada Lovelace')).toBeVisible()
  await expect(page.getByRole('list').getByText('15')).toBeVisible()
})
