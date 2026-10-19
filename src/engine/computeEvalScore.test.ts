import { describe, it, expect } from 'vitest';
import { computeEvalScore } from './computeEvalScore';
import type { GradeCriteria } from './gradeCriteria';
import type { FieldGrade } from './types';

const grades = (...values: number[]): FieldGrade[] =>
  values.map((grade, index) => ({
    id: `field_${index}`,
    grade,
    reasoning: '',
  }));

const uniformCriteria = (count: number): GradeCriteria => {
  const criteria: GradeCriteria = {};
  for (let index = 0; index < count; index++) {
    criteria[`field_${index}`] = { criteria: '...', weight: 1 };
  }
  return criteria;
};

describe('computeEvalScore', () => {
  it('scores a clean result 10', () => {
    expect(computeEvalScore(grades(10, 10, 10), uniformCriteria(3))).toBe(10);
  });

  it('averages equal-weight grades', () => {
    expect(computeEvalScore(grades(10, 5, 0), uniformCriteria(3))).toBe(5);
  });

  it('pulls the mean toward a more heavily weighted id', () => {
    const criteria: GradeCriteria = {
      field_0: { criteria: '...', weight: 3 },
      field_1: { criteria: '...', weight: 1 },
    };

    // (0*3 + 10*1) / 4 = 2.5
    expect(computeEvalScore(grades(0, 10), criteria)).toBe(2.5);
  });

  it('rounds to the nearest half point', () => {
    // (7 + 8 + 9) / 3 = 8, but an uneven mean rounds
    expect(computeEvalScore(grades(7, 8, 9, 9), uniformCriteria(4))).toBe(
      8.5
    );
  });

  it('scores an empty grade list as 0', () => {
    expect(computeEvalScore([], {})).toBe(0);
  });

  it('throws on a grade outside 0-10', () => {
    expect(() =>
      computeEvalScore(grades(11), uniformCriteria(1))
    ).toThrow('Grade 11 on "field_0" is outside 0-10');
  });

  it('throws when an id has no grade_criteria entry', () => {
    expect(() => computeEvalScore(grades(5), {})).toThrow(
      'No grade_criteria entry for "field_0"'
    );
  });
});
