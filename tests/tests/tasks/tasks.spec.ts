import { test, expect, type Locator, type Page } from '@playwright/test'

async function fillTaskDetails(
  dialog: Locator,
  page: Page,
  details: { title: string; status: string; label: string; priority: string }
): Promise<void> {
  // tasks.create_dialog / title_input, status_combobox, label_radiogroup, priority_radiogroup
  await dialog.getByRole('textbox', { name: 'Title' }).fill(details.title)
  await dialog.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: details.status }).click()
  await dialog.getByRole('radio', { name: details.label }).click()
  await dialog.getByRole('radio', { name: details.priority }).click()
}

test.describe('tasks', { tag: '@tasks' }, () => {
  test.describe('from the tasks list', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/tasks')
    })

    test("wf.create_task_dialog: The user opens the create-task dialog and closes it without saving", async ({
      page,
    }) => {
      const dialog = page.getByRole('dialog', { name: 'Create Task' })

      await test.step('Opening the create-task dialog', async () => {
        // tasks.list / create_button
        await page.getByRole('button', { name: 'Create' }).click()

        // tasks.create_dialog
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('textbox', { name: 'Title' })).toBeVisible()
        await expect(dialog.getByRole('combobox', { name: 'Status' })).toBeVisible()
      })

      await test.step('Closing the dialog without saving', async () => {
        // tasks.create_dialog / close_button
        await dialog.getByRole('button', { name: 'Close' }).first().click()

        // back on tasks.list / create_button
        await expect(page.getByRole('button', { name: 'Create' })).toBeVisible()
      })
    })

    test("wf.create_task_dialog: The user fills in and saves a new task, the confirmation appears in a notification", async ({
      page,
    }) => {
      const title = `Argus e2e task ${Date.now()}`
      const dialog = page.getByRole('dialog', { name: 'Create Task' })

      await test.step('Opening the create-task dialog', async () => {
        // tasks.list / create_button
        await page.getByRole('button', { name: 'Create' }).click()
        await expect(dialog).toBeVisible()
      })

      await test.step('Filling in the task details (title, status, label, priority)', async () => {
        await fillTaskDetails(dialog, page, {
          title,
          status: 'In Progress',
          label: 'Feature',
          priority: 'High',
        })
      })

      await test.step('Saving and checking the confirmation notification', async () => {
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

    test("wf.task_row_actions: The user opens a task's actions menu and sees the Edit and Delete options", async ({
      page,
    }) => {
      const menu = page.getByRole('menu', { name: 'Open menu' })

      await test.step('Opening the actions menu on the first task in the list', async () => {
        // tasks.list / row_menu_button (first row)
        await page.getByRole('button', { name: 'Open menu' }).first().click()
      })

      await test.step('Checking that the Edit and Delete actions are available', async () => {
        // tasks.row_menu
        await expect(menu.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
        await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
      })
    })

    test("wf.edit_task_dialog: The user opens a task's edit dialog, sees it pre-filled, and closes it without saving", async ({
      page,
    }) => {
      const dialog = page.getByRole('dialog', { name: 'Update Task' })

      await test.step('Opening edit from the list row', async () => {
        // tasks.list / row_menu_button (first row)
        await page.getByRole('button', { name: 'Open menu' }).first().click()

        // tasks.row_menu / menu_edit — opens a distinct dialog from Create, not reused.
        await page.getByRole('menuitem', { name: 'Edit' }).click()
        await expect(dialog).toBeVisible()
      })

      await test.step('Checking that it is pre-filled with the row data', async () => {
        // tasks.edit_dialog / title_input, status_combobox, label_radiogroup, priority_radiogroup
        // Not blank/placeholder, and not "Create Task" defaults — genuinely pre-filled.
        await expect(dialog.getByRole('textbox', { name: 'Title' })).not.toHaveValue('')
        await expect(dialog.getByRole('combobox', { name: 'Status' })).not.toHaveText('Select status')
        await expect(dialog.getByRole('radiogroup').first().getByRole('radio', { checked: true })).toHaveCount(1)
        await expect(dialog.getByRole('radiogroup').last().getByRole('radio', { checked: true })).toHaveCount(1)
      })

      await test.step('Closing the dialog without saving', async () => {
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
      // Short explicit timeout: the default 30s actionability wait proves nothing extra here
      // and only bloats the recorded video for no benefit.
      await page.getByRole('button', { name: 'Create Task Now Please' }).click({ timeout: 3000 })
    })

    // INTENTIONALLY FAILING — report-reading exercise, kept in the suite on purpose.
    // Closing the Create Task dialog stays on /tasks; asserting /users produces a clean
    // toHaveURL diff (expected pattern vs. the real URL).
    test('report-demo: wrong URL asserted after closing the create-task dialog', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Create' }).click()
      await page
        .getByRole('dialog', { name: 'Create Task' })
        .getByRole('button', { name: 'Close' })
        .first()
        .click()
      await expect(page).toHaveURL(/\/users$/)
    })
  })

  test.describe('via command palette search', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
    })

    test('wf.create_task_via_search: searches for "task" via the command palette, then creates and saves a new task', async ({
      page,
    }) => {
      await test.step('Navigating to Tasks via quick search', async () => {
        // shell.header / search_button
        await page.getByRole('button', { name: 'Search' }).click()
        // shell.command_palette / query_input
        await page.getByRole('combobox').fill('task')
        await page.keyboard.press('Enter')

        // tasks.list
        await expect(page).toHaveURL(/\/tasks$/)
      })

      const title = `Argus e2e task via search ${Date.now()}`
      const dialog = page.getByRole('dialog', { name: 'Create Task' })

      await test.step('Opening the create dialog and filling in the details', async () => {
        // tasks.list / create_button
        await page.getByRole('button', { name: 'Create' }).click()
        await expect(dialog).toBeVisible()

        await fillTaskDetails(dialog, page, {
          title,
          status: 'In Progress',
          label: 'Feature',
          priority: 'High',
        })
      })

      await test.step('Saving and checking the confirmation notification', async () => {
        // tasks.create_dialog / save_button — same no-backend caveat as wf.create_task_dialog:
        // submitting only echoes the payload in a toast, no row is persisted.
        await dialog.getByRole('button', { name: 'Save changes' }).click()

        await expect(dialog).toBeHidden()
        const toast = page.getByText('You submitted the following values:')
        await expect(toast).toBeVisible()
        const toastPayload = page.locator('code', { hasText: title })
        await expect(toastPayload).toContainText('"status": "in progress"')
        await expect(toastPayload).toContainText('"label": "feature"')
        await expect(toastPayload).toContainText('"priority": "high"')
      })
    })

    // INTENTIONALLY FAILING — report-reading exercise, kept in the suite on purpose. Every step
    // is a genuine, modeled path (wf.create_task_via_search); only the final assertion is wrong
    // on purpose, to produce a "failed at step N" checklist over a full multi-screen video.
    test('wf.create_task_via_search: (report-demo) searches for "task", creates and saves a new task, (deliberately wrong) verification of the notification', async ({
      page,
    }) => {
      await test.step('Navigating to Tasks via quick search', async () => {
        await page.getByRole('button', { name: 'Search' }).click()
        await page.getByRole('combobox').fill('task')
        await page.keyboard.press('Enter')
        await expect(page).toHaveURL(/\/tasks$/)
      })

      const title = `Report demo task ${Date.now()}`
      const dialog = page.getByRole('dialog', { name: 'Create Task' })

      await test.step('Opening the create dialog and filling in the details', async () => {
        await page.getByRole('button', { name: 'Create' }).click()
        await dialog.getByRole('textbox', { name: 'Title' }).fill(title)
        await dialog.getByRole('combobox', { name: 'Status' }).click()
        await page.getByRole('option', { name: 'In Progress' }).click()
        await dialog.getByRole('radio', { name: 'Feature' }).click()
        await dialog.getByRole('radio', { name: 'High' }).click()
      })

      await test.step('Saving and (deliberately wrong) verification of the notification', async () => {
        await dialog.getByRole('button', { name: 'Save changes' }).click()
        const toastPayload = page.locator('code', { hasText: title })
        // Wrong on purpose: the form was filled with "in progress", not "backlog".
        await expect(toastPayload).toContainText('"status": "backlog"')
      })
    })
  })
})
