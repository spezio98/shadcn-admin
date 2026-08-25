import { test, expect } from '@playwright/test'

test.describe('tasks', () => {
  test('wf.create_task_dialog: Tasks list -> Create dialog -> close without saving -> back to list', async ({
    page,
  }) => {
    await page.goto('/tasks')

    // tasks.list / create_button
    await page.getByRole('button', { name: 'Create' }).click()

    // tasks.create_dialog
    const dialog = page.getByRole('dialog', { name: 'Create Task' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Title' })).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Status' })).toBeVisible()

    // tasks.create_dialog / close_button
    await dialog.getByRole('button', { name: 'Close' }).first().click()

    // back on tasks.list / create_button
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible()
  })

  test('wf.task_row_actions: Tasks list -> open a row kebab menu -> Edit/Delete actions', async ({
    page,
  }) => {
    await page.goto('/tasks')

    // tasks.list / row_menu_button (first row)
    await page.getByRole('button', { name: 'Open menu' }).first().click()

    // tasks.row_menu
    const menu = page.getByRole('menu', { name: 'Open menu' })
    await expect(menu.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
  })
})
