/** Fournisseurs branchés avec la clé de l'utilisateur (« Utiliser ma propre clé »). */
export const OWN_KEY_PROVIDERS = ['anthropic', 'openai', 'ollama'] as const;

export type OwnKeyProvider = (typeof OWN_KEY_PROVIDERS)[number];

/**
 * Fournisseurs de LLM pris en charge. `propulsee` est la connexion par défaut, sans réglage :
 * l'API Propulsee appelle le LLM pour l'utilisateur (abonnement ou offre de lancement).
 */
export const LLM_PROVIDERS = ['propulsee', ...OWN_KEY_PROVIDERS] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export interface LlmProviderInfo {
  label: string;
  /** Modèle proposé par défaut, modifiable par l'utilisateur. */
  defaultModel: string;
  /**
   * URL de base de l'API. L'extension doit l'autoriser dans `host_permissions`.
   * Vide pour Propulsee : l'URL de l'API est fournie par `LlmSettings.baseUrl`.
   */
  baseUrl: string;
  /** `false` pour un modèle local, qui n'a pas besoin de clé. */
  needsApiKey: boolean;
  /** Où obtenir une clé, affiché sous le champ. */
  keyHelpUrl?: string;
}

export const LLM_PROVIDER_INFO: Record<LlmProvider, LlmProviderInfo> = {
  propulsee: {
    label: 'Propulsee',
    defaultModel: '',
    baseUrl: '',
    needsApiKey: false,
  },
  anthropic: {
    label: 'Claude',
    defaultModel: 'claude-opus-5-5',
    baseUrl: 'https://api.anthropic.com',
    needsApiKey: true,
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-5',
    baseUrl: 'https://api.openai.com',
    needsApiKey: true,
    keyHelpUrl: 'https://platform.openai.com/api-keys',
  },
  ollama: {
    label: 'Ollama (local)',
    defaultModel: 'llama3.1:8b',
    baseUrl: 'http://localhost:11434',
    needsApiKey: false,
  },
};

/** Connexion au LLM : celle de Propulsee par défaut, ou la clé de l'utilisateur. */
export interface LlmSettings {
  provider: LlmProvider;
  /** Pour Propulsee : identifiant anonyme de l'installation, qui sert à compter le quota. */
  apiKey: string;
  /** Vide pour Propulsee : l'API choisit le modèle. */
  model: string;
  /** Propulsee seulement : URL de l'API Propulsee. */
  baseUrl?: string;
}

/** En-tête qui porte l'identifiant d'installation vers `POST /llm/complete`. */
export const LLM_INSTALL_HEADER = 'x-propulsee-install';

/** Taille maximale d'un prompt accepté par `POST /llm/complete`. */
export const LLM_MAX_PROMPT_CHARS = 100_000;

/** Nombre maximal de jetons de réponse demandés à `POST /llm/complete`. */
export const LLM_MAX_COMPLETION_TOKENS = 8192;

/** Corps de `POST /llm/complete`. */
export interface LlmCompleteRequest {
  prompt: string;
  maxTokens: number;
}

/** Réponse de `POST /llm/complete`. */
export interface LlmCompleteResponse {
  text: string;
}

/** Requête HTTP décrite sans dépendre de `fetch`, pour rester testable et portable. */
export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
}

/** Taille (en milliards de paramètres) sous laquelle un modèle local rédige mal un CV. */
const WEAK_LOCAL_MODEL_BILLIONS = 7;

/**
 * `true` si le modèle Ollama choisi est trop petit pour des documents fiables :
 * étiquette de taille (`llama3.2:3b`, `gemma2:2b`) sous 7 milliards, ou `llama3.2` (3B par défaut).
 */
export function isWeakLocalModel({ provider, model }: LlmSettings): boolean {
  if (provider !== 'ollama') return false;
  const name = model.trim().toLowerCase();
  const size = /:(\d+(?:\.\d+)?)b\b/.exec(name)?.[1];
  if (size) return Number(size) < WEAK_LOCAL_MODEL_BILLIONS;
  return name === 'llama3.2' || name === 'llama3.2:latest';
}

/** Devine le fournisseur à partir d'une clé collée, pour éviter un clic. */
export function detectProvider(apiKey: string): OwnKeyProvider | null {
  const key = apiKey.trim();
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  return null;
}

function authHeaders({ provider, apiKey }: LlmSettings): Record<string, string> {
  switch (provider) {
    case 'anthropic':
      return {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Requis par Anthropic pour un appel direct depuis un navigateur ou une extension.
        'anthropic-dangerous-direct-browser-access': 'true',
      };
    case 'openai':
      return { authorization: `Bearer ${apiKey}` };
    case 'propulsee':
      return { [LLM_INSTALL_HEADER]: apiKey };
    case 'ollama':
      return {};
  }
}

