import { test, expect } from '@playwright/test'

test.describe('shell', () => {
  test('wf.command_palette_navigate: header search -> type "task" -> Enter navigates to Tasks', async ({
    page,
  }) => {
    await page.goto('/')

    // shell.header / search_button
    await page.getByRole('button', { name: 'Search' }).click()

    // shell.command_palette / query_input
    const query = page.getByRole('combobox')
    await expect(query).toBeVisible()
    await query.fill('task')
    await page.keyboard.press('Enter')

    // tasks.list / filter_input
    await expect(page).toHaveURL(/\/tasks$/)
    await expect(page.getByPlaceholder('Filter by title or ID...')).toBeVisible()
  })

  test('wf.customize_theme: header -> open Theme Settings dialog -> close -> back to header', async ({
    page,
  }) => {
    await page.goto('/')

    // shell.header / theme_settings_button
    await page.getByRole('button', { name: 'Open theme settings' }).click()

    // shell.theme_settings_dialog
    const dialog = page.getByRole('dialog', { name: 'Theme Settings' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('radiogroup', { name: 'Select theme preference' })).toBeVisible()
    await expect(dialog.getByRole('radiogroup', { name: 'Select sidebar style' })).toBeVisible()
    await expect(dialog.getByRole('radiogroup', { name: 'Select layout style' })).toBeVisible()
    await expect(dialog.getByRole('radiogroup', { name: 'Select site direction' })).toBeVisible()

    // shell.theme_settings_dialog / close_button
    await dialog.getByRole('button', { name: 'Close' }).click()

    // back on shell.header
    await expect(page.getByRole('button', { name: 'Open theme settings' })).toBeVisible()
  })
})
