import fs from 'node:fs';
import path from 'node:path';
import { trackDir } from './paths';

export interface GradeCriterion {
  criteria: string;
  weight: number;
}

export type GradeCriteria = Record<string, GradeCriterion>;

interface RawCriterion {
  criteria: string;
  weight?: number;
}

// a typo'd weight (0 silently never counts, negative inverts a field) should fail loudly, not produce a misleading score
export function loadGradeCriteria(feature: string, track: string): GradeCriteria {
  const file = path.join(trackDir(feature, track), 'grade_criteria.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<
    string,
    RawCriterion
  >;

  const criteria: GradeCriteria = {};
  for (const [id, entry] of Object.entries(raw)) {
    const weight = entry.weight ?? 1;
    if (typeof weight !== 'number' || weight <= 0) {
      throw new Error(
        `grade_criteria.json: "${id}" has invalid weight ${weight}`
      );
    }
    criteria[id] = { criteria: entry.criteria, weight };
  }
  return criteria;
}
