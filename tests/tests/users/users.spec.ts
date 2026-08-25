import { test, expect } from '@playwright/test'

test.describe('users', { tag: '@users' }, () => {
  test('wf.invite_user: Users list -> Invite User dialog -> cancel -> back to list', async ({
    page,
  }) => {
    await page.goto('/users')

    // users.list / invite_user_button
    await page.getByRole('button', { name: 'Invite User' }).click()

    // users.invite_dialog
    const dialog = page.getByRole('dialog', { name: 'Invite User' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Email' })).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Role' })).toBeVisible()

    // users.invite_dialog / cancel_button
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // back on users.list / invite_user_button
    await expect(page.getByRole('button', { name: 'Invite User' })).toBeVisible()
  })

  test('wf.invite_user: fill the form and submit -> confirmation toast echoes the values', async ({
    page,
  }) => {
    await page.goto('/users')

    const email = `argus.e2e.${Date.now()}@example.com`

    // users.list / invite_user_button
    await page.getByRole('button', { name: 'Invite User' }).click()

    // users.invite_dialog / email_input, role_combobox
    const dialog = page.getByRole('dialog', { name: 'Invite User' })
    await dialog.getByRole('textbox', { name: 'Email' }).fill(email)
    await dialog.getByRole('combobox', { name: 'Role' }).click()
    await page.getByRole('option', { name: 'Manager' }).click()

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
