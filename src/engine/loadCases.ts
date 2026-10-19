import fs from 'node:fs';
import path from 'node:path';
import { casesDir } from './paths';
import type { EvalCase } from './types';

export function listCaseFiles(feature: string, track: string): string[] {
  const dir = casesDir(feature, track);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort();
}

// requiredFields comes from the track config, not an import, so this loader stays domain-agnostic
function assertExpectedFields(
  evalCase: EvalCase,
  requiredFields: readonly string[],
  fileName: string
): void {
  const present = Object.keys(evalCase.expected ?? {});
  const missing = requiredFields.filter(field => !present.includes(field));
  const unknown = present.filter(field => !requiredFields.includes(field));

  if (missing.length === 0 && unknown.length === 0) return;

  const problems = [
    missing.length ? `missing ${missing.join(', ')}` : null,
    unknown.length ? `unknown ${unknown.join(', ')}` : null,
  ].filter(Boolean);

  // a misspelled field would otherwise sit in the case file never being graded
  throw new Error(`${fileName}: expected fields ${problems.join('; ')}`);
}

export function loadCases(
  feature: string,
  track: string,
  requiredFields?: readonly string[]
): EvalCase[] {
  return listCaseFiles(feature, track).map(fileName => {
    const file = path.join(casesDir(feature, track), fileName);
    const evalCase = JSON.parse(fs.readFileSync(file, 'utf8')) as EvalCase;
    if (requiredFields) {
      assertExpectedFields(evalCase, requiredFields, fileName);
    }
    return evalCase;
  });
}

export function loadCase(
  feature: string,
  track: string,
  caseId: string
): EvalCase | null {
  return loadCases(feature, track).find(one => one.id === caseId) ?? null;
}

// union across cases in first-seen order, so the report page derives columns from data, not a hardcoded field set
export function caseFields(cases: EvalCase[]): string[] {
  const seen = new Set<string>();
  for (const evalCase of cases) {
    for (const field of Object.keys(evalCase.expected ?? {})) seen.add(field);
  }
  return [...seen];
}
