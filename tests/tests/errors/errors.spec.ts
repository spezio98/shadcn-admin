import { test, expect } from '@playwright/test'

test.describe('errors', { tag: '@errors' }, () => {
  test("wf.error_page_recovery: The user sees the 401 error page and returns to the dashboard", async ({ page }) => {
    await page.goto('/errors/unauthorized')

    await test.step('Viewing the 401 error page', async () => {
      // errors.unauthorized
      await expect(page.getByRole('heading', { name: '401' })).toBeVisible()
    })

    await test.step("Returning to the dashboard via \"Back to Home\"", async () => {
      // errors.unauthorized / back_to_home_button
      await page.getByRole('button', { name: 'Back to Home' }).click()

      // dashboard.overview / tab_overview
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
    })
  })
})
