import type { CaseError, EvalResult, RunSummary } from './types';

const round2 = (value: number): number => Math.round(value * 100) / 100;

// mean over graded cases only, but pass rate over every selected case -- an errored case never passed
export function summarize(
  results: EvalResult[],
  errors: CaseError[],
  passThreshold: number
): RunSummary {
  const scores = results.map(result => result.grade.score);
  const total = scores.reduce((sum, score) => sum + score, 0);
  const passing = scores.filter(score => score >= passThreshold).length;
  const cases = results.length + errors.length;

  return {
    mean_score: scores.length ? round2(total / scores.length) : 0,
    pass_rate: cases ? round2(passing / cases) : 0,
    cases,
    errors: errors.length,
  };
}
