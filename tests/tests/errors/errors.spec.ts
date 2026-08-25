import { test, expect } from '@playwright/test'

test.describe('errors', () => {
  test('wf.error_page_recovery: 401 error page -> Back to Home -> dashboard', async ({ page }) => {
    await page.goto('/errors/unauthorized')

    // errors.unauthorized
    await expect(page.getByRole('heading', { name: '401' })).toBeVisible()

    // errors.unauthorized / back_to_home_button
    await page.getByRole('button', { name: 'Back to Home' }).click()

    // dashboard.overview / tab_overview
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
  })
})
