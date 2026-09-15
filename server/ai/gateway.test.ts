import { describe, expect, it, vi } from 'vitest';
import { AiBudgetExceededError, createAiGateway, type AiUsageEntry } from './gateway';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function gatewayWith({ apiKey = 'key', spent = 0, response = json({}) }: { apiKey?: string; spent?: number; response?: Response }) {
  const recorded: AiUsageEntry[] = [];
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => response);
  const gateway = createAiGateway({
    apiKey,
    baseUrl: 'https://openrouter.ai/api/v1/',
    appName: 'Content Machine',
    appUrl: 'https://cm.example.com',
    monthlyBudgetUsd: 10,
    models: { report: 'anthropic/claude-sonnet-5' },
    store: {
      spentThisMonth: async () => spent,
      record: async (entry) => {
        recorded.push(entry);
      },
    },
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { gateway, fetchImpl, recorded };
}

const messages = [{ role: 'user' as const, content: 'Summarise' }];

describe('createAiGateway', () => {
  it('calls the model configured for the feature and records tokens and cost', async () => {
    const { gateway, fetchImpl, recorded } = gatewayWith({
      response: json({
        model: 'anthropic/claude-sonnet-5',
        choices: [{ message: { content: 'All good.' } }],
        usage: { prompt_tokens: 1200, completion_tokens: 150, cost: 0.0039 },
      }),
    });

    const result = await gateway.complete('report', messages, { maxTokens: 500 });

    expect(result.text).toBe('All good.');
    expect(recorded).toEqual([
      { feature: 'report', model: 'anthropic/claude-sonnet-5', promptTokens: 1200, completionTokens: 150, costUsd: 0.0039 },
    ]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer key', 'X-Title': 'Content Machine' });
    expect(JSON.parse(String(init?.body))).toEqual({ model: 'anthropic/claude-sonnet-5', messages, max_tokens: 500 });
  });

  it('refuses to call once the monthly budget is spent', async () => {
    const { gateway, fetchImpl } = gatewayWith({ spent: 10.2 });
    await expect(gateway.complete('report', messages)).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports itself unconfigured without an API key', async () => {
    const { gateway, fetchImpl } = gatewayWith({ apiKey: '' });
    expect(gateway.configured).toBe(false);
    await expect(gateway.complete('report', messages)).rejects.toThrow('OPENROUTER_API_KEY is not set.');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("passes on OpenRouter's error message", async () => {
    const { gateway, recorded } = gatewayWith({ response: json({ error: { message: 'Insufficient credits' } }, 402) });
    await expect(gateway.complete('report', messages)).rejects.toThrow('OpenRouter request failed (402): Insufficient credits');
    expect(recorded).toEqual([]);
  });

  it('still records the cost of a call that returned no text', async () => {
    const { gateway, recorded } = gatewayWith({
      response: json({ choices: [{ message: { content: '' } }], usage: { prompt_tokens: 10, completion_tokens: 0, cost: 0.001 } }),
    });
    await expect(gateway.complete('report', messages)).rejects.toThrow('OpenRouter returned no text.');
    expect(recorded).toHaveLength(1);
  });
});
