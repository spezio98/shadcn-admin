import { test, expect } from '@playwright/test'

test.describe('chats', { tag: '@chats' }, () => {
  test("wf.start_chat: The user opens a conversation from the inbox and sees the reply box", async ({
    page,
  }) => {
    await page.goto('/chats')

    await test.step('Opening a conversation from the inbox', async () => {
      // chats.inbox_empty / conversation_item (first conversation in the list)
      await page.getByRole('button', { name: /Alex John/ }).click()

      // chats.thread / message_textbox
      await expect(page.getByRole('textbox', { name: 'Chat Text Box' })).toBeVisible()
    })
  })

  test("wf.start_chat: flaky demo — the reply box isn't seen in time on the first attempt", async ({
    page,
  }, testInfo) => {
    await page.goto('/chats')

    await test.step('Opening a conversation from the inbox', async () => {
      // chats.inbox_empty / conversation_item (first conversation in the list)
      await page.getByRole('button', { name: /Alex John/ }).click()
    })

    await test.step('(Flaky) check of the reply box', async () => {
      // chats.thread / message_textbox — same real workflow (wf.start_chat) as the test
      // above; this variant fails on the first attempt and passes on retry, on purpose, to
      // populate the report's "flaky" / "To keep an eye on" category deterministically
      // (testInfo.retry, not chance) rather than leaving it to a real, rare race condition.
      if (testInfo.retry === 0) {
        await expect(page.getByRole('textbox', { name: 'Chat Text Box' })).toBeHidden({ timeout: 500 })
      } else {
        await expect(page.getByRole('textbox', { name: 'Chat Text Box' })).toBeVisible()
      }
    })
  })
})
