import { and, eq } from 'drizzle-orm';
import { reportTitle, type ReportKind, type ReportSummary } from '../../shared/reports';
import type { AiGateway } from '../ai/gateway';
import type { Db } from '../db/client';
import { reports } from '../db/schema';
import type { Env } from '../env';
import { sendTelegramMessage } from '../notify/telegram';
import { getSeoSettings } from '../seo/settings';
import { todayIn } from '../seo/sync';
import { collectReportData } from './data';
import { buildSummaryMessages, formatReportMessage, parseSummary } from './message';

export interface ReportOptions {
  /** Build the message from the numbers only: no AI call, nothing saved or sent. */
  dryRun: boolean;
  /** Send again even though this period's report already went out. */
  resend: boolean;
  /** Write a new AI summary instead of reusing the one saved for this period. */
  refresh: boolean;
  /** Run as if today were this date, to rebuild an earlier report. */
  today?: string;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Builds one report, saves it and sends it to Telegram. A period's report is
 * sent once: a retry after a failed send reuses the saved AI summary, and a
 * report that already went out is only sent again when asked.
 */
export async function runReport(deps: {
  db: Db;
  env: Env;
  ai: AiGateway;
  kind: ReportKind;
  options: ReportOptions;
  fetchImpl?: typeof fetch;
}) {
  const { db, env, ai, kind, options } = deps;
  const today = options.today ?? todayIn(env.TIMEZONE);
  const data = await collectReportData({ db, kind, today, settings: await getSeoSettings(db), timeZone: env.TIMEZONE });
  const title = reportTitle(kind, data.period);

  if (options.dryRun) {
    return { dryRun: true, title, message: formatReportMessage(title, data, null, env.APP_BASE_URL) };
  }

  const [existing] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.kind, kind), eq(reports.periodStart, data.period.start)))
    .limit(1);
  if (existing?.telegramSentAt && !options.resend) {
    return {
      sent: false,
      reportId: existing.id,
      title,
      reason: 'This report was already sent. Run with {"resend": true} to send it again.',
    };
  }

  let summary: ReportSummary | null = null;
  let aiModel: string | null = null;
  let aiNote: string | null = null;
  if (existing?.summary && !options.refresh) {
    summary = { summary: existing.summary, focus: existing.focus };
    aiModel = existing.aiModel;
  } else if (!ai.configured) {
    aiNote = 'No AI summary: OPENROUTER_API_KEY is not set.';
  } else {
    // The numbers are the report; a failed summary must not stop it going out.
    try {
      // A summary takes about 700 tokens; the margin keeps the JSON from being cut off.
      const result = await ai.complete('report', buildSummaryMessages(title, data), { maxTokens: 1200 });
      summary = parseSummary(result.text);
      aiModel = result.model;
    } catch (error) {
      aiNote = `No AI summary: ${errorText(error)}`;
    }
  }

  const message = formatReportMessage(title, data, summary, env.APP_BASE_URL);
  const content = {
    periodEnd: data.period.end,
    title,
    data,
    summary: summary?.summary ?? null,
    focus: summary?.focus ?? [],
    aiModel,
    aiNote,
    message,
    telegramSentAt: null,
    telegramError: null,
    createdAt: new Date(),
  };
  const [saved] = await db
    .insert(reports)
    .values({ kind, periodStart: data.period.start, ...content })
    .onConflictDoUpdate({ target: [reports.kind, reports.periodStart], set: content })
    .returning({ id: reports.id });

  const { TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_CHAT_ID: chatId } = env;
  if (!botToken || !chatId) {
    const reason = 'Telegram is not configured.';
    await db.update(reports).set({ telegramError: reason }).where(eq(reports.id, saved.id));
    return { sent: false, reportId: saved.id, title, aiModel, aiNote, reason };
  }

  try {
    await sendTelegramMessage({ botToken, chatId }, message, deps.fetchImpl);
  } catch (error) {
    await db.update(reports).set({ telegramError: errorText(error) }).where(eq(reports.id, saved.id));
    throw error;
  }
  await db.update(reports).set({ telegramSentAt: new Date(), telegramError: null }).where(eq(reports.id, saved.id));
  return { sent: true, reportId: saved.id, title, aiModel, aiNote };
}
