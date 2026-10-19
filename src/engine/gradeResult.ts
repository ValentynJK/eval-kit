import type { LanguageModel } from 'ai';
import { computeEvalScore } from './computeEvalScore';
import type { GradeCriteria } from './gradeCriteria';
import {
  GRADER_OUTPUT,
  GRADER_SYSTEM_PROMPT,
  GraderOutputSchema,
  buildGraderUserPrompt,
  type GraderOutput,
} from './graderPrompt';
import { checkNulls } from './nullCheck';
import type { EvalCase, FieldGrade, FieldValues, Grade } from './types';

// a missing grade would silently raise the score and a duplicate would count twice -- fail the run instead
function assertOneGradePerField(
  fieldGrades: FieldGrade[],
  criteria: GradeCriteria
): void {
  const expectedIds = Object.keys(criteria);
  const graded = fieldGrades.map(fieldGrade => fieldGrade.id);

  const ungraded = expectedIds.filter(id => !graded.includes(id));
  const duplicated = graded.filter((id, index) => graded.indexOf(id) !== index);
  const unexpected = graded.filter(id => !expectedIds.includes(id));

  const problems = [
    ungraded.length ? `ungraded ${ungraded.join(', ')}` : null,
    duplicated.length
      ? `duplicated ${[...new Set(duplicated)].join(', ')}`
      : null,
    unexpected.length ? `unexpected ${unexpected.join(', ')}` : null,
  ].filter(Boolean);

  if (problems.length) {
    throw new Error(`grader returned ${problems.join('; ')}`);
  }
}

// mirrors callStructuredModel's call shape without importing it -- the caller supplies the real call
export type CallModel = (args: {
  model: LanguageModel;
  systemPrompt: string;
  userPrompt: string;
  output: typeof GRADER_OUTPUT;
}) => Promise<{ output: unknown }>;

export async function gradeResult({
  evalCase,
  output,
  criteria,
  model,
  callModel,
}: {
  evalCase: EvalCase;
  output: FieldValues;
  criteria: GradeCriteria;
  model: LanguageModel;
  callModel: CallModel;
}): Promise<Grade> {
  const ids = Object.keys(criteria);
  const { decided, forGrader } = checkNulls(evalCase.expected, output, ids);
  const graded = await callGrader({
    evalCase,
    output,
    criteria,
    forGrader,
    model,
    callModel,
  });

  // criteria key order, so a run file reads the same whichever side decided a field
  const byId = new Map(
    [...decided, ...graded.fieldGrades].map(grade => [grade.id, grade])
  );
  const fieldGrades = ids.map(id => byId.get(id) as FieldGrade);

  return {
    score: computeEvalScore(fieldGrades, criteria),
    field_grades: fieldGrades,
    summary: graded.summary,
  };
}

function pick<T>(record: Record<string, T>, ids: string[]): Record<string, T> {
  return Object.fromEntries(
    ids.filter(id => id in record).map(id => [id, record[id]])
  );
}

// the grader only ever sees fields with a value on both sides -- null cases are settled by checkNulls
async function callGrader({
  evalCase,
  output,
  criteria,
  forGrader,
  model,
  callModel,
}: {
  evalCase: EvalCase;
  output: FieldValues;
  criteria: GradeCriteria;
  forGrader: string[];
  model: LanguageModel;
  callModel: CallModel;
}): Promise<{ fieldGrades: FieldGrade[]; summary: string }> {
  if (!forGrader.length) {
    return {
      fieldGrades: [],
      summary: 'Every field was decided by the null check.',
    };
  }

  const graderCriteria = pick(criteria, forGrader);
  const graderCase = {
    ...evalCase,
    expected: pick(evalCase.expected, forGrader),
  };

  const { output: generated } = await callModel({
    model,
    systemPrompt: GRADER_SYSTEM_PROMPT,
    userPrompt: buildGraderUserPrompt(
      graderCase,
      pick(output, forGrader),
      graderCriteria
    ),
    output: GRADER_OUTPUT,
  });

  // re-parse rather than trust the SDK's generic output typing
  const { field_grades: fieldGrades, summary } = GraderOutputSchema.parse(
    generated
  ) as GraderOutput;

  assertOneGradePerField(fieldGrades, graderCriteria);

  return { fieldGrades, summary };
}
