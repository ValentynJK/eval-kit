import type { EvalRun } from './types';

// plain json, not a class -- the ui server sends it to the page as-is
export interface RunComparison {
  // null when the runs aren't comparable
  delta: number | null;
  // why not comparable, or what changed between the two runs
  note: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

// graded and errored ids both, so a case that errored this time still counts as selected
function caseIds(run: EvalRun): Set<string> {
  return new Set([
    ...run.results.map(result => result.case_id),
    ...(run.errors ?? []).map(error => error.case_id),
  ]);
}

function describeIds(ids: string[]): string {
  return ids.length > 3
    ? `${ids.slice(0, 3).join(', ')} +${ids.length - 3} more`
    : ids.join(', ');
}

// the one rule for "vs previous" -- the cli report and the ui both use it, so they can't disagree
export function compareRuns(
  run: EvalRun,
  previous: EvalRun | null
): RunComparison | null {
  if (!previous) return null;

  // set equality, not case count -- `--case 001` then `--case 002` is 1 vs 1 but compares nothing
  const now = caseIds(run);
  const then = caseIds(previous);
  const onlyNow = [...now].filter(id => !then.has(id)).sort();
  const onlyThen = [...then].filter(id => !now.has(id)).sort();
  if (onlyNow.length || onlyThen.length) {
    const parts = [
      onlyThen.length ? `only then: ${describeIds(onlyThen)}` : '',
      onlyNow.length ? `only now: ${describeIds(onlyNow)}` : '',
    ].filter(Boolean);
    return { delta: null, note: `different cases (${parts.join('; ')})` };
  }

  const changes = [
    run.model !== previous.model ? `model changed from ${previous.model}` : '',
    run.grader_model !== previous.grader_model
      ? `grader changed from ${previous.grader_model}`
      : '',
    run.prompt_hash !== previous.prompt_hash
      ? `prompt changed from ${previous.prompt_hash}`
      : '',
  ].filter(Boolean);

  return {
    delta: round2(run.summary.mean_score - previous.summary.mean_score),
    // nondeterminism is only the right read when nothing that drives the score changed
    note: changes.length
      ? changes.join('; ')
      : 'unchanged -- treat any movement as nondeterminism',
  };
}
