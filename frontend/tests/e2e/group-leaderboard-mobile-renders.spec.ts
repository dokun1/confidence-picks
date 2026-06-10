import { test, expect } from '@playwright/test'

// On a phone-width viewport the World Cup leaderboard drops the bordered table
// "card" (which forced horizontal scrolling and clipped columns) in favor of a
// card-free stacked list: one entry per member with rank + avatar + name +
// emphasized points, and the four tiebreakers below as a 4-up stat-chip grid.
// The desktop <table> is display:none at this width, and the page must not
// scroll horizontally. We also prove the member avatar loads (the photo, not
// the initials fallback). Same auth/stub pattern as the desktop spec.
test('world cup leaderboard renders a card-free stat grid on mobile', async ({ page }) => {
  // Phone-width viewport — below the `sm` (640px) breakpoint.
  await page.setViewportSize({ width: 390, height: 844 })

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

  // Serve a real 1x1 PNG for the avatar URL so the <img> actually loads.
  await page.route('**/ada.png*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      ),
    }),
  )

  // Leaderboard endpoint: two members. Ada carries a pictureUrl so her row
  // avatar renders the photo. Values are distinct so each can be located.
  await page.route('**/api/picks/group/**/world-cup/leaderboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        leaderboard: [
          {
            userId: 1,
            name: 'Ada Lovelace',
            pictureUrl: 'https://cdn.example.com/ada.png',
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

  // Group detail mount fans out to getGroup / getMembers / getMessages.
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
  await expect(page.getByRole('heading', { name: 'World Cup Squad' })).toBeVisible()

  // The mobile stacked list is visible; the desktop table is hidden at this
  // viewport (it carries `hidden sm:block`).
  const list = page.getByRole('list')
  await expect(list).toBeVisible()
  await expect(page.getByRole('table')).toBeHidden()

  // One list item per member, names visible.
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByText('Ada Lovelace')).toBeVisible()
  await expect(list.getByText('Grace Hopper')).toBeVisible()

  // The stat-chip grid surfaces the tiebreakers with their short labels.
  await expect(list.getByText('Wins').first()).toBeVisible()
  await expect(list.getByText('Losses').first()).toBeVisible()
  // Points emphasis: the "pts" label appears once per member.
  await expect(list.getByText('pts').first()).toBeVisible()

  // Ada's avatar is her photo, not initials: the list <img> is visible and the
  // served PNG decoded (naturalWidth > 0).
  const adaAvatar = list.getByRole('img', { name: 'Ada Lovelace' })
  await expect(adaAvatar).toBeVisible()
  await expect
    .poll(() => adaAvatar.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)

  // The mobile layout must not introduce horizontal scrolling. Allow a 1px
  // tolerance for subpixel rounding (scrollWidth can exceed clientWidth by <1px
  // on some platforms without any real overflow).
  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflowX).toBeLessThanOrEqual(1)
})
