import fs from 'node:fs';
import path from 'node:path';
import { EVALS_ROOT, casesDir, runsDir } from './paths';
import type { EvalRun } from './types';

export interface TrackRef {
  feature: string;
  track: string;
}

function subdirectories(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

// a track is defined by having a cases/ directory (committed), not a runs/ one (gitignored), so a freshly cloned track is still discovered
export function listTracks(): TrackRef[] {
  const tracks: TrackRef[] = [];
  for (const feature of subdirectories(EVALS_ROOT)) {
    for (const track of subdirectories(path.join(EVALS_ROOT, feature))) {
      if (fs.existsSync(casesDir(feature, track))) {
        tracks.push({ feature, track });
      }
    }
  }
  return tracks;
}

// newest first -- run file names are ISO timestamps, so lexicographic order is chronological order
export function listRunFiles(feature: string, track: string): string[] {
  const dir = runsDir(feature, track);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort()
    .reverse();
}

export function loadRun(
  feature: string,
  track: string,
  fileName: string
): EvalRun | null {
  const file = path.join(runsDir(feature, track), fileName);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as EvalRun;
}

export interface NamedRun {
  fileName: string;
  run: EvalRun;
}

// the run immediately older than the given one, for the score delta
export function loadPreviousRun(
  feature: string,
  track: string,
  fileName: string
): NamedRun | null {
  const files = listRunFiles(feature, track);
  const previous = files[files.indexOf(fileName) + 1];
  if (!previous) return null;
  const run = loadRun(feature, track, previous);
  return run ? { fileName: previous, run } : null;
}
