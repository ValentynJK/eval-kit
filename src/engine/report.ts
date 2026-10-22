import { describeProblems, fieldProblems } from './fieldGradeSummary';
import { compareRuns } from './compareRuns';
import type { EvalRun } from './types';

export function printReport(run: EvalRun, previous: EvalRun | null): void {
  const passing = run.results.filter(
    result => result.grade.score >= run.pass_threshold
  ).length;

  console.log('');
  console.log(
    `${run.track}  ${run.summary.cases} cases  ${run.model}  graded by ${run.grader_model}  ${run.prompt_hash}`
  );
  console.log(
    `mean ${run.summary.mean_score.toFixed(2)}   pass ${passing}/${run.summary.cases} (score >= ${run.pass_threshold})`
  );
  const errors = run.errors ?? [];
  if (errors.length) {
    console.log(`errored ${errors.length}/${run.summary.cases}`);
  }

  const comparison = compareRuns(run, previous);
  if (comparison) {
    const { delta, note } = comparison;
    const value =
      delta === null ? 'n/a' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;
    console.log(`vs previous  ${value}   (${note})`);
  }

  if (run.results.length) {
    console.log('');
    console.log('cases, worst first');
    for (const result of [...run.results].sort(
      (a, b) => a.grade.score - b.grade.score
    )) {
      console.log(
        `  ${result.grade.score.toFixed(1).padStart(4)}  ${result.case_id.padEnd(24)} ${describeProblems(result.grade.field_grades, run.pass_threshold)}`
      );
    }
  }

  if (errors.length) {
    console.log('');
    console.log('errored cases');
    for (const { case_id: caseId, stage, error } of errors) {
      console.log(`  ${caseId.padEnd(24)} ${stage.padEnd(8)} ${error}`);
    }
  }

  const weak = fieldProblems(run.results, run.pass_threshold);
  if (weak.length) {
    console.log('');
    console.log(`fields below ${run.pass_threshold}`);
    for (const { id, count, meanGrade } of weak) {
      console.log(`  ${id.padEnd(24)} ${count}x, mean ${meanGrade.toFixed(1)}`);
    }
  }
  console.log('');
}
