import type { Alerter } from '../jobs/runner';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/** Sends a plain-text message to one chat through the Telegram Bot API. */
export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      link_preview_options: { is_disabled: true },
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      description?: string;
      parameters?: { migrate_to_chat_id?: number };
    } | null;
    // Telegram gives a group a new chat ID when it becomes a supergroup, and the
    // old ID stops working. It says which ID replaced it, so pass that on.
    const newChatId = body?.parameters?.migrate_to_chat_id;
    if (newChatId) {
      throw new Error(
        `The Telegram group was upgraded and now has chat ID ${newChatId}. Update TELEGRAM_CHAT_ID in .env.`,
      );
    }
    throw new Error(
      `Telegram rejected the message (${response.status}): ${body?.description ?? response.statusText}`,
    );
  }
}

export interface TelegramChat {
  id: number;
  title: string;
  type: string;
}

interface RawChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface RawUpdate {
  message?: { chat: RawChat };
  edited_message?: { chat: RawChat };
  channel_post?: { chat: RawChat };
  my_chat_member?: { chat: RawChat };
}

/** Turns a failed Bot API response into advice, since the raw errors are cryptic. */
function describeTelegramFailure(status: number, description: string | undefined): string {
  if (status === 404) {
    return 'Telegram did not recognise the bot token. It is malformed: check TELEGRAM_BOT_TOKEN for missing characters, spaces or quotes.';
  }
  if (status === 401) return 'Telegram rejected the bot token. Copy it again from @BotFather.';
  if (status === 409) return 'The bot has a webhook set, so updates cannot be read this way.';
  return `Telegram request failed (${status}): ${description ?? 'no details'}`;
}

/**
 * The chats the bot has seen recently, so the chat ID can be read off instead
 * of dug out of raw JSON. Telegram keeps undelivered updates for 24 hours.
 */
export async function findTelegramChats(
  botToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TelegramChat[]> {
  const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/getUpdates`);
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: RawUpdate[];
  } | null;
  if (!response.ok || !body?.ok) {
    throw new Error(describeTelegramFailure(response.status, body?.description));
  }

  const chats = new Map<number, TelegramChat>();
  for (const update of body.result ?? []) {
    const chat = (update.message ?? update.edited_message ?? update.channel_post ?? update.my_chat_member)
      ?.chat;
    if (!chat) continue;
    const personName = [chat.first_name, chat.last_name].filter(Boolean).join(' ');
    chats.set(chat.id, {
      id: chat.id,
      title: chat.title ?? (personName || chat.username || '(untitled)'),
      type: chat.type,
    });
  }
  return [...chats.values()];
}

/**
 * The operator alert channel: Telegram when configured, otherwise the process
 * log, so alerts are still visible while developing locally.
 */
export function createAlerter(env: {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}): Alerter {
  const { TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_CHAT_ID: chatId } = env;
  if (!botToken || !chatId) {
    return {
      async send(text) {
        console.warn(`[alert] Telegram is not configured; alert logged only:\n${text}`);
      },
    };
  }
  return { send: (text) => sendTelegramMessage({ botToken, chatId }, `Content Machine\n${text}`) };
}
