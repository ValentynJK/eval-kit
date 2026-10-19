import { describeProblems, fieldProblems } from './fieldGradeSummary';
import type { EvalRun } from './types';

const round2 = (value: number): number => Math.round(value * 100) / 100;

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

  // comparing means across different case subsets is meaningless, so a --case run reports as not comparable
  if (previous && previous.summary.cases !== run.summary.cases) {
    console.log(
      `vs previous  n/a   (${previous.summary.cases} cases then vs ${run.summary.cases} now)`
    );
  } else if (previous) {
    const delta = round2(run.summary.mean_score - previous.summary.mean_score);
    const sign = delta > 0 ? '+' : '';
    const note =
      previous.prompt_hash === run.prompt_hash
        ? 'prompt unchanged -- treat any movement as nondeterminism'
        : `prompt changed from ${previous.prompt_hash}`;
    console.log(`vs previous  ${sign}${delta.toFixed(2)}   (${note})`);
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
