import { test, expect } from '@playwright/test'

test.describe('chats', { tag: '@chats' }, () => {
  test("wf.start_chat: L'utente apre una conversazione dalla posta in arrivo e vede la casella per rispondere", async ({
    page,
  }) => {
    await page.goto('/chats')

    await test.step('Apertura di una conversazione dalla posta in arrivo', async () => {
      // chats.inbox_empty / conversation_item (first conversation in the list)
      await page.getByRole('button', { name: /Alex John/ }).click()

      // chats.thread / message_textbox
      await expect(page.getByRole('textbox', { name: 'Chat Text Box' })).toBeVisible()
    })
  })

  test("wf.start_chat: flaky demo — la casella di risposta non viene vista in tempo al primo tentativo", async ({
    page,
  }, testInfo) => {
    await page.goto('/chats')

    await test.step('Apertura di una conversazione dalla posta in arrivo', async () => {
      // chats.inbox_empty / conversation_item (first conversation in the list)
      await page.getByRole('button', { name: /Alex John/ }).click()
    })

    await test.step('Verifica (instabile) della casella di risposta', async () => {
      // chats.thread / message_textbox — same real workflow (wf.start_chat) as the test
      // above; this variant fails on the first attempt and passes on retry, on purpose, to
      // populate the report's "flaky" / "Da monitorare" category deterministically
      // (testInfo.retry, not chance) rather than leaving it to a real, rare race condition.
      if (testInfo.retry === 0) {
        await expect(page.getByRole('textbox', { name: 'Chat Text Box' })).toBeHidden({ timeout: 500 })
      } else {
        await expect(page.getByRole('textbox', { name: 'Chat Text Box' })).toBeVisible()
      }
    })
  })
})
