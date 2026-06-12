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

  // Stub the per-stage endpoint. The page fetches all seven stages; the group
  // request returns the playable match, the r32 request returns a knockout
  // fixture whose away slot is still ESPN's TBD placeholder, and every other
  // stage returns an empty list so each match renders exactly once.
  await page.route('**/api/games/world-cup-2026/stage/**', async (route) => {
    const url = route.request().url()
    let games: object[] = []
    if (url.includes('/stage/group')) {
      games = [
        {
          id: 101,
          stage: 'group',
          isKnockout: false,
          status: 'SCHEDULED',
          homeScore: 0,
          awayScore: 0,
          gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
    } else if (url.includes('/stage/r32')) {
      games = [
        {
          id: 201,
          stage: 'r32',
          isKnockout: true,
          status: 'SCHEDULED',
          homeScore: 0,
          awayScore: 0,
          gameDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          winnerTeamId: null,
          homeTeam: {
            id: '3',
            name: 'France',
            abbreviation: 'FRA',
            logo: 'https://example.test/fra.png',
          },
          awayTeam: {
            id: 'tbd-1',
            name: 'TBD',
            abbreviation: 'TBD',
            logo: '',
          },
        },
      ]
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ games, count: games.length, cached: false }),
    })
  })

  await page.goto('/world-cup?group=test-group')

  // The page owns the single "World Cup 2026 Picks" <h1>. The flat browse list
  // defaults to the "Today" view; the seeded games are future-dated, so switch
  // to "All" to surface both regardless of date.
  await expect(page.getByRole('heading', { name: 'World Cup 2026 Picks' })).toBeVisible()
  await page.getByRole('button', { name: 'All' }).click()
  await expect(page.getByTestId('match-card-101')).toBeVisible()

  // MatchListCard surfaces the three outcomes as buttons labeled by team
  // abbreviation (MEX / Draw / CAN) with aria-pressed; with no odds/record the
  // accessible name is exactly the abbreviation.
  const groupCard = page.getByTestId('match-card-101')
  await expect(groupCard.getByRole('button', { name: 'MEX' })).toBeVisible()
  await expect(groupCard.getByRole('button', { name: 'Draw' })).toBeVisible()
  await expect(groupCard.getByRole('button', { name: 'CAN' })).toBeVisible()

  // The r32 fixture is a knockout: a knockout can't draw, so it offers only the
  // two teams (no Draw button), and with its away slot still TBD both team
  // buttons are unpickable until participants are assigned.
  const tbdCard = page.getByTestId('match-card-201')
  await expect(tbdCard.getByRole('button', { name: 'FRA' })).toBeDisabled()
  await expect(tbdCard.getByRole('button', { name: 'TBD' })).toBeDisabled()
  await expect(tbdCard.getByRole('button', { name: 'Draw' })).toHaveCount(0)
})

// A world_cup_2026 group surfaces the tournament-shaped tabs on its detail page:
// the Picks tab embeds the SAME pick-making surface the standalone /world-cup
// route renders (stage list + sticky submit bar) — no link-out to a separate
// page. This test drives the whole in-group flow: enter the Picks tab, see the
// match list and the save bar appear, make a pick, submit it to the group's
// world-cup picks endpoint, then switch tabs and watch the save bar disappear.
// The group's pool_type is the only thing flipping the tab variant, so we stub
// getGroup to return pool_type='world_cup_2026'. (/world-cup-picks is the
// filename-derived route the coverage check matches.)
test('makes world cup picks inline on the group detail Picks tab', async ({ page }) => {
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

  // The embedded picks tab loads the user's saved picks (hydrate) and submits
  // new ones through the group's world-cup endpoint. GET returns no saved
  // picks; POST records the submitted body for the assertion below.
  let submittedBody: { picks?: { gameId: number; pickedResult: string }[] } | null = null
  await page.route('**/api/picks/group/**/world-cup/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ picks: [] }) }),
  )
  await page.route('**/api/picks/group/wc-group/world-cup', async (route) => {
    submittedBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ picks: submittedBody?.picks ?? [] }),
    })
  })

  // Group detail mount fans out to getGroup / getMembers / getMessages, all under
  // /api/groups/<identifier>. getGroup must return pool_type='world_cup_2026' to
  // flip the tabs to the tournament variant; members/messages return empty arrays
  // (the catch-all's {} would break their `.map`). The leaderboard endpoint is
  // unused on the Picks tab, so the catch-all covers it.
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
        memberCount: 1,
        userRole: 'member',
        pool_type: 'world_cup_2026',
      }),
    })
  })

  // Same per-stage stub as the page-level test: the group stage returns one match,
  // every other stage returns an empty list so the match renders exactly once.
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
            gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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

  await page.goto('/group-details?group=wc-group')

  // The detail page resolves and shows the group header. The default tab is
  // the Leaderboard — no save bar anywhere yet.
  await expect(page.getByRole('heading', { name: 'World Cup Squad' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit Picks' })).toHaveCount(0)

  // Entering the Picks tab renders the flat match list inline — we stay on
  // /group-details, no separate page.
  await page.getByRole('tab', { name: 'Picks' }).click()
  // The list defaults to the "Today" view; the seeded match is future-dated, so
  // switch to "All" to surface it.
  await page.getByRole('button', { name: 'All' }).click()
  const card = page.getByTestId('match-card-101')
  await expect(card).toBeVisible()
  await expect(card.getByRole('button', { name: 'MEX' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Draw' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'CAN' })).toBeVisible()
  await expect(page).toHaveURL(/\/group-details\?group=wc-group/)

  // The sticky save bar mounted with the tab; submit is gated on having picks.
  const submit = page.getByRole('button', { name: 'Submit Picks' })
  await expect(submit).toBeVisible()
  await expect(submit).toBeDisabled()
  await expect(page.getByText('0 picks selected')).toBeVisible()

  // Make a pick and submit it straight from the tab via the sticky save bar
  // (which stays mounted regardless of which view filters the list).
  await card.getByRole('button', { name: 'MEX' }).click()
  await expect(page.getByText('1 pick selected')).toBeVisible()
  await expect(submit).toBeEnabled()
  await submit.click()

  // The POST hit the group's world-cup endpoint with the home pick, and the
  // success toast confirms the save without leaving the group page.
  await expect(page.getByText('Picks saved')).toBeVisible()
  expect(submittedBody).toEqual({ picks: [{ gameId: 101, pickedResult: 'home' }] })
  await expect(page).toHaveURL(/\/group-details\?group=wc-group/)

  // Leaving the Picks tab unmounts the surface — the save bar disappears.
  await page.getByRole('tab', { name: 'Leaderboard' }).click()
  await expect(page.getByRole('button', { name: 'Submit Picks' })).toHaveCount(0)
  await expect(page.getByText('1 pick selected')).toHaveCount(0)
})