function baseUrlOf(settings: LlmSettings): string {
  return settings.baseUrl ?? LLM_PROVIDER_INFO[settings.provider].baseUrl;
}

/**
 * Requête qui vérifie la clé et le modèle sans générer de texte (donc sans coût) :
 * lecture de la fiche du modèle chez chaque fournisseur.
 */
export function buildTestRequest(settings: LlmSettings): HttpRequest {
  const baseUrl = baseUrlOf(settings);
  const model = encodeURIComponent(settings.model);

  if (settings.provider === 'propulsee') {
    return { url: `${baseUrl}/health`, method: 'GET', headers: {} };
  }
  if (settings.provider === 'ollama') {
    return {
      url: `${baseUrl}/api/show`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: settings.model }),
    };
  }
  return { url: `${baseUrl}/v1/models/${model}`, method: 'GET', headers: authHeaders(settings) };
}

/** Requête de génération d'une réponse à un prompt unique. */
export function buildCompletionRequest(
  settings: LlmSettings,
  prompt: string,
  maxTokens = 4096,
): HttpRequest {
  const baseUrl = baseUrlOf(settings);
  const headers = { 'content-type': 'application/json', ...authHeaders(settings) };
  const messages = [{ role: 'user', content: prompt }];

  switch (settings.provider) {
    case 'propulsee': {
      const body: LlmCompleteRequest = { prompt, maxTokens };
      return {
        url: `${baseUrl}/llm/complete`,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      };
    }
    case 'anthropic':
      return {
        url: `${baseUrl}/v1/messages`,
        method: 'POST',
        headers,
        body: JSON.stringify({ model: settings.model, max_tokens: maxTokens, messages }),
      };
    case 'openai':
      return {
        url: `${baseUrl}/v1/chat/completions`,
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: settings.model,
          max_completion_tokens: maxTokens,
          messages,
        }),
      };
    case 'ollama':
      return {
        url: `${baseUrl}/api/chat`,
        method: 'POST',
        headers,
        body: JSON.stringify({ model: settings.model, messages, stream: false }),
      };
  }
}

/** Extrait le texte d'une réponse de génération, ou `null` si la forme est inattendue. */
export function parseCompletionText(provider: LlmProvider, json: unknown): string | null {
  const data = json as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return null;

  switch (provider) {
    case 'propulsee':
      return typeof data.text === 'string' && data.text ? data.text : null;
    case 'anthropic': {
      const blocks = Array.isArray(data.content) ? data.content : [];
      const text = blocks
        .filter((b): b is { type: 'text'; text: string } => b?.type === 'text')
        .map((b) => b.text)
        .join('');
      return text || null;
    }
    case 'openai': {
      const choices = Array.isArray(data.choices) ? data.choices : [];
      const content: unknown = choices[0]?.message?.content;
      return typeof content === 'string' ? content : null;
    }
    case 'ollama': {
      const message = data.message as { content?: unknown } | undefined;
      return typeof message?.content === 'string' ? message.content : null;
    }
  }
}

/** Quota du jour atteint chez Propulsee : l'écran propose alors « Utiliser ma propre clé ». */
export const LLM_QUOTA_ERROR =
  'Limite du jour atteinte : réessayez demain, ou utilisez votre propre clé.';

/** Message d'erreur lisible pour un statut HTTP renvoyé par le fournisseur. */
export function describeLlmError(provider: LlmProvider, status: number | null): string {
  const { label } = LLM_PROVIDER_INFO[provider];
  if (provider === 'propulsee') {
    if (status === null) return 'Propulsee injoignable : vérifiez votre connexion.';
    if (status === 429) return LLM_QUOTA_ERROR;
    if (status === 422) return 'Je n’ai pas pu traiter cette demande. Réessayez autrement.';
    if (status === 503) return 'Le service Propulsee est indisponible pour le moment.';
    return `Propulsee a répondu une erreur (${status}).`;
  }
  if (status === null) {
    return provider === 'ollama'
      ? 'Ollama injoignable : vérifiez qu’il tourne sur ce poste (ollama serve).'
      : `${label} injoignable : vérifiez votre connexion.`;
  }
  if (status === 401 || status === 403) return `Clé ${label} refusée.`;
  if (status === 404) return `Modèle introuvable chez ${label}.`;
  if (status === 429) return `${label} limite les requêtes : réessayez dans un instant.`;
  return `${label} a répondu une erreur (${status}).`;
}
