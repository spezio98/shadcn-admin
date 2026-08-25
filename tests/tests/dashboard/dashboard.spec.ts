import { test, expect } from '@playwright/test'

test.describe('dashboard', { tag: '@dashboard' }, () => {
  test('wf.dashboard_analytics: Overview tab -> Analytics tab shows traffic chart', async ({
    page,
  }) => {
    await page.goto('/')

    // dashboard.overview / tab_overview
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()

    // dashboard.overview / tab_analytics
    await page.getByRole('tab', { name: 'Analytics' }).click()

    // dashboard.analytics / traffic_chart
    await expect(page.getByText('Traffic Overview')).toBeVisible()
  })

  test('dashboard.overview: Reports and Notifications tabs are disabled (known_issues)', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByRole('tab', { name: 'Reports' })).toBeDisabled()
    await expect(page.getByRole('tab', { name: 'Notifications' })).toBeDisabled()
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
