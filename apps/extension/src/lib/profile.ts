import {
  PROFILE_EXTRACTION_MAX_TOKENS,
  buildProfileExtractionPrompt,
  normalizeProfile,
  parseProfileResponse,
  type LlmSettings,
  type MasterProfile,
} from '@propulsee/shared';
import { complete, type LlmResult } from './llm';

const STORAGE_KEY = 'profile';

/** Profil maître enregistré, ou `null` si l'utilisateur n'en a pas encore créé. */
export async function loadProfile(): Promise<MasterProfile | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const raw: unknown = stored[STORAGE_KEY];
  return raw ? normalizeProfile(raw) : null;
}

/** Un seul profil maître : chaque enregistrement remplace le précédent. */
export async function saveProfile(profile: MasterProfile): Promise<MasterProfile> {
  const saved = { ...profile, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_KEY]: saved });
  return saved;
}

/** Demande au LLM de structurer le texte du CV en profil. */
export async function extractProfile(
  settings: LlmSettings,
  cvText: string,
  signal?: AbortSignal,
): Promise<LlmResult<MasterProfile>> {
  const result = await complete(settings, buildProfileExtractionPrompt(cvText), {
    maxTokens: PROFILE_EXTRACTION_MAX_TOKENS,
    signal,
  });
  if (!result.ok) return result;
  const profile = parseProfileResponse(result.value);
  return profile
    ? { ok: true, value: profile }
    : { ok: false, error: 'Je n’ai pas réussi à lire ce CV. Réessayez, ou remplissez à la main.' };
}
