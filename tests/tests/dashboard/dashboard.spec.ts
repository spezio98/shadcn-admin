import { test, expect } from '@playwright/test'

test.describe('dashboard', { tag: '@dashboard' }, () => {
  test("wf.dashboard_analytics: L'utente passa dalla Panoramica alla scheda Analisi e vede il grafico del traffico", async ({
    page,
  }) => {
    await page.goto('/')

    await test.step('Verifica che la scheda Panoramica sia disponibile', async () => {
      // dashboard.overview / tab_overview
      await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
    })

    await test.step('Apertura della scheda Analisi e verifica del grafico del traffico', async () => {
      // dashboard.overview / tab_analytics
      await page.getByRole('tab', { name: 'Analytics' }).click()

      // dashboard.analytics / traffic_chart
      await expect(page.getByText('Traffic Overview')).toBeVisible()
    })
  })

  test("wf.dashboard_analytics: flaky demo — il grafico del traffico non viene visto in tempo al primo tentativo", async ({
    page,
  }, testInfo) => {
    await page.goto('/')

    await test.step('Apertura della scheda Analisi', async () => {
      // dashboard.overview / tab_analytics
      await page.getByRole('tab', { name: 'Analytics' }).click()
    })

    await test.step('Verifica (instabile) del grafico del traffico', async () => {
      // dashboard.analytics / traffic_chart — same real workflow (wf.dashboard_analytics) as
      // the test above; this variant fails on the first attempt and passes on retry, on
      // purpose, to populate the report's "flaky" / "Da monitorare" category deterministically
      // (testInfo.retry, not chance) rather than leaving it to a real, rare race condition.
      if (testInfo.retry === 0) {
        await expect(page.getByText('Traffic Overview')).toBeHidden({ timeout: 500 })
      } else {
        await expect(page.getByText('Traffic Overview')).toBeVisible()
      }
    })
  })

  test('Le schede Report e Notifiche risultano disabilitate (problema noto)', async ({
    page,
  }) => {
    await page.goto('/')

    await test.step('Verifica che le schede Report e Notifiche siano disabilitate', async () => {
      await expect(page.getByRole('tab', { name: 'Reports' })).toBeDisabled()
      await expect(page.getByRole('tab', { name: 'Notifications' })).toBeDisabled()
    })
  })

  // INTENTIONALLY FAILING — report-reading exercise, kept in the suite on purpose.
  // Real heading is "Dashboard"; this typo produces a clean expected/actual text diff.
  test('report-demo: assertion mismatch on the dashboard heading text', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveText('Dashboarrrd')
  })

  // INTENTIONALLY FAILING — report-reading exercise, kept in the suite on purpose.
  // tab_reports is disabled in this build; clicking without { force: true } times out with
  // "element is not enabled", a different failure shape than a missing locator.
  test('report-demo: actionability timeout clicking a disabled tab', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: 'Reports' }).click()
  })
})
