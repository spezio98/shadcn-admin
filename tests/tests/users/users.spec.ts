import { test, expect } from '@playwright/test'

test.describe('users', { tag: '@users' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users')
  })

  test("wf.invite_user: The user opens the invite dialog and closes it without saving", async ({
    page,
  }) => {
    const dialog = page.getByRole('dialog', { name: 'Invite User' })

    await test.step('Opening the invite-user dialog', async () => {
      // users.list / invite_user_button
      await page.getByRole('button', { name: 'Invite User' }).click()

      // users.invite_dialog
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('textbox', { name: 'Email' })).toBeVisible()
      await expect(dialog.getByRole('combobox', { name: 'Role' })).toBeVisible()
    })

    await test.step('Closing the dialog without saving', async () => {
      // users.invite_dialog / cancel_button
      await dialog.getByRole('button', { name: 'Cancel' }).click()

      // back on users.list / invite_user_button
      await expect(page.getByRole('button', { name: 'Invite User' })).toBeVisible()
    })
  })

  test("wf.invite_user: The user invites a new user by filling in email and role, the confirmation appears in a notification", async ({
    page,
  }) => {
    const email = `argus.e2e.${Date.now()}@example.com`
    const dialog = page.getByRole('dialog', { name: 'Invite User' })

    await test.step('Opening the invite-user dialog', async () => {
      // users.list / invite_user_button
      await page.getByRole('button', { name: 'Invite User' }).click()
      await expect(dialog).toBeVisible()
    })

    await test.step('Filling in email and role', async () => {
      // users.invite_dialog / email_input, role_combobox
      await dialog.getByRole('textbox', { name: 'Email' }).fill(email)
      await dialog.getByRole('combobox', { name: 'Role' }).click()
      await page.getByRole('option', { name: 'Manager' }).click()
    })

    await test.step("Sending the invite and checking the confirmation notification", async () => {
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

  test("wf.edit_user_dialog: The user opens a user's edit dialog, sees it pre-filled, and closes it without saving", async ({
    page,
  }) => {
    const dialog = page.getByRole('dialog', { name: 'Edit User' })

    await test.step("Opening edit from the list row", async () => {
      // users.list / row_menu_button (first row)
      await page.getByRole('button', { name: 'Open menu' }).first().click()

      // users.row_menu / menu_edit — opens a distinct dialog from Add, not reused.
      await page.getByRole('menuitem', { name: 'Edit' }).click()
      await expect(dialog).toBeVisible()
    })

    await test.step('Checking that it is pre-filled with the row data', async () => {
      // users.edit_dialog / first_name_input, email_input, role_combobox
      // Not blank/placeholder — genuinely pre-filled.
      await expect(dialog.getByRole('textbox', { name: 'First Name' })).not.toHaveValue('')
      await expect(dialog.getByRole('textbox', { name: 'Email' })).not.toHaveValue('')
      await expect(dialog.getByRole('combobox', { name: 'Role' })).not.toHaveText('Select a role')
    })

    await test.step('Closing the dialog without saving', async () => {
      // users.edit_dialog / close_button
      await dialog.getByRole('button', { name: 'Close' }).click()
      await expect(dialog).toBeHidden()
    })
  })
})
