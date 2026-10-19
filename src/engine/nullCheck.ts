import { MAX_FIELD_GRADE, MIN_FIELD_GRADE } from './scoring';
import type { FieldGrade, FieldValues } from './types';

// '' and whitespace count as null -- formatValues already shows '' to the grader as null
export function isNullValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return typeof value === 'string' && value.trim() === '';
}

// null-vs-value is a hard rule, so it never reaches the grader, which hands out partial credit for it
export function checkNulls(
  expected: FieldValues,
  output: FieldValues,
  ids: string[]
): { decided: FieldGrade[]; forGrader: string[] } {
  const decided: FieldGrade[] = [];
  const forGrader: string[] = [];

  for (const id of ids) {
    const expectedNull = isNullValue(expected[id]);
    const actualNull = isNullValue(output[id]);

    if (expectedNull && actualNull) {
      decided.push({
        id,
        grade: MAX_FIELD_GRADE,
        reasoning: 'null check: both null',
      });
    } else if (expectedNull) {
      decided.push({
        id,
        grade: MIN_FIELD_GRADE,
        reasoning: 'null check: expected null, got a value',
      });
    } else if (actualNull) {
      decided.push({
        id,
        grade: MIN_FIELD_GRADE,
        reasoning: 'null check: expected a value, got null',
      });
    } else {
      forGrader.push(id);
    }
  }

  return { decided, forGrader };
}
