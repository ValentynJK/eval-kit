import type { LanguageModel } from 'ai';

// what the run file records for a model -- an id string stays as is, a provider instance becomes provider:modelId
export function modelLabel(model: LanguageModel): string {
  if (typeof model === 'string') return model;
  return `${model.provider}:${model.modelId}`;
}
