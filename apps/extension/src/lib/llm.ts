import {
  buildCompletionRequest,
  buildTestRequest,
  describeLlmError,
  parseCompletionText,
  type HttpRequest,
  type LlmSettings,
} from '@propulsee/shared';

const STORAGE_KEY = 'llm';
const INSTALL_ID_KEY = 'installId';

/** Identifiant anonyme de cette installation, créé au premier appel : il compte le quota. */
async function loadInstallId(): Promise<string> {
  const stored = await chrome.storage.local.get(INSTALL_ID_KEY);
  const existing = stored[INSTALL_ID_KEY];
  if (typeof existing === 'string') return existing;
  const created = crypto.randomUUID();
  await chrome.storage.local.set({ [INSTALL_ID_KEY]: created });
  return created;
}

/**
 * Connexion LLM à utiliser : la clé de l'utilisateur s'il en a branché une, sinon celle de
 * Propulsee (abonnement ou offre de lancement), sans aucun réglage.
 */
export async function loadLlmSettings(): Promise<LlmSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const own = stored[STORAGE_KEY] as LlmSettings | undefined;
  if (own) return own;
  return { provider: 'propulsee', apiKey: await loadInstallId(), model: '', baseUrl: __API_URL__ };
}

/** La clé reste sur ce poste (`storage.local`), elle n'est jamais envoyée à l'API Propulsee. */
export async function saveLlmSettings(settings: LlmSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

/** Oublie la clé de l'utilisateur et revient à l'abonnement Propulsee. */
export async function clearLlmSettings(): Promise<LlmSettings> {
  await chrome.storage.local.remove(STORAGE_KEY);
  return loadLlmSettings();
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
