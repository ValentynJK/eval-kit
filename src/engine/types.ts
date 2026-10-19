import type { LanguageModel } from 'ai';

// shapes of the on-disk eval files -- type-only, since this is imported by both the harness and the report UI

export interface FieldGrade {
  id: string;
  grade: number;
  reasoning: string;
}

export interface Grade {
  score: number;
  field_grades: FieldGrade[];
  summary: string;
}

// keyed by field name, not a concrete field set, so the report page derives its columns from data
export type FieldValues = Record<string, string | number | null>;

export interface EvalCase {
  id: string;
  description: string;
  synthetic: boolean;
  // shape is per-track (a transcript, a full domain record, ...) -- the track's resolve() is the only thing that reads it
  input: Record<string, unknown>;
  expected: FieldValues;
  notes: string[];
}

export interface EvalResult {
  case_id: string;
  output: FieldValues;
  system_prompt: string;
  user_prompt: string;
  // absent on runs written before the resolve/execute contract
  params?: LlmParams;
  grade: Grade;
}

// a case that threw instead of producing a grade -- carries whatever it got as far as, so the failure can be read off the run file
export interface CaseError {
  case_id: string;
  stage: 'resolve' | 'execute' | 'grade';
  error: string;
  // present once resolve succeeded
  system_prompt?: string;
  user_prompt?: string;
  params?: LlmParams;
  // present once execute succeeded
  output?: FieldValues;
}

export interface RunSummary {
  mean_score: number;
  pass_rate: number;
  // every selected case, graded or errored
  cases: number;
  // absent on runs written before per-case isolation
  errors?: number;
}

export interface EvalRun {
  track: string;
  run_at: string;
  model: string;
  grader_model: string;
  prompt_hash: string;
  pass_threshold: number;
  summary: RunSummary;
  // graded cases only -- errored ones go to errors
  results: EvalResult[];
  // absent on runs written before per-case isolation
  errors?: CaseError[];
}

// json-serializable only -- it's written to the run file; non-serializable call machinery (e.g. an output schema) stays in the track's execute closure
export type LlmParams = { model: string } & Record<string, unknown>;

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  params: LlmParams;
}

// what a track's config module must default-export -- the kit records the request resolve() returns and hands that same object to execute(), so the run file can't claim a prompt or model the call didn't use
export interface EvalTrack<Input = any> {
  // a "<provider>:<model>" id (openai or anthropic, keyed by OPENAI_API_KEY / ANTHROPIC_API_KEY), or an AI SDK model instance
  graderModel: LanguageModel;
  passThreshold: number;
  resolve: (input: Input) => LlmRequest | Promise<LlmRequest>;
  execute: (request: LlmRequest) => Promise<FieldValues>;
}
