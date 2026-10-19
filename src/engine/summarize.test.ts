import { describe, it, expect } from 'vitest';
import { summarize } from './summarize';
import type { CaseError, EvalResult } from './types';

const result = (score: number): EvalResult => ({
  case_id: `case-${score}`,
  output: {},
  system_prompt: '',
  user_prompt: '',
  grade: { score, field_grades: [], summary: '' },
});

const failed: CaseError = {
  case_id: 'case-err',
  stage: 'execute',
  error: 'rate limited',
};

describe('summarize', () => {
  it('scores graded cases', () => {
    expect(summarize([result(8), result(6)], [], 7)).toEqual({
      mean_score: 7,
      pass_rate: 0.5,
      cases: 2,
      errors: 0,
    });
  });

  it('keeps errored cases out of the mean but counts them as not passing', () => {
    expect(summarize([result(8), result(6)], [failed], 7)).toEqual({
      mean_score: 7,
      pass_rate: 0.33,
      cases: 3,
      errors: 1,
    });
  });

  it('reports zeros when every case errored', () => {
    expect(summarize([], [failed], 7)).toEqual({
      mean_score: 0,
      pass_rate: 0,
      cases: 1,
      errors: 1,
    });
  });
});
