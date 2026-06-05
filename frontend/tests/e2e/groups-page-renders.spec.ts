import { test, expect } from '@playwright/test'

// GroupsPage sits behind ProtectedRoute and fetches the signed-in user's groups
// via getMyGroups() -> GET ${apiBaseUrl}/api/groups/my-groups. We seed a valid,
// far-future JWT-shaped accessToken in localStorage (same pattern as
// profile-page-shows-user.spec.ts) so AuthProvider treats us as authenticated,
// then intercept the my-groups request and fulfill a synthetic group list so the
// populated state renders deterministically. The literal '/groups' below is what
// check-page-spec-coverage.mjs scans for to confirm route coverage.
test('groups page renders the signed-in user groups', async ({ page }) => {
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

  // Fulfill the backend shape getMyGroups() maps from (userRole -> isOwner).
  await page.route('**/api/groups/my-groups', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'g1',
          name: 'Sunday Pickers',
          identifier: 'sunday-pickers',
          description: 'Weekly NFL confidence picks',
          memberCount: 12,
          isOwner: true,
          userRole: 'admin',
          createdAt: '2026-01-15T00:00:00.000Z',
        },
        {
          id: 'g2',
          name: 'Office League',
          identifier: 'office-league',
          description: 'Workplace bragging rights',
          memberCount: 8,
          isOwner: false,
          userRole: 'member',
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ]),
    })
  })

  await page.goto('/groups')

  // The page owns the single "My Groups" <h1> (GroupsList is rendered with
  // showHeader={false}), and each returned group name renders via GroupCard.
  await expect(page.getByRole('heading', { name: 'My Groups' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sunday Pickers' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Office League' })).toBeVisible()
})
