import { createHash } from 'node:crypto';

// one job: telling a real improvement apart from model nondeterminism via an unchanged hash
export function promptHash(systemPrompt: string): string {
  const digest = createHash('sha256').update(systemPrompt).digest('hex');
  return `sha256:${digest.slice(0, 12)}`;
}
