import { test, expect } from '@playwright/test'

// A world_cup_2026 group's Leaderboard tab fetches
// GET /api/picks/group/<id>/world-cup/leaderboard and renders the
// TournamentLeaderboard table with one row per member, in the order the
// backend returns (the API owns the tiebreaker comparator). We seed a valid,
// far-future JWT-shaped accessToken (same pattern as the other authed specs)
// and stub the group + leaderboard endpoints so the flow never reaches a real
// backend. The leaderboard is the group page's default tab, so landing on
// /group-details renders it without a tab click.
test('world cup group leaderboard tab renders member standings', async ({ page }) => {
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

  // Leaderboard endpoint: two members, already ordered by the backend
  // comparator. The shape mirrors the live route's row payload.
  await page.route('**/api/picks/group/**/world-cup/leaderboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        leaderboard: [
          {
            userId: 1,
            name: 'Ada Lovelace',
            pictureUrl: null,
            rank: 1,
            tied: false,
            points: 5,
            wins_correct: 1,
            losses: 0,
            draws_correct: 1,
            draws_incorrect: 0,
          },
          {
            userId: 2,
            name: 'Grace Hopper',
            pictureUrl: null,
            rank: 2,
            tied: false,
            points: 0,
            wins_correct: 0,
            losses: 1,
            draws_correct: 0,
            draws_incorrect: 0,
          },
        ],
      }),
    })
  })

  // Group detail mount fans out to getGroup / getMembers / getMessages. getGroup
  // must return pool_type='world_cup_2026' so the Leaderboard tab renders the
  // tournament variant; members/messages return arrays (the catch-all's {}
  // would break their `.map`).
  await page.route('**/api/groups/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/members') || url.includes('/messages')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '1',
        name: 'World Cup Squad',
        identifier: 'wc-group',
        memberCount: 2,
        userRole: 'member',
        pool_type: 'world_cup_2026',
      }),
    })
  })

  await page.goto('/group-details?group=wc-group')

  // The detail page resolves, lands on the Leaderboard tab, and renders the
  // tournament table: member rows plus the four tiebreaker column headers.
  await expect(page.getByRole('heading', { name: 'World Cup Squad' })).toBeVisible()

  // The tab itself is the only "Leaderboard" label — the body renders the table
  // bare, with no card wrapper repeating the heading.
  await expect(page.getByRole('tab', { name: 'Leaderboard' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toHaveCount(0)

  await expect(page.getByRole('columnheader', { name: 'Points' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Wins Correct' })).toBeVisible()

  await expect(page.getByRole('rowheader', { name: /Ada Lovelace/ })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: /Grace Hopper/ })).toBeVisible()

  // Standings order is the backend's: Ada (5 pts) above Grace (0 pts).
  const rowheaders = page.locator('tbody th[scope="row"]')
  await expect(rowheaders.first()).toContainText('Ada Lovelace')
  await expect(rowheaders.last()).toContainText('Grace Hopper')
})
