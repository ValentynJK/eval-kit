import { z } from 'zod';
import type { GradeCriteria } from './gradeCriteria';
import type { EvalCase, FieldGrade, FieldValues } from './types';
import { MAX_FIELD_GRADE, MIN_FIELD_GRADE } from './scoring';

// fully generic -- what "good" means per id lives in the track's grade_criteria.json, not here
export const GRADER_SYSTEM_PROMPT = `You grade how well an actual output matches a human-authored
golden (expected) output for one eval case.

You are given four sections:

- EXPECTED -- the human-authored golden values, one per id. This is the target.
- ACTUAL -- what the system under test returned, one per id.
- CRITERIA -- one grading rule per id, written by the case's author. This is
  what "good" means for that id; follow it over your own judgement.
- NOTES -- written by the same author, about this specific case. Where a note
  speaks to an id, it overrides both your own judgement and CRITERIA.

Return one entry per id present in EXPECTED, and no others. Every id gets an
entry, including ones where ACTUAL matches EXPECTED exactly. Do not return an
overall score -- that is computed from your grades in code.

## Grading

For each id, assign \`grade\`, a number from ${MIN_FIELD_GRADE} to ${MAX_FIELD_GRADE}:

- ${MAX_FIELD_GRADE} means ACTUAL fully satisfies CRITERIA against EXPECTED.
- ${MIN_FIELD_GRADE} means ACTUAL invents something EXPECTED does not
  support, or otherwise fails CRITERIA outright.
- Values in between are partial credit: right idea but missing a detail,
  vaguer than EXPECTED, or only part of what EXPECTED records. Use the full
  range rather than clustering on the extremes.

Set \`reasoning\` to one short clause naming what drove the grade -- quote the
offending value where it helps. Do not restate CRITERIA back verbatim.

## Summary

One sentence on what should change in the system under test to fix what you
saw across the ids. If nothing should change, say so.

Use only standard keyboard characters -- no smart quotes, em-dashes, or
special Unicode.`;

export const GraderOutputSchema = z.object({
  field_grades: z.array(
    z.object({
      id: z.string(),
      grade: z.number().min(MIN_FIELD_GRADE).max(MAX_FIELD_GRADE),
      reasoning: z.string(),
    })
  ),
  summary: z.string(),
});

// hand-written, not z.infer -- zod v3 infers nested properties as optional here, unlike what .parse() actually guarantees
export interface GraderOutput {
  field_grades: FieldGrade[];
  summary: string;
}

export const GRADER_OUTPUT = {
  schema: GraderOutputSchema,
  name: 'eval_grade',
  description:
    'Per-id numeric grades comparing an eval case expected output against actual output, judged against grade_criteria',
};

function formatValues(values: FieldValues): string {
  return Object.entries(values)
    .map(
      ([id, value]) =>
        `${id}: ${value === null || value === '' ? 'null' : value}`
    )
    .join('\n');
}

function formatCriteria(criteria: GradeCriteria): string {
  return Object.entries(criteria)
    .map(([id, criterion]) => `${id}: ${criterion.criteria}`)
    .join('\n');
}

export function buildGraderUserPrompt(
  evalCase: EvalCase,
  output: FieldValues,
  criteria: GradeCriteria
): string {
  return [
    'EXPECTED',
    formatValues(evalCase.expected),
    '\nACTUAL',
    formatValues(output),
    '\nCRITERIA',
    formatCriteria(criteria),
    '\nNOTES',
    evalCase.notes.length
      ? evalCase.notes.map(note => `- ${note}`).join('\n')
      : '(none)',
  ].join('\n');
}
