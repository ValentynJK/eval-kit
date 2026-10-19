import type { EvalTrack } from '@valentynjk/eval-kit';
import { mockGrader } from '../../../mockGrader';

// a toy "system under test": regex extraction instead of a model call, so the example needs no API key

const SYSTEM_PROMPT =
  'Extract the contact name, email and company from the text.';

function extract(text: string) {
  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0] ?? null;
  const name = text.match(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/)?.[1] ?? null;
  const company =
    text.match(/\bat ([A-Z][\w&]*(?: [A-Z][\w&]*)*)/)?.[1] ?? null;
  return { name, email, company };
}

const track: EvalTrack<{ text: string }> = {
  graderModel: process.env.EVAL_GRADER_MODEL ?? mockGrader,
  passThreshold: 7,
  resolve: ({ text }) => ({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: text,
    params: { model: 'regex-v1' },
  }),
  async execute({ userPrompt }) {
    return extract(userPrompt);
  },
};

export default track;
