import {
  TAILORED_CV_MAX_TOKENS,
  buildTailoredCvPrompt,
  parseTailoredCvResponse,
  type JobAnalysis,
  type JobOffer,
  type LlmSettings,
  type MasterProfile,
  type TailoredCv,
} from '@propulsee/shared';
import { complete, type LlmResult } from './llm';

const STORAGE_KEY = 'tailoredCvs';

/** CV gardés : revenir sur une offre les réaffiche sans nouvel appel au LLM. */
const MAX_STORED_CVS = 50;

type StoredCvs = Record<string, TailoredCv>;

async function loadAll(): Promise<StoredCvs> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as StoredCvs | undefined) ?? {};
}

/**
 * CV déjà adapté pour l'offre `url` à partir de ce profil, ou `null`. Un CV généré avant une
 * modification du profil est ignoré : il serait périmé.
 */
export async function loadTailoredCv(
  url: string,
  profile: MasterProfile,
): Promise<TailoredCv | null> {
  const saved = (await loadAll())[url];
  return saved && saved.profileUpdatedAt === profile.updatedAt ? saved : null;
}

/** Garde les CV les plus récents, dans la limite de `max`. */
export function keepRecentCvs(cvs: StoredCvs, max = MAX_STORED_CVS): StoredCvs {
  const entries = Object.entries(cvs)
    .sort(([, a], [, b]) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, max);
  return Object.fromEntries(entries);
}

export async function saveTailoredCv(url: string, cv: TailoredCv): Promise<void> {
  const cvs = keepRecentCvs({ ...(await loadAll()), [url]: cv });
  await chrome.storage.local.set({ [STORAGE_KEY]: cvs });
}

/** Demande au LLM de choisir dans le profil ce qui compte pour l'offre et de réécrire l'accroche. */
export async function tailorCv(
  settings: LlmSettings,
  profile: MasterProfile,
  offer: JobOffer,
  analysis: JobAnalysis,
  signal?: AbortSignal,
): Promise<LlmResult<TailoredCv>> {
  const result = await complete(settings, buildTailoredCvPrompt(profile, offer, analysis), {
    maxTokens: TAILORED_CV_MAX_TOKENS,
    signal,
  });
  if (!result.ok) return result;
  const tailored = parseTailoredCvResponse(result.value, profile);
  return tailored
    ? { ok: true, value: tailored }
    : { ok: false, error: 'Je n’ai pas réussi à adapter votre CV. Réessayez.' };
}
