import { test, expect } from '@playwright/test'

// The group detail Settings tab renders the member roster flowing bare under
// the tab bar, followed by the Invite Link and Manage Group sections (which
// keep their cards). We seed a valid, far-future JWT-shaped accessToken (same
// pattern as the other authed specs) and stub the group endpoints so the flow
// never reaches a real backend. The page lands on /group-details, so reaching
// settings takes one tab click.
test('group settings tab renders the member roster outside a card', async ({ page }) => {
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

  // Group detail mount fans out to getGroup / getMembers / getMessages.
  // getMembers seeds the roster; messages returns an empty array (the
  // catch-all's {} would break its `.map`).
  await page.route('**/api/groups/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/members')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'm1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            isOwner: true,
            joinedAt: '2026-06-01T00:00:00.000Z',
            pictureUrl: null,
          },
          {
            id: 'm2',
            name: 'Grace Hopper',
            email: 'grace@example.com',
            isOwner: false,
            joinedAt: '2026-06-05T00:00:00.000Z',
            pictureUrl: null,
          },
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
        userRole: 'admin',
        pool_type: 'world_cup_2026',
      }),
    })
  })

  await page.goto('/group-details?group=wc-group')
  await expect(page.getByRole('heading', { name: 'World Cup Squad' })).toBeVisible()

  // Enter the Settings tab: the roster, invite, and manage sections render.
  await page.getByRole('tab', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()
  await expect(page.getByText('ada@example.com')).toBeVisible()
  await expect(page.getByText('grace@example.com')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Invite Link' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Manage Group' })).toBeVisible()

  // The roster flows bare with the page while the invite and manage sections
  // keep their bordered cards.
  const membersSection = page.locator('section', {
    has: page.getByRole('heading', { name: 'Members' }),
  })
  await expect(membersSection).not.toHaveClass(/border/)
  const inviteSection = page.locator('section', {
    has: page.getByRole('heading', { name: 'Invite Link' }),
  })
  await expect(inviteSection).toHaveClass(/border/)
  const manageSection = page.locator('section', {
    has: page.getByRole('heading', { name: 'Manage Group' }),
  })
  await expect(manageSection).toHaveClass(/border/)
})
