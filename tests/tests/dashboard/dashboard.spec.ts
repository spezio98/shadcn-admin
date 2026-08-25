import { test, expect } from '@playwright/test'

test.describe('dashboard', () => {
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
})
