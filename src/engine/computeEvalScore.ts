import type { GradeCriteria } from './gradeCriteria';
import type { FieldGrade } from './types';
import { MAX_FIELD_GRADE, MIN_FIELD_GRADE } from './scoring';

// weighted mean of the per-id grades, using each field's weight from grade_criteria.json
export function computeEvalScore(
  fieldGrades: FieldGrade[],
  criteria: GradeCriteria
): number {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const fieldGrade of fieldGrades) {
    const criterion = criteria[fieldGrade.id];
    if (!criterion) {
      throw new Error(`No grade_criteria entry for "${fieldGrade.id}"`);
    }
    if (
      fieldGrade.grade < MIN_FIELD_GRADE ||
      fieldGrade.grade > MAX_FIELD_GRADE
    ) {
      throw new Error(
        `Grade ${fieldGrade.grade} on "${fieldGrade.id}" is outside ${MIN_FIELD_GRADE}-${MAX_FIELD_GRADE}`
      );
    }
    weightedSum += fieldGrade.grade * criterion.weight;
    weightTotal += criterion.weight;
  }

  if (weightTotal === 0) return 0;
  return Math.round((weightedSum / weightTotal) * 2) / 2;
}
