import { test, expect } from '@playwright/test'

test('home page renders title and heading', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Confidence Picks/)
  await expect(page.getByRole('heading', { name: /Confidence Picks/ })).toBeVisible()
})
