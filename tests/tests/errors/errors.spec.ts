import { test, expect } from '@playwright/test'

test.describe('errors', { tag: '@errors' }, () => {
  test("wf.error_page_recovery: L'utente vede la pagina di errore 401 e torna alla dashboard", async ({ page }) => {
    await page.goto('/errors/unauthorized')

    await test.step('Visualizzazione della pagina di errore 401', async () => {
      // errors.unauthorized
      await expect(page.getByRole('heading', { name: '401' })).toBeVisible()
    })

    await test.step("Ritorno alla dashboard tramite \"Back to Home\"", async () => {
      // errors.unauthorized / back_to_home_button
      await page.getByRole('button', { name: 'Back to Home' }).click()

      // dashboard.overview / tab_overview
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
    })
  })
})
