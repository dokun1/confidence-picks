import { test, expect } from '@playwright/test'

// CreateGroupPage sits behind ProtectedRoute and renders the CreateGroupForm
// component directly (no fetch on mount). We seed a valid, far-future JWT-shaped
// accessToken in localStorage (same pattern as profile-page-shows-user.spec.ts
// and groups-page-renders.spec.ts) so AuthProvider treats us as authenticated,
// then navigate to the page. A catch-all '**/api/**' stub is registered for
// safety even though the page issues no requests. The literal '/create-group'
// below is what check-page-spec-coverage.mjs scans for to confirm route coverage.
test('create group page renders the create group form', async ({ page }) => {
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

  // Safety net: CreateGroupPage renders CreateGroupForm with no fetch, but stub
  // any stray API call so the test can never hit a real backend.
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  await page.goto('/create-group')

  // Placeholder assertion (full coverage lands in the next sub-task): the form's
  // "Create New Group" heading confirms the page mounted behind ProtectedRoute.
  await expect(page.getByRole('heading', { name: 'Create New Group' })).toBeVisible()
})
