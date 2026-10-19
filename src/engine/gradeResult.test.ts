import { describe, it, expect, vi } from 'vitest';
import { gradeResult, type CallModel } from './gradeResult';
import type { GradeCriteria } from './gradeCriteria';
import type { EvalCase, FieldValues } from './types';

const criteria: GradeCriteria = {
  owner_name: { criteria: 'exact name', weight: 2 },
  timeline: { criteria: 'milestones', weight: 1 },
  proposed_solution: { criteria: 'substance', weight: 1 },
};

const evalCase = (expected: FieldValues): EvalCase => ({
  id: 'case',
  description: '',
  synthetic: true,
  input: {},
  expected,
  notes: [],
});

const graderReturning = (
  fieldGrades: { id: string; grade: number }[]
): CallModel =>
  vi.fn(async () => ({
    output: {
      field_grades: fieldGrades.map(grade => ({ ...grade, reasoning: 'r' })),
      summary: 'grader summary',
    },
  }));

const grade = (
  expected: FieldValues,
  output: FieldValues,
  callModel: CallModel
) =>
  gradeResult({
    evalCase: evalCase(expected),
    output,
    criteria,
    model: 'grader',
    callModel,
  });

describe('gradeResult null check', () => {
  it('skips the grader when every field is decided by the null check', async () => {
    const callModel = graderReturning([]);
    const result = await grade(
      { owner_name: null, timeline: null, proposed_solution: 'portal' },
      { owner_name: 'Tom', timeline: null, proposed_solution: null },
      callModel
    );

    expect(callModel).not.toHaveBeenCalled();
    expect(result.field_grades.map(({ id, grade }) => [id, grade])).toEqual([
      ['owner_name', 0],
      ['timeline', 10],
      ['proposed_solution', 0],
    ]);
    // (0*2 + 10*1 + 0*1) / 4 = 2.5
    expect(result.score).toBe(2.5);
  });

  it('sends only fields with a value on both sides to the grader', async () => {
    const callModel = graderReturning([{ id: 'proposed_solution', grade: 8 }]);
    await grade(
      { owner_name: null, timeline: null, proposed_solution: 'portal' },
      { owner_name: 'Tom', timeline: null, proposed_solution: 'a portal' },
      callModel
    );

    const { userPrompt } = vi.mocked(callModel).mock.calls[0][0];
    expect(userPrompt).toContain('proposed_solution');
    expect(userPrompt).not.toContain('owner_name');
    expect(userPrompt).not.toContain('timeline');
  });

  it('merges code and grader grades in criteria order and scores them with weights', async () => {
    const callModel = graderReturning([{ id: 'proposed_solution', grade: 8 }]);
    const result = await grade(
      { owner_name: 'Elena', timeline: null, proposed_solution: 'portal' },
      { owner_name: null, timeline: null, proposed_solution: 'a portal' },
      callModel
    );

    expect(result.field_grades.map(({ id, grade }) => [id, grade])).toEqual([
      ['owner_name', 0],
      ['timeline', 10],
      ['proposed_solution', 8],
    ]);
    // (0*2 + 10*1 + 8*1) / 4 = 4.5
    expect(result.score).toBe(4.5);
    expect(result.summary).toBe('grader summary');
  });

  it('throws when the grader grades a field the null check already decided', async () => {
    const callModel = graderReturning([
      { id: 'proposed_solution', grade: 8 },
      { id: 'owner_name', grade: 5 },
    ]);

    await expect(
      grade(
        { owner_name: null, timeline: null, proposed_solution: 'portal' },
        { owner_name: 'Tom', timeline: null, proposed_solution: 'a portal' },
        callModel
      )
    ).rejects.toThrow(/unexpected owner_name/);
  });
});
