import { test, expect } from '@playwright/test'

// The group detail Chat tab shows a red unread dot when the group has chat
// messages the current user has not read yet, and the dot clears the moment the
// user opens the Chat tab (which also marks the chat read on the backend). We
// seed a valid, far-future JWT-shaped accessToken (same pattern as the other
// authed specs) and stub the group endpoints — including the new unread/read
// endpoints — so the flow never reaches a real backend.
test('chat tab shows an unread dot that clears when the chat is opened', async ({ page }) => {
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

  // Track whether the client marked the chat read so we can assert the side
  // effect of opening the tab.
  let markedRead = false

  // Catch-all safety net first (lowest precedence): any unstubbed API call
  // resolves to an empty object so the test can never reach a real backend.
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  await page.route('**/api/groups/**', async (route) => {
    const url = route.request().url()
    // Order matters: the more specific message routes must be matched before the
    // bare /messages list route ('/messages/unread' contains '/messages').
    if (url.includes('/messages/unread')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasUnread: true }) })
      return
    }
    if (url.includes('/messages/read')) {
      markedRead = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lastReadAt: '2026-06-14T12:00:00.000Z' }) })
      return
    }
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

  // The unread dot shows on the Chat tab before the user has opened the chat.
  await expect(page.getByTestId('chat-unread-indicator')).toBeVisible()

  // Opening the Chat tab clears the dot and marks the chat read on the backend.
  await page.getByRole('tab', { name: 'Chat' }).click()
  await expect(page.getByText('Who do we like for the final?')).toBeVisible()
  await expect(page.getByTestId('chat-unread-indicator')).toHaveCount(0)
  await expect.poll(() => markedRead).toBe(true)
})
