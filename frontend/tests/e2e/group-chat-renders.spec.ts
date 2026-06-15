import { test, expect } from '@playwright/test'

// The group detail Chat tab renders the message log seeded by the page mount's
// getMessages fetch, flowing freely under the tab bar — no enclosing card and
// no duplicate "Chat" heading (the tab itself is the only "Chat" label). We
// seed a valid, far-future JWT-shaped accessToken (same pattern as the other
// authed specs) and stub the group endpoints so the flow never reaches a real
// backend. The page lands on /group-details, so reaching chat takes one tab
// click.
test('group chat tab renders the message log without a card or duplicate title', async ({ page }) => {
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
  // getMessages seeds the chat log; members returns an empty array (the
  // catch-all's {} would break its `.map`).
  await page.route('**/api/groups/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'msg1',
            authorId: 'u2',
            authorName: 'Grace Hopper',
            authorPictureUrl: null,
            content: 'Who do we like for the final?',
            createdAt: '2026-06-09T18:00:00.000Z',
          },
        ]),
      })
      return
    }
    if (url.includes('/members')) {
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

  // Enter the Chat tab: the seeded message and the composer render.
  await page.getByRole('tab', { name: 'Chat' }).click()
  await expect(page.getByText('Who do we like for the final?')).toBeVisible()
  await expect(page.getByText('Grace Hopper')).toBeVisible()
  await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()

  // The tab itself is the only "Chat" label — the body renders the log bare,
  // with no card wrapper repeating the heading.
  await expect(page.getByRole('tab', { name: 'Chat' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Chat' })).toHaveCount(0)

  // The compose bar must be pinned to the viewport bottom so it stays visible
  // while the user scrolls through the message history.
  const composeBar = page.getByPlaceholder('Type your message...').locator('xpath=ancestor::div[contains(@class,"sticky")]').first()
  const position = await composeBar.evaluate((el) => window.getComputedStyle(el).position)
  const bottom = await composeBar.evaluate((el) => window.getComputedStyle(el).bottom)
  expect(position).toBe('sticky')
  expect(bottom).toBe('0px')
})
