import { test, expect } from '@playwright/test'

test.describe('shell', { tag: '@shell' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test("wf.command_palette_navigate: The user searches for \"task\" in quick search and navigates to the tasks list", async ({
    page,
  }) => {
    const query = page.getByRole('combobox')

    await test.step('Opening quick search from the header', async () => {
      // shell.header / search_button
      await page.getByRole('button', { name: 'Search' }).click()

      // shell.command_palette / query_input
      await expect(query).toBeVisible()
    })

    await test.step('Searching for "task" and navigating to the tasks list', async () => {
      await query.fill('task')
      await page.keyboard.press('Enter')

      // tasks.list / filter_input
      await expect(page).toHaveURL(/\/tasks$/)
      await expect(page.getByPlaceholder('Filter by title or ID...')).toBeVisible()
    })
  })

  test("wf.customize_theme: The user opens theme settings, checks the available options, and closes it", async ({
    page,
  }) => {
    const dialog = page.getByRole('dialog', { name: 'Theme Settings' })

    await test.step('Opening the Theme Settings dialog', async () => {
      // shell.header / theme_settings_button
      await page.getByRole('button', { name: 'Open theme settings' }).click()

      // shell.theme_settings_dialog
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('radiogroup', { name: 'Select theme preference' })).toBeVisible()
      await expect(dialog.getByRole('radiogroup', { name: 'Select sidebar style' })).toBeVisible()
      await expect(dialog.getByRole('radiogroup', { name: 'Select layout style' })).toBeVisible()
      await expect(dialog.getByRole('radiogroup', { name: 'Select site direction' })).toBeVisible()
    })

    await test.step("Closing the dialog and returning to the header", async () => {
      // shell.theme_settings_dialog / close_button
      await dialog.getByRole('button', { name: 'Close' }).click()

      // back on shell.header
      await expect(page.getByRole('button', { name: 'Open theme settings' })).toBeVisible()
    })
  })
})
