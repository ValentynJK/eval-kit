import { describe, it, expect } from 'vitest';
import type { LanguageModel } from 'ai';
import { modelLabel } from './modelLabel';

describe('modelLabel', () => {
  it('keeps a model id string as is', () => {
    expect(modelLabel('openai:gpt-6-luna')).toBe('openai:gpt-6-luna');
  });

  it('labels a provider instance as provider:modelId', () => {
    const model = {
      provider: 'openai.responses',
      modelId: 'gpt-6-luna',
    } as LanguageModel;

    expect(modelLabel(model)).toBe('openai.responses:gpt-6-luna');
  });
});
