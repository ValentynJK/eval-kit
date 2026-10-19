import { describe, it, expect } from 'vitest';
import { checkNulls, isNullValue } from './nullCheck';
import { MAX_FIELD_GRADE, MIN_FIELD_GRADE } from './scoring';

describe('isNullValue', () => {
  it('treats null, undefined, empty and whitespace-only strings as null', () => {
    expect(isNullValue(null)).toBe(true);
    expect(isNullValue(undefined)).toBe(true);
    expect(isNullValue('')).toBe(true);
    expect(isNullValue('   ')).toBe(true);
  });

  it('treats text and numbers as values, including 0', () => {
    expect(isNullValue('part')).toBe(false);
    expect(isNullValue(0)).toBe(false);
  });
});

describe('checkNulls', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const expected = { a: null, b: null, c: 'value', d: 'value' };
  const output = { a: null, b: 'invented', c: null, d: 'value' };

  it('grades both-null as a full match', () => {
    const { decided } = checkNulls(expected, output, ids);
    expect(decided.find(grade => grade.id === 'a')?.grade).toBe(
      MAX_FIELD_GRADE
    );
  });

  it('grades a value where null was expected as 0', () => {
    const { decided } = checkNulls(expected, output, ids);
    expect(decided.find(grade => grade.id === 'b')?.grade).toBe(
      MIN_FIELD_GRADE
    );
  });

  it('grades null where a value was expected as 0', () => {
    const { decided } = checkNulls(expected, output, ids);
    expect(decided.find(grade => grade.id === 'c')?.grade).toBe(
      MIN_FIELD_GRADE
    );
  });

  it('leaves fields with a value on both sides for the grader', () => {
    const { decided, forGrader } = checkNulls(expected, output, ids);
    expect(forGrader).toEqual(['d']);
    expect(decided.map(grade => grade.id)).toEqual(['a', 'b', 'c']);
  });

  it('treats a field missing from the output as null', () => {
    const { decided } = checkNulls({ a: 'value' }, {}, ['a']);
    expect(decided).toEqual([
      expect.objectContaining({ id: 'a', grade: MIN_FIELD_GRADE }),
    ]);
  });
});
