import { test, expect } from '@playwright/test'

test.describe('shell', { tag: '@shell' }, () => {
  test("wf.command_palette_navigate: L'utente cerca \"task\" nella ricerca rapida e naviga alla lista Attività", async ({
    page,
  }) => {
    await page.goto('/')

    const query = page.getByRole('combobox')

    await test.step('Apertura della ricerca rapida dall\'header', async () => {
      // shell.header / search_button
      await page.getByRole('button', { name: 'Search' }).click()

      // shell.command_palette / query_input
      await expect(query).toBeVisible()
    })

    await test.step('Ricerca di "task" e navigazione alla lista Attività', async () => {
      await query.fill('task')
      await page.keyboard.press('Enter')

      // tasks.list / filter_input
      await expect(page).toHaveURL(/\/tasks$/)
      await expect(page.getByPlaceholder('Filter by title or ID...')).toBeVisible()
    })
  })

  test("wf.customize_theme: L'utente apre le impostazioni tema, verifica le opzioni disponibili e le chiude", async ({
    page,
  }) => {
    await page.goto('/')

    const dialog = page.getByRole('dialog', { name: 'Theme Settings' })

    await test.step('Apertura della finestra Impostazioni Tema', async () => {
      // shell.header / theme_settings_button
      await page.getByRole('button', { name: 'Open theme settings' }).click()

      // shell.theme_settings_dialog
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('radiogroup', { name: 'Select theme preference' })).toBeVisible()
      await expect(dialog.getByRole('radiogroup', { name: 'Select sidebar style' })).toBeVisible()
      await expect(dialog.getByRole('radiogroup', { name: 'Select layout style' })).toBeVisible()
      await expect(dialog.getByRole('radiogroup', { name: 'Select site direction' })).toBeVisible()
    })

    await test.step("Chiusura della finestra e ritorno all'header", async () => {
      // shell.theme_settings_dialog / close_button
      await dialog.getByRole('button', { name: 'Close' }).click()

      // back on shell.header
      await expect(page.getByRole('button', { name: 'Open theme settings' })).toBeVisible()
    })
  })
})
