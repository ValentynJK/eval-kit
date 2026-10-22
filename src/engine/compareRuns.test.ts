import { describe, it, expect } from 'vitest';
import { compareRuns } from './compareRuns';
import type { EvalResult, EvalRun } from './types';

const result = (caseId: string): EvalResult => ({
  case_id: caseId,
  output: {},
  system_prompt: '',
  user_prompt: '',
  grade: { score: 8, field_grades: [], summary: '' },
});

const run = (overrides: Partial<EvalRun> & { caseIds?: string[] }): EvalRun => {
  const { caseIds = ['001', '002'], ...rest } = overrides;
  return {
    track: 'contacts',
    run_at: '2026-01-01T00:00:00.000Z',
    model: 'openai:gpt-4o',
    grader_model: 'openai:gpt-4o-mini',
    prompt_hash: 'sha256:aaa',
    pass_threshold: 7,
    summary: { mean_score: 8, pass_rate: 1, cases: caseIds.length },
    results: caseIds.map(result),
    ...rest,
  };
};

describe('compareRuns', () => {
  it('returns null without a previous run', () => {
    expect(compareRuns(run({}), null)).toBeNull();
  });

  it('is not comparable when the same case count covers different cases', () => {
    const comparison = compareRuns(
      run({ caseIds: ['002'] }),
      run({ caseIds: ['001'] })
    );
    expect(comparison?.delta).toBeNull();
    expect(comparison?.note).toBe(
      'different cases (only then: 001; only now: 002)'
    );
  });

  it('counts errored case ids toward the case set', () => {
    const errored = run({
      caseIds: ['001'],
      errors: [{ case_id: '002', stage: 'execute', error: 'rate limited' }],
    });
    expect(compareRuns(errored, run({}))?.delta).toBe(0);
    // absent errors on an old run means only its graded cases were selected
    expect(compareRuns(errored, run({ caseIds: ['001'] }))?.delta).toBeNull();
  });

  it('reports nondeterminism when nothing changed, in any case order', () => {
    const now = run({
      caseIds: ['002', '001'],
      summary: { mean_score: 8.25, pass_rate: 1, cases: 2 },
    });
    expect(compareRuns(now, run({}))).toEqual({
      delta: 0.25,
      note: 'unchanged -- treat any movement as nondeterminism',
    });
  });

  it('names a model change instead of calling it nondeterminism', () => {
    const now = run({
      model: 'anthropic:claude-sonnet',
      summary: { mean_score: 7.5, pass_rate: 1, cases: 2 },
    });
    expect(compareRuns(now, run({}))).toEqual({
      delta: -0.5,
      note: 'model changed from openai:gpt-4o',
    });
  });
});
