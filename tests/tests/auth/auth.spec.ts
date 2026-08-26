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

  test("wf.sign_in_success: L'utente accede con credenziali valide e arriva alla dashboard", async ({
    page,
  }) => {
    await page.goto('/sign-in')

    await test.step('Compilazione di email e password valide', async () => {
      // auth.sign_in / email_input, password_input
      await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com')
      await page.getByRole('textbox', { name: 'Password' }).fill('validpassword123')
    })

    await test.step('Invio del form e arrivo alla dashboard', async () => {
      // auth.sign_in / sign_in_button — no real backend: any well-formed email + 7+ char
      // password succeeds after a simulated async login (see docs/argus/features/auth.yaml).
      await page.getByRole('button', { name: 'Sign in' }).click()

      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
    })
  })

  test("wf.sign_in_empty_submit: L'utente invia il form di accesso vuoto e vede gli errori di validazione", async ({
    page,
  }) => {
    await page.goto('/sign-in')

    await test.step('Invio del form senza compilare i campi', async () => {
      // auth.sign_in / sign_in_button
      await page.getByRole('button', { name: 'Sign in' }).click()
    })

    await test.step('Verifica dei messaggi di validazione e permanenza sulla pagina', async () => {
      // auth.sign_in / email_input, password_input
      await expect(page.getByText('Please enter your email.')).toBeVisible()
      await expect(page.getByText('Please enter your password.')).toBeVisible()
      await expect(page).toHaveURL(/\/sign-in$/)
    })
  })

  test('wf.forgot_password_to_otp: L\'utente recupera la password con una email valida e riceve il codice OTP', async ({
    page,
  }) => {
    await page.goto('/sign-in')

    await test.step('Apertura della pagina di recupero password', async () => {
      // auth.sign_in / forgot_password_link
      await page.getByRole('link', { name: 'Forgot password?' }).click()
      await expect(page).toHaveURL(/\/forgot-password$/)
    })

    await test.step('Invio di una email valida e arrivo alla pagina OTP', async () => {
      // auth.forgot_password / email_input, continue_button
      await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com')
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page.getByText('Email sent to test@example.com')).toBeVisible()
      await expect(page).toHaveURL(/\/otp$/)
    })

    await test.step('Inserimento del codice a 6 cifre e verifica', async () => {
      // auth.otp / otp_input, verify_button — starts disabled, enables only once all 6
      // digits are entered; no real backend, any 6-digit code is accepted.
      const verifyButton = page.getByRole('button', { name: 'Verify' })
      await expect(verifyButton).toBeDisabled()

      await page.getByRole('textbox', { name: 'One-Time Password' }).fill('123456')
      await expect(verifyButton).toBeEnabled()
      await verifyButton.click()

      await expect(page.getByText('{ "otp": "123456" }')).toBeVisible()
    })
  })

  // INTENTIONALLY FAILING — report-reading exercise, kept in the suite on purpose. Same real
  // workflow as wf.forgot_password_to_otp above (a second, deliberately-broken variant), not
  // a synthetic report-demo case: every step is genuine, only the final assertion is wrong on
  // purpose, to produce a "failed at step N" checklist over a full cross-screen video.
  test('wf.forgot_password_to_otp: recupero password con email valida, verifica (volutamente sbagliata) del codice nella notifica', async ({
    page,
  }) => {
    await page.goto('/sign-in')

    await test.step('Apertura di Password dimenticata e invio di una email valida', async () => {
      await page.getByRole('link', { name: 'Forgot password?' }).click()
      await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com')
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page).toHaveURL(/\/otp$/)
    })

    await test.step('Inserimento del codice OTP e verifica (volutamente sbagliata)', async () => {
      await page.getByRole('textbox', { name: 'One-Time Password' }).fill('123456')
      await page.getByRole('button', { name: 'Verify' }).click()
      // Wrong on purpose: the code submitted was "123456", not "000000".
      await expect(page.getByText('{ "otp": "000000" }')).toBeVisible()
    })
  })
})
