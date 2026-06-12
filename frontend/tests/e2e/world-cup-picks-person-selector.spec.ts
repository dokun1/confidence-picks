import { test, expect, type Page } from '@playwright/test'

// End-to-end coverage for the World Cup "Picking for" person selector — the
// control that lets members VIEW each other's picks and lets admins OVERRIDE
// them. Two flows are exercised against a stubbed backend:
//
//   1. Admin override (success): an admin switches to a teammate, makes a pick,
//      and saves it through the per-user endpoint (POST .../world-cup/user/2).
//   2. Non-admin read-only (failure-to-write): a plain member switches to a
//      teammate, sees the read-only banner, and has NO submit affordance at all
//      — the accidental-pick guard the whole feature exists to provide.
//
// The seeded JWT carries userId:1 (Ada), so the members roster below lists Ada
// as the caller ("You") plus Bob as the teammate the selector targets.

// Seed a far-future, JWT-shaped token so AuthProvider treats us as Ada (id 1)
// and ProtectedRoute lets /group-details through.
async function signIn(page: Page) {
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
}

// Stub the group mount fetches (getGroup / getMembers / getMessages). `userRole`
// flips the caller between admin and plain member; the roster always has Ada (the
// caller) + Bob (the teammate the selector targets).
async function stubGroup(page: Page, userRole: 'admin' | 'member') {
  await page.route('**/api/groups/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/members')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: userRole, joined_at: '2026-01-01T00:00:00.000Z', picture_url: null },
          { id: 2, name: 'Bob Stone', email: 'bob@example.com', role: 'member', joined_at: '2026-01-01T00:00:00.000Z', picture_url: null },
        ]),
      })
      return
    }
    if (url.includes('/messages')) {
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
        userRole,
        pool_type: 'world_cup_2026',
      }),
    })
  })
}

// One group-stage match; every other stage is empty so it renders exactly once.
async function stubStages(page: Page) {
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
            homeTeam: { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: 'https://example.test/mex.png' },
            awayTeam: { id: '2', name: 'Canada', abbreviation: 'CAN', logo: 'https://example.test/can.png' },
          },
        ]
      : []
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ games, count: games.length, cached: false }),
    })
  })
}

test('admin can override a teammate and save via the per-user endpoint', async ({ page }) => {
  await signIn(page)

  // Catch-all safety net first (lowest precedence) — no call reaches a real backend.
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  await stubGroup(page, 'admin')
  await stubStages(page)

  // Self hydrate returns no saved picks.
  await page.route('**/api/picks/group/**/world-cup/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ picks: [] }) }),
  )

  // The per-user endpoint: GET hydrates Bob's (empty) picks as an editable admin;
  // POST records what the admin submits on Bob's behalf.
  let userPostUrl: string | null = null
  let userPostBody: { picks?: { gameId: number; pickedResult: string }[] } | null = null
  await page.route('**/api/picks/group/**/world-cup/user/**', async (route) => {
    if (route.request().method() === 'POST') {
      userPostUrl = route.request().url()
      userPostBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ picks: userPostBody?.picks ?? [], targetUserId: 2, isAdminOverride: true }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ picks: [], canEdit: true }),
    })
  })

  await page.goto('/group-details?group=wc-group')
  await page.getByRole('tab', { name: 'Picks' }).click()
  await expect(page.getByTestId('match-card-101')).toBeVisible()

  // The selector defaults to the caller.
  const personButton = page.getByRole('button', { name: 'Choose whose picks to view or edit' })
  await expect(personButton).toHaveText(/Picking for: You/)

  // Switch to Bob — the admin-override banner and personalised save button appear.
  await personButton.click()
  await page.getByRole('radio', { name: 'Bob Stone' }).click()
  await expect(page.getByText(/Admin override/)).toBeVisible()
  await expect(page.getByText('Saved to this group only')).toBeVisible()

  // Make a pick for Bob and save it. The default "Needs pick" view drops the
  // game from the list once picked, so the save flows through the sticky bar.
  await page.getByTestId('match-card-101').getByRole('button', { name: 'MEX' }).click()
  const save = page.getByRole('button', { name: "Save Bob's Picks" })
  await expect(save).toBeEnabled()
  await save.click()

  // The POST hit the per-user endpoint for user 2 with the home pick.
  await expect(page.getByText("Saved Bob's picks")).toBeVisible()
  expect(userPostUrl).toContain('/world-cup/user/2')
  expect(userPostBody).toEqual({ picks: [{ gameId: 101, pickedResult: 'home' }] })
})

test('non-admin viewing a teammate is strictly read-only — no submit affordance', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  await stubGroup(page, 'member')
  await stubStages(page)

  await page.route('**/api/picks/group/**/world-cup/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ picks: [] }) }),
  )

  // Any POST to the per-user endpoint would be a bug — count attempts so the
  // test fails loudly if one ever fires. GET returns Bob's away pick read-only.
  let userPosts = 0
  await page.route('**/api/picks/group/**/world-cup/user/**', async (route) => {
    if (route.request().method() === 'POST') {
      userPosts += 1
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Only group admins can submit picks for other members' }) })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ picks: [{ gameId: 101, pickedResult: 'away' }], canEdit: false }),
    })
  })

  await page.goto('/group-details?group=wc-group')
  await page.getByRole('tab', { name: 'Picks' }).click()
  await expect(page.getByTestId('match-card-101')).toBeVisible()

  // Switch to "All" so Bob's already-picked game stays in the list — the default
  // "Needs pick" view hides picked games.
  await page.getByRole('button', { name: 'All' }).click()

  // Switch to Bob — read-only banner, no submit button anywhere.
  await page.getByRole('button', { name: 'Choose whose picks to view or edit' }).click()
  await page.getByRole('radio', { name: 'Bob Stone' }).click()
  await expect(page.getByText(/read-only/)).toBeVisible()
  await expect(page.getByText('View only')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit Picks' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Save .*Picks/ })).toHaveCount(0)

  // Bob's away pick is shown but its control is disabled — clicking it changes
  // nothing and never reaches the network.
  const awayBtn = page.getByTestId('match-card-101').getByRole('button', { name: 'CAN' })
  await expect(awayBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(awayBtn).toBeDisabled()
  await awayBtn.click({ force: true }).catch(() => {})
  await expect(page.getByText('View only')).toBeVisible()
  expect(userPosts).toBe(0)
})
