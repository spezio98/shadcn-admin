import { test, expect } from '@playwright/test'

test.describe('users', { tag: '@users' }, () => {
  test("wf.invite_user: L'utente apre la finestra di invito e la chiude senza salvare", async ({
    page,
  }) => {
    await page.goto('/users')

    const dialog = page.getByRole('dialog', { name: 'Invite User' })

    await test.step('Apertura della finestra di invito utente', async () => {
      // users.list / invite_user_button
      await page.getByRole('button', { name: 'Invite User' }).click()

      // users.invite_dialog
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('textbox', { name: 'Email' })).toBeVisible()
      await expect(dialog.getByRole('combobox', { name: 'Role' })).toBeVisible()
    })

    await test.step('Chiusura della finestra senza salvare', async () => {
      // users.invite_dialog / cancel_button
      await dialog.getByRole('button', { name: 'Cancel' }).click()

      // back on users.list / invite_user_button
      await expect(page.getByRole('button', { name: 'Invite User' })).toBeVisible()
    })
  })

  test("wf.invite_user: L'utente invita un nuovo utente compilando email e ruolo, la conferma appare in una notifica", async ({
    page,
  }) => {
    await page.goto('/users')

    const email = `argus.e2e.${Date.now()}@example.com`
    const dialog = page.getByRole('dialog', { name: 'Invite User' })

    await test.step('Apertura della finestra di invito utente', async () => {
      // users.list / invite_user_button
      await page.getByRole('button', { name: 'Invite User' }).click()
      await expect(dialog).toBeVisible()
    })

    await test.step('Compilazione di email e ruolo', async () => {
      // users.invite_dialog / email_input, role_combobox
      await dialog.getByRole('textbox', { name: 'Email' }).fill(email)
      await dialog.getByRole('combobox', { name: 'Role' }).click()
      await page.getByRole('option', { name: 'Manager' }).click()
    })

    await test.step("Invio dell'invito e verifica della notifica di conferma", async () => {
      // users.invite_dialog / invite_button
      await dialog.getByRole('button', { name: 'Invite' }).click()

      // This build has no real backend: submitting only echoes the payload in a toast
      // and does not add a row to the table. Assert exactly that, rather than a persisted
      // row — rewrite this to assert the new row if/when a real invite API is wired up.
      await expect(dialog).toBeHidden()
      const toast = page.getByText('You submitted the following values:')
      await expect(toast).toBeVisible()
      const toastPayload = page.locator('code', { hasText: email })
      await expect(toastPayload).toContainText('"role": "manager"')
    })
  })
})
