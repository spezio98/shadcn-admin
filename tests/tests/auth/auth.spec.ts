import { test, expect } from '@playwright/test'

test.describe('auth', { tag: '@auth' }, () => {
  test("wf.auth_navigation_loop: L'utente naviga tra accesso, recupero password e registrazione, e torna ad accesso", async ({
    page,
  }) => {
    await page.goto('/sign-in')

    await test.step('Apertura della pagina di recupero password dal login', async () => {
      // auth.sign_in / forgot_password_link
      await page.getByRole('link', { name: 'Forgot password?' }).click()

      // auth.forgot_password
      await expect(page).toHaveURL(/\/forgot-password$/)
      await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
    })

    await test.step('Passaggio alla pagina di registrazione', async () => {
      // auth.forgot_password / sign_up_link
      await page.getByRole('link', { name: 'Sign up' }).click()

      // auth.sign_up
      await expect(page).toHaveURL(/\/sign-up$/)
      await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()
    })

    await test.step('Ritorno alla pagina di accesso', async () => {
      // auth.sign_up / sign_in_link
      await page.getByRole('link', { name: 'Sign In' }).click()

      // back on auth.sign_in / email_input
      await expect(page).toHaveURL(/\/sign-in$/)
      await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
    })
  })
})
