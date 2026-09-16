/**
 * The one way the app calls AI: through OpenRouter, with the model chosen per
 * feature, every call's tokens and cost recorded, and a monthly spending cap.
 */

/**
 * Features that call AI, each with its own model: report summaries, strategy
 * (topic recommendations and briefs), article drafts, and QA. M7 adds captions.
 */
export const AI_FEATURES = ['report', 'strategy', 'article', 'qa'] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiUsageEntry {
  feature: AiFeature;
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** As OpenRouter reports it, in its credits, which are US dollars. */
  costUsd: number;
}

export interface AiUsageStore {
  /** Spend so far this calendar month, in US dollars. */
  spentThisMonth(): Promise<number>;
  record(entry: AiUsageEntry): Promise<void>;
}

export interface AiResult {
  text: string;
  model: string;
  usage: AiUsageEntry;
  /** "length" when the reply hit maxTokens and was cut off. */
  finishReason: string | null;
}

export interface AiGateway {
  /** False without an API key; callers skip their AI step instead of failing. */
  configured: boolean;
  complete(feature: AiFeature, messages: AiMessage[], options?: { maxTokens?: number }): Promise<AiResult>;
}

export class AiBudgetExceededError extends Error {
  constructor(spent: number, budget: number) {
    super(`This month's AI spend ($${spent.toFixed(2)}) has reached AI_MONTHLY_BUDGET_USD ($${budget.toFixed(2)}).`);
    this.name = 'AiBudgetExceededError';
  }
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string };
}

export function createAiGateway(options: {
  apiKey?: string;
  baseUrl: string;
  appName: string;
  appUrl?: string;
  monthlyBudgetUsd: number;
  models: Record<AiFeature, string>;
  store: AiUsageStore;
  fetchImpl?: typeof fetch;
}): AiGateway {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `${options.baseUrl.replace(/\/$/, '')}/chat/completions`;

  return {
    configured: Boolean(options.apiKey),

    async complete(feature, messages, { maxTokens = 1000 } = {}) {
      if (!options.apiKey) throw new Error('OPENROUTER_API_KEY is not set.');

      const spent = await options.store.spentThisMonth();
      if (spent >= options.monthlyBudgetUsd) throw new AiBudgetExceededError(spent, options.monthlyBudgetUsd);

      const model = options.models[feature];
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          // Attribution headers, so usage shows up by app in the OpenRouter dashboard.
          'X-Title': options.appName,
          ...(options.appUrl ? { 'HTTP-Referer': options.appUrl } : {}),
        },
        // Reasoning off: every feature here asks for structured output, and on
        // 16 September Sonnet spent all 8,000 tokens thinking and wrote nothing.
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, reasoning: { enabled: false } }),
      });
      const body = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
      if (!response.ok || body?.error) {
        throw new Error(`OpenRouter request failed (${response.status}): ${body?.error?.message ?? 'no details'}`);
      }

      const usage: AiUsageEntry = {
        feature,
        model: body?.model ?? model,
        promptTokens: body?.usage?.prompt_tokens ?? 0,
        completionTokens: body?.usage?.completion_tokens ?? 0,
        costUsd: body?.usage?.cost ?? 0,
      };
      // Recorded before the text is checked: an empty answer is still billed.
      await options.store.record(usage);

      const finishReason = body?.choices?.[0]?.finish_reason ?? null;
      const text = body?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.trim() === '') {
        // An empty answer that stopped at the limit spent its tokens before writing anything.
        throw new Error(
          finishReason === 'length'
            ? `The model reached the ${maxTokens.toLocaleString('en-US')}-token limit without writing an answer.`
            : 'OpenRouter returned no text.',
        );
      }
      return { text, model: usage.model, usage, finishReason };
    },
  };
}
