import { MockLanguageModelV3 } from 'ai/test';

// a stand-in grader so the example runs offline and deterministically -- it reads EXPECTED/ACTUAL back out of the grader prompt and compares strings

function section(prompt: string, name: string): Record<string, string> {
  const lines = prompt.split('\n');
  const start = lines.indexOf(name);
  const values: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) break;
    const index = line.indexOf(': ');
    values[line.slice(0, index)] = line.slice(index + 2);
  }
  return values;
}

function grade(expected: string, actual: string) {
  const a = expected.trim().toLowerCase();
  const b = actual.trim().toLowerCase();
  if (a === b) return { grade: 10, reasoning: 'exact match' };
  if (a.includes(b) || b.includes(a)) {
    return { grade: 6, reasoning: `partial: "${actual}"` };
  }
  return { grade: 2, reasoning: `differs: "${actual}"` };
}

export const mockGrader = new MockLanguageModelV3({
  provider: 'mock',
  modelId: 'string-compare',
  doGenerate: async ({ prompt }) => {
    const user = prompt.find(message => message.role === 'user');
    const text =
      user && Array.isArray(user.content)
        ? user.content
            .map(part => (part.type === 'text' ? part.text : ''))
            .join('')
        : '';

    const expected = section(text, 'EXPECTED');
    const actual = section(text, 'ACTUAL');
    const fieldGrades = Object.keys(expected).map(id => ({
      id,
      ...grade(expected[id], actual[id] ?? ''),
    }));

    const output = {
      field_grades: fieldGrades,
      summary: fieldGrades.every(one => one.grade === 10)
        ? 'Nothing should change.'
        : 'Tighten the extraction for the fields that differ.',
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    };
  },
});
