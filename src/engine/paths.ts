import path from 'node:path';

// process.cwd(), not import.meta.url -- evals/ belongs to the host project the CLI runs in, while import.meta.url points inside the installed package
export const EVALS_ROOT = path.join(process.cwd(), 'evals');

export function trackDir(feature: string, track: string): string {
  return path.join(EVALS_ROOT, feature, track);
}

export function casesDir(feature: string, track: string): string {
  return path.join(trackDir(feature, track), 'cases');
}

export function runsDir(feature: string, track: string): string {
  return path.join(trackDir(feature, track), 'runs');
}
