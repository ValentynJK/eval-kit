import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { loadGradeCriteria, type GradeCriteria } from '../engine/gradeCriteria';
import { gradeResult } from '../engine/gradeResult';
import { modelLabel } from '../engine/modelLabel';
import { loadCases } from '../engine/loadCases';
import { loadPreviousRun } from '../engine/loadRuns';
import { promptHash } from '../engine/promptHash';
import { printReport } from '../engine/report';
import { EVALS_ROOT, runsDir, trackDir } from '../engine/paths';
import {
  errorMessage,
  isCaseError,
  runCase,
  type CaseRun,
} from '../engine/runCase';
import { summarize } from '../engine/summarize';
import { callStructuredModel } from './callStructuredModel';
import type {
  CaseError,
  EvalCase,
  EvalResult,
  EvalRun,
  EvalTrack,
} from '../engine/types';

interface Options {
  caseId?: string;
}

function parseArgs(argv: string[]): Options {
  const value = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    if (index === -1) return undefined;
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`--${name} needs a value`);
    }
    return next;
  };

  return {
    caseId: value('case'),
  };
}

function writeRun(run: EvalRun, feature: string, track: string): string {
  const dir = runsDir(feature, track);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${run.run_at.replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(
    path.join(dir, fileName),
    `${JSON.stringify(run, null, 2)}\n`
  );
  return fileName;
}

function selectCases(
  feature: string,
  track: string,
  requiredFields: string[],
  caseId?: string
): EvalCase[] {
  const cases = loadCases(feature, track, requiredFields);
  if (!cases.length) {
    throw new Error(`No cases found in ${trackDir(feature, track)}/cases`);
  }
  if (!caseId) return cases;

  const matches = cases.filter(one => one.id.startsWith(caseId));
  if (!matches.length) {
    throw new Error(
      `No case matching "${caseId}". Available: ${cases.map(one => one.id).join(', ')}`
    );
  }
  return matches;
}

// sequential, not parallel -- a handful of cases don't need concurrency, and serial keeps output readable and the rate limit untroubled
async function runAll(
  cases: EvalCase[],
  track: EvalTrack
): Promise<{ caseRuns: CaseRun[]; errors: CaseError[] }> {
  const caseRuns: CaseRun[] = [];
  const errors: CaseError[] = [];

  for (const evalCase of cases) {
    process.stdout.write(`  run      ${evalCase.id.padEnd(24)}`);
    const caseRun = await runCase(track, evalCase);

    if (isCaseError(caseRun)) {
      errors.push(caseRun);
      console.log(` error (${caseRun.stage}): ${caseRun.error}`);
    } else {
      caseRuns.push(caseRun);
      console.log(' ok');
    }
  }

  return { caseRuns, errors };
}

async function gradeAll(
  cases: EvalCase[],
  caseRuns: CaseRun[],
  criteria: GradeCriteria,
  graderModel: EvalTrack['graderModel']
): Promise<{ results: EvalResult[]; errors: CaseError[] }> {
  const results: EvalResult[] = [];
  const errors: CaseError[] = [];

  for (const caseRun of caseRuns) {
    const evalCase = cases.find(one => one.id === caseRun.case_id);
    if (!evalCase) throw new Error(`No case for result ${caseRun.case_id}`);

    process.stdout.write(`  grade    ${evalCase.id.padEnd(24)}`);
    try {
      const grade = await gradeResult({
        evalCase,
        output: caseRun.output,
        criteria,
        model: graderModel,
        callModel: callStructuredModel,
      });
      console.log(` ${grade.score.toFixed(1)}`);
      results.push({ ...caseRun, grade });
    } catch (error) {
      const message = errorMessage(error);
      console.log(` error: ${message}`);
      errors.push({ ...caseRun, stage: 'grade', error: message });
    }
  }

  return { results, errors };
}

async function importDefault<T>(
  filePath: string,
  expected: string
): Promise<T> {
  // tsImport, not import() -- loads the host's .ts with its tsconfig paths (@/...) whether or not the kit itself runs under tsx
  const imported = await tsImport(
    pathToFileURL(filePath).href,
    import.meta.url
  );
  // in a host without "type": "module" tsx loads the .ts as CommonJS, so `export default` arrives one level down, as module.exports.default
  const value =
    imported.default && 'default' in imported.default
      ? imported.default.default
      : imported.default;
  if (!value) {
    throw new Error(
      `${filePath} has no default export -- expected ${expected}`
    );
  }
  return value as T;
}

function loadTrack(configArg: string): Promise<EvalTrack> {
  return importDefault<EvalTrack>(
    `${path.resolve(process.cwd(), configArg)}.ts`,
    'an EvalTrack'
  );
}

// the track's identity is its location, evals/<feature>/<track>/config.ts, so the config never restates it
function trackFromPath(configArg: string): { feature: string; track: string } {
  const relative = path.relative(
    EVALS_ROOT,
    path.resolve(process.cwd(), configArg)
  );
  const [feature, track, file, ...rest] = relative.split(path.sep);
  if (!feature || !track || file !== 'config' || rest.length) {
    throw new Error(`${configArg} is not at evals/<feature>/<track>/config.ts`);
  }
  return { feature, track };
}

// lets `eval-kit run <track>` find evals/<feature>/<track>/config without spelling out
// the feature -- an arg that is itself a config path (evals/<feature>/<track>/config) is
// used as is
function resolveConfigPath(trackArg: string): string {
  const literal = trackArg.replace(/\.ts$/, '');
  if (fs.existsSync(path.resolve(process.cwd(), `${literal}.ts`))) {
    return literal;
  }

  const evalsRoot = path.resolve(process.cwd(), 'evals');
  const matches = fs
    .readdirSync(evalsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(feature => `evals/${feature.name}/${trackArg}/config`)
    .filter(candidate =>
      fs.existsSync(path.resolve(process.cwd(), `${candidate}.ts`))
    );

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `"${trackArg}" matches multiple tracks: ${matches.join(', ')} -- pass the full path instead`
    );
  }
  throw new Error(
    `No track "${trackArg}" found (looked for evals/*/${trackArg}/config.ts)`
  );
}

