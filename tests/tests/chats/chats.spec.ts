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
})
