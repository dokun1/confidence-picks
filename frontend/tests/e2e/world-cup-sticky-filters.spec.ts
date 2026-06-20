import { test, expect } from '@playwright/test'

// The picks page (/world-cup) keeps its controls — the search box and the
// view chips — pinned to the top of the viewport while the match list scrolls
// beneath them, and re-anchors the scroll to the start of the results when a
// filter changes (rather than stranding the viewport in empty space below a
// now-shorter list). We seed a long group-stage slate so the page is taller
// than the viewport and actually scrolls.

const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString()
const realTeam = (id: string, name: string, abbr: string) => ({ id, name, abbreviation: abbr, logo: '' })

// 20 distinct group-stage ties, all scheduled in the future so they only show
// under "All" (not the default "Today" view). One tie features Wales so a
// search can narrow the list to a single result.
const TEAMS: [string, string][] = [
  ['Mexico', 'MEX'], ['Canada', 'CAN'], ['Brazil', 'BRA'], ['Argentina', 'ARG'],
  ['France', 'FRA'], ['Spain', 'ESP'], ['Germany', 'GER'], ['Italy', 'ITA'],
  ['England', 'ENG'], ['Portugal', 'POR'], ['Netherlands', 'NED'], ['Belgium', 'BEL'],
  ['Croatia', 'CRO'], ['Uruguay', 'URU'], ['Japan', 'JPN'], ['Korea', 'KOR'],
  ['Senegal', 'SEN'], ['Morocco', 'MAR'], ['Wales', 'WAL'], ['Ghana', 'GHA'],
]

const games = Array.from({ length: 10 }, (_, i) => {
  const [hn, ha] = TEAMS[i * 2]
  const [an, aa] = TEAMS[i * 2 + 1]
  return {
    id: 500 + i, stage: 'group', isKnockout: false, status: 'SCHEDULED',
    homeScore: 0, awayScore: 0, gameDate: inDays(2 + i), winnerTeamId: null,
    homeTeam: realTeam(`h${i}`, hn, ha), awayTeam: realTeam(`a${i}`, an, aa),
  }
})

// Wales plays in game 509 (TEAMS[18]).
const WALES_CARD = 'match-card-509'

async function seed(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.evaluate(() => {
    const payload = { userId: 1, email: 'ada@example.com', name: 'Ada Lovelace', pictureUrl: null, exp: 9999999999 }
    localStorage.setItem('accessToken', `header.${btoa(JSON.stringify(payload))}.sig`)
  })
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))
  // One request for the whole tournament (GET .../stages) → return the full slate.
  await page.route('**/api/games/world-cup-2026/stages', async (route) => {
    await route.fulfill({ json: { games, count: games.length, cached: false } })
  })
  await page.goto('/world-cup?group=test-group')
  await expect(page.getByRole('heading', { name: 'World Cup 2026 Picks' })).toBeVisible()
  // Show every game regardless of date so the list is long enough to scroll.
  await page.getByRole('button', { name: 'All' }).click()
  await expect(page.getByTestId('match-card-500')).toBeVisible()
}

test('the search box and view chips stay pinned to the top while the list scrolls', async ({ page }) => {
  await seed(page)

  const search = page.getByPlaceholder('Search teams…')
  await expect(search).toBeInViewport()

  // Scroll deep into the list. The last card sits well below the fold.
  await page.getByTestId('match-card-509').scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 1200)

  // The controls remain pinned: still in the viewport, and near its top edge.
  await expect(search).toBeInViewport()
  await expect(page.getByRole('button', { name: 'All' })).toBeInViewport()
  const box = await search.boundingBox()
  expect(box!.y).toBeLessThan(160)
})

test('changing a filter while scrolled re-anchors the viewport onto the results', async ({ page }) => {
  await seed(page)

  // Scroll to the very bottom so the viewport is far past the start of the list.
  await page.mouse.wheel(0, 6000)

  // Narrow to a single match by searching a team near the end of the slate.
  await page.getByPlaceholder('Search teams…').fill('Wales')

  // With only one result, a naive scroll would leave the viewport stranded in
  // the empty space below. The re-anchor brings the lone result back on screen.
  const card = page.getByTestId(WALES_CARD)
  await expect(card).toBeVisible()
  await expect(card).toBeInViewport()
})