// returns the process exit code: non-zero when any case errored, so a script or CI notices a partial run
export async function runCommand(args: string[]): Promise<number> {
  const [trackArg, ...rest] = args;
  if (!trackArg) {
    throw new Error(
      'Usage: eval-kit run <track> [--case id]\n' +
        '  <track> is a track name (e.g. "extraction") or a full config path (e.g. evals/<feature>/<track>/config)'
    );
  }

  const configArg = resolveConfigPath(trackArg);
  const { feature, track } = trackFromPath(configArg);
  const trackConfig = await loadTrack(configArg);
  const { graderModel, passThreshold } = trackConfig;
  const options = parseArgs(rest);
  const now = new Date().toISOString();
  const criteria = loadGradeCriteria(feature, track);
  const requiredFields = Object.keys(criteria);

  const cases = selectCases(feature, track, requiredFields, options.caseId);
  console.log(`running ${cases.length} case(s) on ${track}`);

  const { caseRuns, errors: runErrors } = await runAll(cases, trackConfig);
  const { results, errors: gradeErrors } = await gradeAll(
    cases,
    caseRuns,
    criteria,
    graderModel
  );
  const errors = [...runErrors, ...gradeErrors];

  // taken off a request the call actually ran with, never hardcoded, so the run file cannot claim a model or prompt the call did not use
  const sent = [...results, ...errors].find(one => one.params);

  const evalRun: EvalRun = {
    track,
    run_at: now,
    model: sent?.params?.model ?? '',
    grader_model: modelLabel(graderModel),
    prompt_hash: sent?.system_prompt ? promptHash(sent.system_prompt) : '',
    pass_threshold: passThreshold,
    summary: summarize(results, errors, passThreshold),
    results,
    errors,
  };

  const fileName = writeRun(evalRun, feature, track);
  printReport(evalRun, loadPreviousRun(feature, track, fileName)?.run ?? null);
  console.log(`written  evals/${feature}/${track}/runs/${fileName}`);

  return errors.length ? 1 : 0;
}
