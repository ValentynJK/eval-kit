import type {
  CaseError,
  EvalCase,
  EvalResult,
  EvalTrack,
  LlmParams,
  LlmRequest,
} from './types';

export type CaseRun = Omit<EvalResult, 'grade' | 'params'> & {
  params: LlmParams;
};

export const isCaseError = (value: CaseRun | CaseError): value is CaseError =>
  'stage' in value;

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// a throwing track becomes a CaseError, not a rejection, so one bad case never takes the rest of the run with it
export async function runCase(
  track: Pick<EvalTrack, 'resolve' | 'execute'>,
  evalCase: EvalCase
): Promise<CaseRun | CaseError> {
  let request: LlmRequest;
  try {
    request = await track.resolve(evalCase.input);
  } catch (error) {
    return {
      case_id: evalCase.id,
      stage: 'resolve',
      error: errorMessage(error),
    };
  }

  const sent = {
    system_prompt: request.systemPrompt,
    user_prompt: request.userPrompt,
    params: request.params,
  };

  try {
    const output = await track.execute(request);
    return { case_id: evalCase.id, output, ...sent };
  } catch (error) {
    return {
      case_id: evalCase.id,
      stage: 'execute',
      error: errorMessage(error),
      ...sent,
    };
  }
}
