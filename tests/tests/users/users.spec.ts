import { test, expect } from '@playwright/test'

test.describe('users', () => {
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
})
