import { describe, expect, it } from 'vitest';
import { findTelegramChats, sendTelegramMessage } from './telegram';

const respond = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe('findTelegramChats', () => {
  it('lists each chat once, from messages and from the bot being added', async () => {
    const group = { id: -1001234567890, type: 'supergroup', title: 'Digital Marketing Dashboard TSI' };
    const fetchImpl = respond(200, {
      ok: true,
      result: [
        { my_chat_member: { chat: group } },
        { message: { chat: group } },
        { message: { chat: { id: 42, type: 'private', first_name: 'Nadia', last_name: 'R.' } } },
      ],
    });

    expect(await findTelegramChats('token', fetchImpl)).toEqual([
      { id: -1001234567890, title: 'Digital Marketing Dashboard TSI', type: 'supergroup' },
      { id: 42, title: 'Nadia R.', type: 'private' },
    ]);
  });

  it('explains a malformed token instead of a bare 404', async () => {
    const fetchImpl = respond(404, { ok: false, error_code: 404, description: 'Not Found' });
    await expect(findTelegramChats('bad', fetchImpl)).rejects.toThrow(/malformed/);
  });
});

describe('sendTelegramMessage', () => {
  it('names the new chat ID when the group has been upgraded to a supergroup', async () => {
    const fetchImpl = respond(400, {
      ok: false,
      error_code: 400,
      description: 'Bad Request: group chat was upgraded to a supergroup chat',
      parameters: { migrate_to_chat_id: -1009876543210 },
    });
    await expect(
      sendTelegramMessage({ botToken: 'token', chatId: '-5487624154' }, 'hello', fetchImpl),
    ).rejects.toThrow(/-1009876543210/);
  });
});
