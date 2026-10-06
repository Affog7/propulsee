import Anthropic from '@anthropic-ai/sdk';

/** Réponse du LLM, ou refus (le modèle et ses remplaçants ont décliné la demande). */
export type GatewayResult = { ok: true; text: string } | { ok: false; reason: 'refusal' };

/** Accès au LLM géré par Propulsee, injecté dans `buildServer` (remplacé par un faux en test). */
export interface LlmGateway {
  complete(prompt: string, maxTokens: number): Promise<GatewayResult>;
}

/**
 * Marge de jetons pour la réflexion du modèle, qui compte dans `max_tokens` : sans elle, une
 * réponse courte demandée par l'extension serait coupée.
 */
const THINKING_HEADROOM_TOKENS = 4096;

/** Passerelle vers Claude avec la clé de Propulsee (jamais celle de l'utilisateur). */
export function createAnthropicGateway(apiKey: string, model: string): LlmGateway {
  const client = new Anthropic({ apiKey });
  return {
    async complete(prompt, maxTokens) {
      const message = await client.beta.messages.create({
        model,
        max_tokens: maxTokens + THINKING_HEADROOM_TOKENS,
        messages: [{ role: 'user', content: prompt }],
        // Tâches courtes et cadrées : on privilégie la vitesse.
        output_config: { effort: 'low' },
        // En cas de refus, l'API rejoue la demande sur le modèle de repli recommandé.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      if (message.stop_reason === 'refusal') return { ok: false, reason: 'refusal' };
      const text = message.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');
      return { ok: true, text };
    },
  };
}
