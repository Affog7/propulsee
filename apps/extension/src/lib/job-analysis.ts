import {
  JOB_ANALYSIS_MAX_TOKENS,
  buildJobAnalysisPrompt,
  parseJobAnalysisResponse,
  type JobAnalysis,
  type JobOffer,
  type LlmSettings,
  type MasterProfile,
} from '@propulsee/shared';
import { complete, type LlmResult } from './llm';

const STORAGE_KEY = 'analyses';

/** Analyses gardées : revenir sur une offre la réaffiche sans nouvel appel au LLM. */
const MAX_STORED_ANALYSES = 50;

type StoredAnalyses = Record<string, JobAnalysis>;

async function loadAll(): Promise<StoredAnalyses> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as StoredAnalyses | undefined) ?? {};
}

/** Analyse déjà faite pour l'offre `url`, ou `null`. */
export async function loadAnalysis(url: string): Promise<JobAnalysis | null> {
  return (await loadAll())[url] ?? null;
}

/** Garde les analyses les plus récentes, dans la limite de `MAX_STORED_ANALYSES`. */
export function keepRecent(analyses: StoredAnalyses, max = MAX_STORED_ANALYSES): StoredAnalyses {
  const entries = Object.entries(analyses)
    .sort(([, a], [, b]) => b.analyzedAt.localeCompare(a.analyzedAt))
    .slice(0, max);
  return Object.fromEntries(entries);
}

export async function saveAnalysis(url: string, analysis: JobAnalysis): Promise<void> {
  const analyses = keepRecent({ ...(await loadAll()), [url]: analysis });
  await chrome.storage.local.set({ [STORAGE_KEY]: analyses });
}

/** Demande au LLM l'essentiel de l'offre : missions, compétences clés et attentes. */
export async function analyzeOffer(
  settings: LlmSettings,
  offer: JobOffer,
  profile: MasterProfile | null,
  signal?: AbortSignal,
): Promise<LlmResult<JobAnalysis>> {
  if (!offer.description) {
    return { ok: false, error: 'Je n’arrive pas à lire le texte de cette offre.' };
  }
  const result = await complete(settings, buildJobAnalysisPrompt(offer, profile), {
    maxTokens: JOB_ANALYSIS_MAX_TOKENS,
    signal,
  });
  if (!result.ok) return result;
  const analysis = parseJobAnalysisResponse(result.value);
  return analysis
    ? { ok: true, value: analysis }
    : { ok: false, error: 'Je n’ai pas réussi à analyser cette offre. Réessayez.' };
}
