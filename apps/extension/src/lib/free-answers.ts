import {
  FREE_ANSWERS_MAX_TOKENS,
  buildFreeAnswersPrompt,
  parseFreeAnswersResponse,
  type FreeQuestion,
  type JobAnalysis,
  type JobOffer,
  type LlmSettings,
  type MasterProfile,
} from '@propulsee/shared';
import { complete, type LlmResult } from './llm';

/** Demande au LLM une réponse à chaque question libre, en un seul appel. */
export async function draftFreeAnswers(
  settings: LlmSettings,
  profile: MasterProfile,
  offer: JobOffer,
  analysis: JobAnalysis | null,
  questions: FreeQuestion[],
  signal?: AbortSignal,
): Promise<LlmResult<string[]>> {
  const result = await complete(
    settings,
    buildFreeAnswersPrompt(profile, offer, analysis, questions),
    { maxTokens: FREE_ANSWERS_MAX_TOKENS, signal },
  );
  if (!result.ok) return result;
  const answers = parseFreeAnswersResponse(result.value, questions);
  return answers
    ? { ok: true, value: answers }
    : { ok: false, error: 'Je n’ai pas réussi à rédiger les réponses. Réessayez.' };
}
