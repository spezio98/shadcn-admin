import { test, expect } from '@playwright/test'

test.describe('auth', { tag: '@auth' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in')
  })

  test("wf.auth_navigation_loop: The user navigates between sign in, password recovery, and sign up, and returns to sign in", async ({
    page,
  }) => {
    await test.step('Opening the password recovery page from login', async () => {
      // auth.sign_in / forgot_password_link
      await page.getByRole('link', { name: 'Forgot password?' }).click()

      // auth.forgot_password
      await expect(page).toHaveURL(/\/forgot-password$/)
      await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
    })

    await test.step('Moving to the sign-up page', async () => {
      // auth.forgot_password / sign_up_link
      await page.getByRole('link', { name: 'Sign up' }).click()

      // auth.sign_up
      await expect(page).toHaveURL(/\/sign-up$/)
      await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()
    })

    await test.step('Returning to the sign-in page', async () => {
      // auth.sign_up / sign_in_link
      await page.getByRole('link', { name: 'Sign In' }).click()

      // back on auth.sign_in / email_input
      await expect(page).toHaveURL(/\/sign-in$/)
      await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible()
    })
  })

  test("wf.sign_in_success: The user signs in with valid credentials and lands on the dashboard", async ({
    page,
  }) => {
    await test.step('Filling in a valid email and password', async () => {
      // auth.sign_in / email_input, password_input
      await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com')
      await page.getByRole('textbox', { name: 'Password' }).fill('validpassword123')
    })

    await test.step('Submitting the form and landing on the dashboard', async () => {
      // auth.sign_in / sign_in_button — no real backend: any well-formed email + 7+ char
      // password succeeds after a simulated async login (see docs/argus/features/auth.yaml).
      await page.getByRole('button', { name: 'Sign in' }).click()

      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
    })
  })

  test("wf.sign_in_empty_submit: The user submits the empty sign-in form and sees validation errors", async ({
    page,
  }) => {
    await test.step('Submitting the form without filling in the fields', async () => {
      // auth.sign_in / sign_in_button
      await page.getByRole('button', { name: 'Sign in' }).click()
    })

    await test.step('Checking the validation messages and that the page stays put', async () => {
      // auth.sign_in / email_input, password_input
      await expect(page.getByText('Please enter your email.')).toBeVisible()
      await expect(page.getByText('Please enter your password.')).toBeVisible()
      await expect(page).toHaveURL(/\/sign-in$/)
    })
  })

  test('wf.forgot_password_to_otp: The user recovers their password with a valid email and receives the OTP code', async ({
    page,
  }) => {
    await test.step('Opening the password recovery page', async () => {
      // auth.sign_in / forgot_password_link
      await page.getByRole('link', { name: 'Forgot password?' }).click()
      await expect(page).toHaveURL(/\/forgot-password$/)
    })

    await test.step('Submitting a valid email and landing on the OTP page', async () => {
      // auth.forgot_password / email_input, continue_button
      await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com')
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page.getByText('Email sent to test@example.com')).toBeVisible()
      await expect(page).toHaveURL(/\/otp$/)
    })

    await test.step('Entering the 6-digit code and verifying', async () => {
      // auth.otp / otp_input, verify_button — starts disabled, enables only once all 6
      // digits are entered; no real backend, only "000000" is accepted.
      const verifyButton = page.getByRole('button', { name: 'Verify' })
      await expect(verifyButton).toBeDisabled()

      await page.getByRole('textbox', { name: 'One-Time Password' }).fill('000000')
      await expect(verifyButton).toBeEnabled()
      await verifyButton.click()

      await expect(page.getByText('{ "otp": "000000" }')).toBeVisible()
    })
  })

  // INTENTIONALLY FAILING — report-reading exercise, kept in the suite on purpose. Same real
  // workflow as wf.forgot_password_to_otp above (a second, deliberately-broken variant), not
  // a synthetic report-demo case: every step is genuine, only the final assertion is wrong on
  // purpose, to produce a "failed at step N" checklist over a full cross-screen video.
  test('wf.forgot_password_to_otp: password recovery with a valid email, (deliberately wrong) verification of the code in the notification', async ({
    page,
  }) => {
    await test.step('Opening Forgot password and submitting a valid email', async () => {
      await page.getByRole('link', { name: 'Forgot password?' }).click()
      await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com')
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page).toHaveURL(/\/otp$/)
    })

    await test.step('Entering the OTP code and (deliberately wrong) verification', async () => {
      await page.getByRole('textbox', { name: 'One-Time Password' }).fill('123456')
      await page.getByRole('button', { name: 'Verify' }).click()
      // Wrong on purpose: only "000000" is accepted, so submitting "123456" is rejected
      // with a validation error and never shows the success toast asserted here.
      await expect(page.getByText('{ "otp": "123456" }')).toBeVisible()
    })
  })
})
