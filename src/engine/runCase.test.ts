import { describe, it, expect, vi } from 'vitest';
import { runCase } from './runCase';
import type { EvalCase, LlmRequest } from './types';

const evalCase: EvalCase = {
  id: 'case-1',
  description: '',
  synthetic: true,
  input: { text: 'hello' },
  expected: {},
  notes: [],
};

const request: LlmRequest = {
  systemPrompt: 'system',
  userPrompt: 'user: hello',
  params: { model: 'test-model', temperature: 0 },
};

describe('runCase', () => {
  it('passes the case input to resolve', async () => {
    const resolve = vi.fn(() => request);
    await runCase({ resolve, execute: async () => ({}) }, evalCase);

    expect(resolve).toHaveBeenCalledWith(evalCase.input);
  });

  it('hands execute the exact request resolve returned', async () => {
    const execute = vi.fn(async (_request: LlmRequest) => ({}));
    await runCase({ resolve: async () => request, execute }, evalCase);

    expect(execute.mock.calls[0][0]).toBe(request);
  });

  it('records the request and output it ran', async () => {
    const run = await runCase(
      { resolve: () => request, execute: async () => ({ answer: 'yes' }) },
      evalCase
    );

    expect(run).toEqual({
      case_id: 'case-1',
      output: { answer: 'yes' },
      system_prompt: 'system',
      user_prompt: 'user: hello',
      params: { model: 'test-model', temperature: 0 },
    });
  });

  it('records a resolve failure without calling execute', async () => {
    const execute = vi.fn(async () => ({}));
    const resolve = () => {
      throw new Error('bad case input');
    };

    const run = await runCase({ resolve, execute }, evalCase);

    expect(run).toEqual({
      case_id: 'case-1',
      stage: 'resolve',
      error: 'bad case input',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('records an execute failure with the request it was sent', async () => {
    const execute = async () => {
      throw new Error('rate limited');
    };

    const run = await runCase({ resolve: () => request, execute }, evalCase);

    expect(run).toEqual({
      case_id: 'case-1',
      stage: 'execute',
      error: 'rate limited',
      system_prompt: 'system',
      user_prompt: 'user: hello',
      params: { model: 'test-model', temperature: 0 },
    });
  });
});
