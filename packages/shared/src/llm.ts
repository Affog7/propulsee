/** Fournisseurs de LLM pris en charge. */
export const LLM_PROVIDERS = ['anthropic', 'openai', 'ollama'] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export interface LlmProviderInfo {
  label: string;
  /** Modèle proposé par défaut, modifiable par l'utilisateur. */
  defaultModel: string;
  /** URL de base de l'API. L'extension doit l'autoriser dans `host_permissions`. */
  baseUrl: string;
  /** `false` pour un modèle local, qui n'a pas besoin de clé. */
  needsApiKey: boolean;
  /** Où obtenir une clé, affiché sous le champ. */
  keyHelpUrl?: string;
}

export const LLM_PROVIDER_INFO: Record<LlmProvider, LlmProviderInfo> = {
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
    defaultModel: 'llama3.2',
    baseUrl: 'http://localhost:11434',
    needsApiKey: false,
  },
};

/** Connexion au LLM choisie par l'utilisateur. */
export interface LlmSettings {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

/** Requête HTTP décrite sans dépendre de `fetch`, pour rester testable et portable. */
export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
}

/** Devine le fournisseur à partir d'une clé collée, pour éviter un clic. */
export function detectProvider(apiKey: string): LlmProvider | null {
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
    case 'ollama':
      return {};
  }
}

/**
 * Requête qui vérifie la clé et le modèle sans générer de texte (donc sans coût) :
 * lecture de la fiche du modèle chez chaque fournisseur.
 */
export function buildTestRequest(settings: LlmSettings): HttpRequest {
  const { baseUrl } = LLM_PROVIDER_INFO[settings.provider];
  const model = encodeURIComponent(settings.model);

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
  const { baseUrl } = LLM_PROVIDER_INFO[settings.provider];
  const headers = { 'content-type': 'application/json', ...authHeaders(settings) };
  const messages = [{ role: 'user', content: prompt }];

  switch (settings.provider) {
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

/** Message d'erreur lisible pour un statut HTTP renvoyé par le fournisseur. */
export function describeLlmError(provider: LlmProvider, status: number | null): string {
  const { label } = LLM_PROVIDER_INFO[provider];
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
