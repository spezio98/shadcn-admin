import { test, expect } from '@playwright/test'

test.describe('chats', { tag: '@chats' }, () => {
  test('wf.start_chat: Inbox -> open a conversation -> message history and compose box', async ({
    page,
  }) => {
    await page.goto('/chats')

    // chats.inbox_empty / conversation_item (first conversation in the list)
    await page.getByRole('button', { name: /Alex John/ }).click()

    // chats.thread / message_textbox
    await expect(page.getByRole('textbox', { name: 'Chat Text Box' })).toBeVisible()
  })
})
