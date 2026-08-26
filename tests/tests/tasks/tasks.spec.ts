import { test, expect } from '@playwright/test'

test.describe('tasks', { tag: '@tasks' }, () => {
  test("wf.create_task_dialog: L'utente apre la finestra di creazione attività e la chiude senza salvare", async ({
    page,
  }) => {
    await page.goto('/tasks')

    const dialog = page.getByRole('dialog', { name: 'Create Task' })

    await test.step('Apertura della finestra di creazione attività', async () => {
      // tasks.list / create_button
      await page.getByRole('button', { name: 'Create' }).click()

      // tasks.create_dialog
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('textbox', { name: 'Title' })).toBeVisible()
      await expect(dialog.getByRole('combobox', { name: 'Status' })).toBeVisible()
    })

    await test.step('Chiusura della finestra senza salvare', async () => {
      // tasks.create_dialog / close_button
      await dialog.getByRole('button', { name: 'Close' }).first().click()

      // back on tasks.list / create_button
      await expect(page.getByRole('button', { name: 'Create' })).toBeVisible()
    })
  })

  test("wf.create_task_dialog: L'utente compila e salva una nuova attività, la conferma appare in una notifica", async ({
    page,
  }) => {
    await page.goto('/tasks')

    const title = `Argus e2e task ${Date.now()}`
    const dialog = page.getByRole('dialog', { name: 'Create Task' })

    await test.step('Apertura della finestra di creazione attività', async () => {
      // tasks.list / create_button
      await page.getByRole('button', { name: 'Create' }).click()
      await expect(dialog).toBeVisible()
    })

    await test.step("Compilazione dei dati dell'attività (titolo, stato, etichetta, priorità)", async () => {
      // tasks.create_dialog / title_input, status_combobox, label_radiogroup, priority_radiogroup
      await dialog.getByRole('textbox', { name: 'Title' }).fill(title)
      await dialog.getByRole('combobox', { name: 'Status' }).click()
      await page.getByRole('option', { name: 'In Progress' }).click()
      await dialog.getByRole('radio', { name: 'Feature' }).click()
      await dialog.getByRole('radio', { name: 'High' }).click()
    })

    await test.step('Salvataggio e verifica della notifica di conferma', async () => {
      // tasks.create_dialog / save_button
      await dialog.getByRole('button', { name: 'Save changes' }).click()

      // This build has no real backend: submitting only echoes the payload in a toast
      // (region "Notifications") and does not add a row to the table. Assert exactly that,
      // rather than a persisted row, so the test doesn't silently start failing once/if a
      // real create-task API is wired up (at which point it should be rewritten to assert
      // the new row instead).
      await expect(dialog).toBeHidden()
      const toast = page.getByText('You submitted the following values:')
      await expect(toast).toBeVisible()
      const toastPayload = page.locator('code', { hasText: title })
      await expect(toastPayload).toContainText('"status": "in progress"')
      await expect(toastPayload).toContainText('"label": "feature"')
      await expect(toastPayload).toContainText('"priority": "high"')
    })
  })

  test("wf.task_row_actions: L'utente apre il menu azioni di un'attività e vede le opzioni Modifica ed Elimina", async ({
    page,
  }) => {
    await page.goto('/tasks')

    const menu = page.getByRole('menu', { name: 'Open menu' })

    await test.step("Apertura del menu azioni sulla prima attività della lista", async () => {
      // tasks.list / row_menu_button (first row)
      await page.getByRole('button', { name: 'Open menu' }).first().click()
    })

    await test.step("Verifica disponibilità delle azioni Modifica ed Elimina", async () => {
      // tasks.row_menu
      await expect(menu.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
      await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    })
  })

  test("wf.edit_task_dialog: L'utente apre la modifica di un'attività, la vede precompilata e la chiude senza salvare", async ({
    page,
  }) => {
    await page.goto('/tasks')

    const dialog = page.getByRole('dialog', { name: 'Update Task' })

    await test.step('Apertura della modifica dalla riga della lista', async () => {
      // tasks.list / row_menu_button (first row)
      await page.getByRole('button', { name: 'Open menu' }).first().click()

      // tasks.row_menu / menu_edit — opens a distinct dialog from Create, not reused.
      await page.getByRole('menuitem', { name: 'Edit' }).click()
      await expect(dialog).toBeVisible()
    })

    await test.step('Verifica della precompilazione con i dati della riga', async () => {
      // tasks.edit_dialog / title_input, status_combobox, label_radiogroup, priority_radiogroup
      // Not blank/placeholder, and not "Create Task" defaults — genuinely pre-filled.
      await expect(dialog.getByRole('textbox', { name: 'Title' })).not.toHaveValue('')
      await expect(dialog.getByRole('combobox', { name: 'Status' })).not.toHaveText('Select status')
      await expect(dialog.getByRole('radiogroup').first().getByRole('radio', { checked: true })).toHaveCount(1)
      await expect(dialog.getByRole('radiogroup').last().getByRole('radio', { checked: true })).toHaveCount(1)
    })

    await test.step('Chiusura della finestra senza salvare', async () => {
      // tasks.edit_dialog / close_button
      await dialog.getByRole('button', { name: 'Close' }).first().click()
      await expect(dialog).toBeHidden()
    })
  })

  // INTENTIONALLY FAILING — report-reading exercise, kept in the suite on purpose.
  // No button is ever named this — produces "locator resolved to 0 elements" plus a
  // screenshot of the real page, a different failure shape than a wrong assertion.
  test('report-demo: locator not found for a button name that does not exist', async ({
    page,
  }) => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'Create Task Now Please' }).click()
  })

  // INTENTIONALLY FAILING — report-reading exercise, kept in the suite on purpose.
  // Closing the Create Task dialog stays on /tasks; asserting /users produces a clean
  // toHaveURL diff (expected pattern vs. the real URL).
  test('report-demo: wrong URL asserted after closing the create-task dialog', async ({
    page,
  }) => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'Create' }).click()
    await page
      .getByRole('dialog', { name: 'Create Task' })
      .getByRole('button', { name: 'Close' })
      .first()
      .click()
    await expect(page).toHaveURL(/\/users$/)
  })

  // INTENTIONALLY FAILING — report-reading exercise, kept in the suite on purpose. Every step
  // is a genuine, modeled path (wf.create_task_via_search); only the final assertion is wrong
  // on purpose, to produce a "failed at step N" checklist over a full multi-screen video.
  test('wf.create_task_via_search: ricerca "task", crea e salva una nuova attività, verifica (volutamente sbagliata) della notifica', async ({
    page,
  }) => {
    await page.goto('/')

    await test.step('Navigazione a Tasks tramite la ricerca rapida', async () => {
      await page.getByRole('button', { name: 'Search' }).click()
      await page.getByRole('combobox').fill('task')
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/tasks$/)
    })

    const title = `Report demo task ${Date.now()}`
    const dialog = page.getByRole('dialog', { name: 'Create Task' })

    await test.step('Apertura della finestra di creazione e compilazione dei dati', async () => {
      await page.getByRole('button', { name: 'Create' }).click()
      await dialog.getByRole('textbox', { name: 'Title' }).fill(title)
      await dialog.getByRole('combobox', { name: 'Status' }).click()
      await page.getByRole('option', { name: 'In Progress' }).click()
      await dialog.getByRole('radio', { name: 'Feature' }).click()
      await dialog.getByRole('radio', { name: 'High' }).click()
    })

    await test.step('Salvataggio e verifica (volutamente sbagliata) della notifica', async () => {
      await dialog.getByRole('button', { name: 'Save changes' }).click()
      const toastPayload = page.locator('code', { hasText: title })
      // Wrong on purpose: the form was filled with "in progress", not "backlog".
      await expect(toastPayload).toContainText('"status": "backlog"')
    })
  })
})
