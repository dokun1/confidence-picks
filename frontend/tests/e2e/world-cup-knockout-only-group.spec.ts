import { test, expect } from '@playwright/test'

// A world_cup_2026 group created with the "knockout stage picks only" setting
// must let members pick ONLY knockout games — the group stage is hidden entirely
// on the Picks tab, and the server rejects any group-stage pick. This e2e drives
// the in-group Picks tab and asserts the group-stage fixture never renders while
// the knockout fixture does, then makes + submits a knockout pick end-to-end.
//
// The knockout-only flag rides on the group object: getGroup returns
// knockout_only=true (snake_case from the backend row), which GroupDetailsPage
// forwards to the embedded WorldCupPicksTab. (/world-cup-picks is the
// filename-derived route the coverage check matches.)
test('knockout-only group hides group-stage games on the Picks tab', async ({ page }) => {
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

  // Catch-all safety net first (lowest precedence). Any unstubbed API call
  // resolves to an empty object so the test never reaches a real backend.
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  // Saved-picks hydrate returns none; the POST records the submitted body.
  let submittedBody: { picks?: { gameId: number; pickedResult: string }[] } | null = null
  await page.route('**/api/picks/group/**/world-cup/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ picks: [] }) }),
  )
  await page.route('**/api/picks/group/ko-group/world-cup', async (route) => {
    submittedBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ picks: submittedBody?.picks ?? [] }),
    })
  })

  // my-groups feeds the tab's fan-out dropdown + the derived knockout-only
  // fallback; return the group as an array so getMyGroups resolves cleanly.
  await page.route('**/api/groups/my-groups', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: '1', identifier: 'ko-group', name: 'Knockout Squad', userRole: 'member', poolType: 'world_cup_2026', knockoutOnly: true },
      ]),
    }),
  )

  // Group detail mount fans out to getGroup / getMembers / getMessages under
  // /api/groups/<identifier>. getGroup must return pool_type='world_cup_2026' to
  // flip the tabs to the tournament variant AND knockout_only=true to enable the
  // setting; members/messages return empty arrays.
  await page.route('**/api/groups/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/my-groups')) return route.fallback() // handled above
    if (url.includes('/members') || url.includes('/messages')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '1',
        name: 'Knockout Squad',
        identifier: 'ko-group',
        memberCount: 1,
        userRole: 'member',
        pool_type: 'world_cup_2026',
        knockout_only: true,
      }),
    })
  })

  // The whole-tournament endpoint returns one group-stage game (must be hidden)
  // and one knockout game (must remain pickable).
  await page.route('**/api/games/world-cup-2026/stages', async (route) => {
    const games = [
      {
        id: 101,
        stage: 'group',
        isKnockout: false,
        status: 'SCHEDULED',
        homeScore: 0,
        awayScore: 0,
        gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        winnerTeamId: null,
        homeTeam: { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: 'https://example.test/mex.png' },
        awayTeam: { id: '2', name: 'Canada', abbreviation: 'CAN', logo: 'https://example.test/can.png' },
      },
      {
        id: 201,
        stage: 'r32',
        isKnockout: true,
        status: 'SCHEDULED',
        homeScore: 0,
        awayScore: 0,
        gameDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        winnerTeamId: null,
        homeTeam: { id: '3', name: 'France', abbreviation: 'FRA', logo: 'https://example.test/fra.png' },
        awayTeam: { id: '4', name: 'Brazil', abbreviation: 'BRA', logo: 'https://example.test/bra.png' },
      },
    ]
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ games, count: games.length, cached: false }),
    })
  })

  await page.goto('/group-details?group=ko-group')

  await expect(page.getByRole('heading', { name: 'Knockout Squad' })).toBeVisible()

  // Enter the Picks tab; switch to the "All" view so date filters don't hide the
  // future-dated knockout fixture.
  await page.getByRole('tab', { name: 'Picks' }).click()
  await page.getByRole('button', { name: 'All' }).click()

  // The knockout game renders and is pickable…
  const knockoutCard = page.getByTestId('match-card-201')
  await expect(knockoutCard).toBeVisible()
  await expect(knockoutCard.getByRole('button', { name: 'FRA' })).toBeVisible()
  await expect(knockoutCard.getByRole('button', { name: 'BRA' })).toBeVisible()
  // A knockout can't draw — no Draw option.
  await expect(knockoutCard.getByRole('button', { name: 'Draw' })).toHaveCount(0)

  // …but the group-stage game is hidden entirely — no card, and the group-stage
  // scoring line is gone from the rules box.
  await expect(page.getByTestId('match-card-101')).toHaveCount(0)
  await expect(page.getByText(/Group stage:/)).toHaveCount(0)

  // Picking the knockout game and submitting posts only that pick to the group's
  // world-cup endpoint.
  await knockoutCard.getByRole('button', { name: 'FRA' }).click()
  await expect(page.getByText('1 pick selected')).toBeVisible()
  await page.getByRole('button', { name: 'Submit Picks' }).click()
  await expect(page.getByText('Picks saved')).toBeVisible()
  expect(submittedBody).toEqual({ picks: [{ gameId: 201, pickedResult: 'home' }] })
})
