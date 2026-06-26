import { test, expect } from '@playwright/test'

// Regression for the "edit World Cup group shows NFL Weekly" bug. EditGroupPage
// used to omit poolType/knockoutOnly from the form's initialValues, so opening an
// existing World Cup (knockout-only) group defaulted the Pool Type select to NFL.
// getGroup returns pool_type/knockout_only (snake_case from the backend row); the
// edit form must reflect them — and since both are immutable after creation, lock
// the controls. (/edit-group is the filename-derived route the coverage check matches.)
test('editing a World Cup knockout group reflects pool type + knockout (locked)', async ({ page }) => {
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

  // Catch-all safety net first (lowest precedence); the specific getGroup route
  // is registered after so it wins.
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }))

  // getGroup for the edited group: a knockout-only World Cup pool, snake_case shape.
  await page.route('**/api/groups/ltk-world-cup-knockout-picks', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '1',
        name: 'LTK World Cup Knockout Picks',
        identifier: 'ltk-world-cup-knockout-picks',
        description: '',
        maxMembers: 200,
        memberCount: 1,
        userRole: 'admin',
        pool_type: 'world_cup_2026',
        knockout_only: true,
      }),
    }),
  )

  await page.goto('/edit-group/ltk-world-cup-knockout-picks')

  // Pool Type reflects World Cup and is locked (immutable after creation).
  const select = page.getByLabel('Pool Type')
  await expect(select).toBeVisible()
  await expect(select).toHaveValue('world_cup_2026')
  await expect(select).toBeDisabled()
  await expect(page.getByText(/Pool type can.t be changed after creation/)).toBeVisible()

  // Knockout-only is checked and locked.
  const checkbox = page.getByRole('checkbox')
  await expect(checkbox).toBeChecked()
  await expect(checkbox).toBeDisabled()
})
