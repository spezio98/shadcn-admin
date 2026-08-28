import { test, expect } from '@playwright/test'

test.describe('dashboard', { tag: '@dashboard' }, () => {
  test("wf.dashboard_analytics: The user switches from Overview to the Analytics tab and sees the traffic chart", async ({
    page,
  }) => {
    await page.goto('/')

    await test.step('Checking that the Overview tab is available', async () => {
      // dashboard.overview / tab_overview
      await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
    })

    await test.step('Opening the Analytics tab and checking the traffic chart', async () => {
      // dashboard.overview / tab_analytics
      await page.getByRole('tab', { name: 'Analytics' }).click()

      // dashboard.analytics / traffic_chart
      await expect(page.getByText('Traffic Overview')).toBeVisible()
    })
  })

  test("wf.dashboard_analytics: flaky demo — the traffic chart isn't seen in time on the first attempt", async ({
    page,
  }, testInfo) => {
    await page.goto('/')

    await test.step('Opening the Analytics tab', async () => {
      // dashboard.overview / tab_analytics
      await page.getByRole('tab', { name: 'Analytics' }).click()
    })

    await test.step('(Flaky) check of the traffic chart', async () => {
      // dashboard.analytics / traffic_chart — same real workflow (wf.dashboard_analytics) as
      // the test above; this variant fails on the first attempt and passes on retry, on
      // purpose, to populate the report's "flaky" / "To keep an eye on" category deterministically
      // (testInfo.retry, not chance) rather than leaving it to a real, rare race condition.
      if (testInfo.retry === 0) {
        await expect(page.getByText('Traffic Overview')).toBeHidden({ timeout: 500 })
      } else {
        await expect(page.getByText('Traffic Overview')).toBeVisible()
      }
    })
  })

  test('The Reports and Notifications tabs are disabled (known issue)', async ({
    page,
  }) => {
    await page.goto('/')

    await test.step('Checking that the Reports and Notifications tabs are disabled', async () => {
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
    // Short explicit timeout: the default 30s actionability wait proves nothing extra here
    // and only bloats the recorded video for no benefit.
    await page.getByRole('tab', { name: 'Reports' }).click({ timeout: 3000 })
  })
})
