import { test, expect } from '@playwright/test'

test.describe('auth', { tag: '@auth' }, () => {
  test('wf.auth_navigation_loop: Sign in -> Forgot Password -> Sign Up -> Sign in', async ({
    page,
  }) => {
    await page.goto('/sign-in')

    // auth.sign_in / forgot_password_link
    await page.getByRole('link', { name: 'Forgot password?' }).click()

    // auth.forgot_password
    await expect(page).toHaveURL(/\/forgot-password$/)
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()

    // auth.forgot_password / sign_up_link
    await page.getByRole('link', { name: 'Sign up' }).click()

    // auth.sign_up
    await expect(page).toHaveURL(/\/sign-up$/)
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()

    // auth.sign_up / sign_in_link
    await page.getByRole('link', { name: 'Sign In' }).click()

    // back on auth.sign_in / email_input
    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
  })
})
