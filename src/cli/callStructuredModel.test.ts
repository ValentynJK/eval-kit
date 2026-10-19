import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock('ai', async importOriginal => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText };
});

import { callStructuredModel } from './callStructuredModel';

const output = {
  schema: z.object({ ok: z.boolean() }),
  name: 'probe',
  description: 'probe',
};

beforeEach(() => {
  generateText.mockResolvedValue({ output: { ok: true } });
});

describe('callStructuredModel', () => {
  it('routes "<provider>:<model>" ids to the named provider', async () => {
    await callStructuredModel({
      model: 'anthropic:claude-opus-5-5',
      systemPrompt: 's',
      userPrompt: 'u',
      output,
    });
    const anthropicModel = generateText.mock.calls[0][0].model;
    expect(anthropicModel.provider).toMatch(/^anthropic\./);
    expect(anthropicModel.modelId).toBe('claude-opus-5-5');

    await callStructuredModel({
      model: 'openai:gpt-6-luna',
      systemPrompt: 's',
      userPrompt: 'u',
      output,
    });
    const openaiModel = generateText.mock.calls[1][0].model;
    expect(openaiModel.provider).toMatch(/^openai\./);
    expect(openaiModel.modelId).toBe('gpt-6-luna');
  });

  it('returns the structured output', async () => {
    const result = await callStructuredModel({
      model: 'openai:gpt-6-luna',
      systemPrompt: 's',
      userPrompt: 'u',
      output,
    });
    expect(result).toEqual({ output: { ok: true } });
  });

  it('rejects bare model ids without a provider prefix', async () => {
    await expect(
      callStructuredModel({
        model: 'gpt-6-luna',
        systemPrompt: 's',
        userPrompt: 'u',
        output,
      })
    ).rejects.toThrow();
  });
});
