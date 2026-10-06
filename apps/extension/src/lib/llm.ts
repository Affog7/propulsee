import {
  buildCompletionRequest,
  buildTestRequest,
  describeLlmError,
  parseCompletionText,
  type HttpRequest,
  type LlmSettings,
} from '@propulsee/shared';

const STORAGE_KEY = 'llm';

/** Connexion LLM enregistrée, ou `null` si l'utilisateur n'en a pas encore configuré. */
export async function loadLlmSettings(): Promise<LlmSettings | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as LlmSettings | undefined) ?? null;
}

/** La clé reste sur ce poste (`storage.local`), elle n'est jamais envoyée à l'API Propulsee. */
export async function saveLlmSettings(settings: LlmSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

export type LlmResult<T> = { ok: true; value: T } | { ok: false; error: string };

async function send(
  settings: LlmSettings,
  request: HttpRequest,
  signal?: AbortSignal,
): Promise<LlmResult<unknown>> {
  let res: Response;
  try {
    res = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal,
    });
  } catch {
    return { ok: false, error: describeLlmError(settings.provider, null) };
  }
  if (!res.ok) return { ok: false, error: describeLlmError(settings.provider, res.status) };
  return { ok: true, value: await res.json() };
}

/** Vérifie la clé et le modèle sans consommer de jetons. */
export async function testLlmConnection(
  settings: LlmSettings,
  signal?: AbortSignal,
): Promise<LlmResult<null>> {
  const result = await send(settings, buildTestRequest(settings), signal);
  return result.ok ? { ok: true, value: null } : result;
}

export interface CompleteOptions {
  maxTokens?: number;
  signal?: AbortSignal;
}

/** Envoie un prompt au LLM configuré et renvoie sa réponse texte. */
export async function complete(
  settings: LlmSettings,
  prompt: string,
  { maxTokens, signal }: CompleteOptions = {},
): Promise<LlmResult<string>> {
  const request = buildCompletionRequest(settings, prompt, maxTokens);
  const result = await send(settings, request, signal);
  if (!result.ok) return result;
  const text = parseCompletionText(settings.provider, result.value);
  return text === null
    ? { ok: false, error: 'Réponse du LLM illisible.' }
    : { ok: true, value: text };
}
