import {
  createProviderRegistry,
  generateText,
  Output,
  type LanguageModel,
} from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { z } from 'zod';

// the kit's own grader caller -- a "<provider>:<model>" id resolves through the kit's registry with the host's
// OPENAI_API_KEY / ANTHROPIC_API_KEY, so grading never depends on host code; a model instance (e.g. a mock) passes through
export async function callStructuredModel<T>({
  model,
  systemPrompt,
  userPrompt,
  output,
}: {
  model: LanguageModel;
  systemPrompt: string;
  userPrompt: string;
  output: { schema: z.ZodType<T>; name: string; description: string };
}): Promise<{ output: T }> {
  const { output: generated } = await generateText({
    model: typeof model === 'string' ? resolveModelId(model) : model,
    system: systemPrompt,
    prompt: userPrompt,
    output: Output.object(output),
  });

  return { output: generated };
}

function resolveModelId(id: string) {
  // created per call, not at import, so the keys are read after dotenv has loaded
  const registry = createProviderRegistry({
    openai: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    anthropic: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  });
  return registry.languageModel(id as `${'openai' | 'anthropic'}:${string}`);
}
