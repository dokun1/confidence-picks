import { test, expect } from '@playwright/test'

// LoginPage offers two OAuth entry points. baseURL is configured in
// playwright.config.ts, so navigate with the relative '/login' path (also what
// scripts/check-page-spec-coverage.mjs scans for to confirm route coverage).
// Buttons are matched by accessible name: 'Google' for the styled native
// button, 'Apple' for the ported AppleSignInButton.
test('login page renders Google and Apple sign-in buttons', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Apple/ })).toBeVisible()
})

// Clicking Google triggers AuthService.login(), which starts the OAuth flow by
// assigning window.location.href = `${apiBase}/auth/google`. We intercept that
// navigation request instead of letting the browser follow it to a backend we
// don't run in e2e. Fulfilling the route with a stub body keeps the test
// hermetic while still proving the redirect target is the backend OAuth start.
test('clicking Google starts navigation to the backend /auth/google endpoint', async ({ page }) => {
  let navigatedUrl = ''
  await page.route('**/auth/google', (route) => {
    navigatedUrl = route.request().url()
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' })
  })

  await page.goto('/login')

  await page.getByRole('button', { name: /Google/ }).click()

  await expect.poll(() => navigatedUrl).toContain('/auth/google')
})
