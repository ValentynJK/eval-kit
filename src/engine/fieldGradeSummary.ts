import type { EvalResult, FieldGrade } from './types';

export interface FieldGradeIssue {
  id: string;
  grade: number;
}

// ids below the threshold, worst first -- the majority at or above the bar is skipped so every summary here is only problems
function weak(fieldGrades: FieldGrade[], threshold: number): FieldGradeIssue[] {
  return fieldGrades
    .filter(fieldGrade => fieldGrade.grade < threshold)
    .map(({ id, grade }) => ({ id, grade }))
    .sort((a, b) => a.grade - b.grade);
}

export function describeProblems(
  fieldGrades: FieldGrade[],
  threshold: number
): string {
  const issues = weak(fieldGrades, threshold);
  if (issues.length === 0) return 'clean';
  return issues.map(({ id, grade }) => `${id} ${grade.toFixed(1)}`).join(', ');
}

export interface FieldProblem {
  id: string;
  count: number;
  meanGrade: number;
}

// answers "bad row or bad column" numerically -- an id weak across several cases is a prompt defect, not a hard case
export function fieldProblems(
  results: EvalResult[],
  threshold: number
): FieldProblem[] {
  const byId = new Map<string, number[]>();

  for (const result of results) {
    for (const { id, grade } of weak(result.grade.field_grades, threshold)) {
      byId.set(id, [...(byId.get(id) ?? []), grade]);
    }
  }

  return [...byId.entries()]
    .map(([id, gradesForId]) => ({
      id,
      count: gradesForId.length,
      meanGrade:
        Math.round(
          (gradesForId.reduce((sum, grade) => sum + grade, 0) /
            gradesForId.length) *
            10
        ) / 10,
    }))
    .sort((a, b) => b.count - a.count || a.meanGrade - b.meanGrade);
}
