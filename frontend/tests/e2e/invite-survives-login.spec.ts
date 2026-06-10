import { test, expect } from '@playwright/test'

// Regression for the "invite lost after sign-in" bug. A signed-out user who
// opens an invite link used to lose the invite: clicking "Sign in to join"
// stashed nothing the callback could read, so after OAuth they were dumped on
// the home page. This spec drives the whole journey and asserts the invite
// reappears (ready to accept) once they are authenticated.
//
// The OAuth provider round-trip is simulated by fulfilling the backend
// `/auth/google` navigation with a 302 to `/auth/callback?token=…&refresh=…`,
// which is exactly the shape the real backend redirects with (see
// backend/src/routes/auth.js). `/auth/me` is stubbed so AuthCallback can hydrate
// the user. The literals '/invite', '/login' and '/auth/callback' below are also
// what scripts/check-page-spec-coverage.mjs scans for to confirm route coverage.

const TOKEN = 'tok-e2e'

const INVITE = {
  valid: true,
  alreadyMember: false,
  group: {
    identifier: 'cool-group',
    name: 'Cool Group',
    description: 'A friendly competition',
    memberCount: 3,
    maxMembers: 10,
    ownerName: 'Ada Lovelace',
    ownerPictureUrl: '',
  },
  invite: {
    token: TOKEN,
    expiresAt: '2099-01-01T00:00:00Z',
    maxUses: 5,
    uses: 2,
    remainingUses: 3,
  },
}

const USER = {
  id: 1,
  email: 'invitee@example.com',
  name: 'Grace Hopper',
  pictureUrl: null,
  provider: 'google',
}

async function setupMocks(page: import('@playwright/test').Page) {
  // GET invite details (one path segment after /invites — does not match the
  // /accept route below, since glob '*' never crosses a slash).
  await page.route('**/api/invites/*', async (route) => {
    await route.fulfill({ json: INVITE })
  })

  // POST accept → tells InvitePage which group to navigate to.
  await page.route('**/api/invites/*/accept', async (route) => {
    await route.fulfill({
      json: { joined: true, alreadyMember: false, groupIdentifier: 'cool-group' },
    })
  })

  // AuthCallback hydrates the signed-in user from /auth/me.
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({ json: USER })
  })

  // The OAuth provider round-trip, collapsed into one hop: the real backend
  // ultimately redirects to /auth/callback?token=…&refresh=… on success.
  await page.route('**/auth/google', async (route) => {
    await route.fulfill({
      status: 302,
      headers: { location: 'http://localhost:5173/auth/callback?token=A&refresh=B' },
    })
  })
}

test('a signed-out user keeps their invite through the sign-in round-trip', async ({ page }) => {
  await setupMocks(page)

  // 1. Signed-out visit to the invite link shows the invite with a sign-in CTA.
  await page.goto(`/invite/${TOKEN}`)
  await expect(page.getByRole('heading', { name: 'Join Cool Group' })).toBeVisible()
  const signInCta = page.getByRole('button', { name: 'Sign in to join' })
  await expect(signInCta).toBeVisible()

  // 2. The CTA routes to /login carrying the invite in ?next.
  await signInCta.click()
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(`/invite/${TOKEN}`)}`))
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()

  // 3. Starting Google OAuth stashes the destination, then the simulated
  //    provider redirect lands back on /auth/callback and onward.
  await page.getByRole('button', { name: /Google/ }).click()

  // 4. The invite reappears — now authenticated — ready to accept. THIS is the
  //    fix: pre-fix the user would have landed on the home page instead.
  await expect(page).toHaveURL(new RegExp(`/invite/${TOKEN}$`))
  const acceptBtn = page.getByRole('button', { name: 'Accept Invite' })
  await expect(acceptBtn).toBeVisible()

  // 5. Accepting the now-preserved invite takes them into the group.
  await acceptBtn.click()
  await expect(page).toHaveURL(/\/group-details\?group=cool-group$/)
})
