import { test, expect } from '@playwright/test'

// Regression: the "needs pick" view must exclude knockout games whose
// participants aren't decided yet. We seed TWO structurally identical r32 ties —
// both future-dated, unpicked, single-elimination — differing ONLY in whether the
// bracket has decided their teams:
//   - game 301 (FRA vs ESP): two real, qualified teams           -> needs a pick
//   - game 302 (POR vs "Winner Group A", isActive:false): a slot
//     is still an undecided bracket placeholder                  -> must NOT need a pick
// Before the fix, game 302 wrongly appeared in "Needs pick" even though its pick
// buttons are disabled (you can't pick a team that isn't decided yet).
//
// '/world-cup-needs-pick' is named here purely so check-page-spec-coverage.mjs's
// filename-derived substring match keeps registering this page's coverage.

const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString()
const realTeam = (id: string, name: string, abbr: string) => ({ id, name, abbreviation: abbr, logo: '', isActive: true })
// An undecided knockout slot, as real ESPN data shapes it: a descriptive
// placeholder name flagged isActive:false (see WORLD_CUP_2026_API.md).
const placeholder = (name: string, abbr: string) => ({ id: `tbd-${abbr}`, name, abbreviation: abbr, logo: '', isActive: false })

const decidedGame = {
  id: 301, stage: 'r32', isKnockout: true, status: 'SCHEDULED', homeScore: 0, awayScore: 0,
  gameDate: inDays(3), winnerTeamId: null,
  homeTeam: realTeam('478', 'France', 'FRA'), awayTeam: realTeam('164', 'Spain', 'ESP'),
}
const undecidedGame = {
  id: 302, stage: 'r32', isKnockout: true, status: 'SCHEDULED', homeScore: 0, awayScore: 0,
  gameDate: inDays(3), winnerTeamId: null,
  homeTeam: realTeam('382', 'Portugal', 'POR'), awayTeam: placeholder('Winner Group A', 'WGA'),
}

async function seed(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.evaluate(() => {
    const payload = { userId: 1, email: 'ada@example.com', name: 'Ada Lovelace', pictureUrl: null, exp: 9999999999 }
    localStorage.setItem('accessToken', `header.${btoa(JSON.stringify(payload))}.sig`)
  })
  // Catch-all so nothing escapes to a real backend; the stage stub wins (registered last).
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))
  await page.route('**/api/games/world-cup-2026/stage/**', async (route) => {
    const games = route.request().url().includes('/stage/r32') ? [decidedGame, undecidedGame] : []
    await route.fulfill({ json: { games, count: games.length, cached: false } })
  })
  await page.goto('/world-cup?group=test-group')
  await expect(page.getByRole('heading', { name: 'World Cup 2026 Picks' })).toBeVisible()
}

test('needs-pick excludes an undecided knockout game but keeps the decided one', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: 'Needs pick' }).click()

  await expect(page.getByTestId('match-card-301')).toBeVisible()
  await expect(page.getByTestId('match-card-302')).toHaveCount(0)
})

test('the undecided game still lists under "All", with its picks disabled', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: 'All', exact: true }).click()

  await expect(page.getByTestId('match-card-301')).toBeVisible()
  const undecided = page.getByTestId('match-card-302')
  await expect(undecided).toBeVisible()
  await expect(undecided.getByRole('button', { name: 'POR' })).toBeDisabled()
  await expect(undecided.getByRole('button', { name: 'WGA' })).toBeDisabled()
})
