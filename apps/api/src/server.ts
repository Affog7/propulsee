import {
  LLM_INSTALL_HEADER,
  LLM_MAX_COMPLETION_TOKENS,
  LLM_MAX_PROMPT_CHARS,
  type HealthResponse,
  type LlmCompleteRequest,
  type LlmCompleteResponse,
} from '@propulsee/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Db } from './db';
import { createInstallQuota, type InstallQuota } from './install-quota';
import type { LlmGateway } from './llm-gateway';

export interface ServerOptions {
  db: Db;
  /** LLM géré par Propulsee ; `null` si aucune clé n'est configurée (`/llm/complete` répond 503). */
  llm?: LlmGateway | null;
  quota?: InstallQuota;
  logger?: FastifyServerOptions['logger'];
}

const completeSchema = {
  headers: {
    type: 'object',
    required: [LLM_INSTALL_HEADER],
    properties: { [LLM_INSTALL_HEADER]: { type: 'string', pattern: '^[0-9a-f-]{36}$' } },
  },
  body: {
    type: 'object',
    required: ['prompt', 'maxTokens'],
    additionalProperties: false,
    properties: {
      prompt: { type: 'string', minLength: 1, maxLength: LLM_MAX_PROMPT_CHARS },
      maxTokens: { type: 'integer', minimum: 1, maximum: LLM_MAX_COMPLETION_TOKENS },
    },
  },
} as const;

export function buildServer({
  db,
  llm = null,
  quota = createInstallQuota(),
  logger = true,
}: ServerOptions) {
  const app = Fastify({ logger });

  app.addHook('onClose', async () => {
    await db.close();
  });

  app.get('/health', async (_request, reply): Promise<HealthResponse> => {
    const dbUp = await db.ping();
    reply.code(dbUp ? 200 : 503);
    return { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' };
  });

  // Connexion LLM par défaut de l'extension : Propulsee appelle le LLM avec sa propre clé.
  // Les utilisateurs qui ont branché leur clé n'utilisent pas cette route.
  app.post<{ Body: LlmCompleteRequest }>(
    '/llm/complete',
    { schema: completeSchema },
    async (request, reply): Promise<LlmCompleteResponse | { error: string }> => {
      if (!llm) {
        reply.code(503);
        return { error: 'LLM non configuré' };
      }
      const installId = request.headers[LLM_INSTALL_HEADER] as string;
      if (!quota.take(installId)) {
        reply.code(429);
        return { error: 'Limite du jour atteinte' };
      }
      try {
        const result = await llm.complete(request.body.prompt, request.body.maxTokens);
        if (!result.ok) {
          reply.code(422);
          return { error: 'Demande refusée par le modèle' };
        }
        return { text: result.text };
      } catch (err) {
        request.log.error({ err }, 'LLM : échec de la génération');
        reply.code(502);
        return { error: 'LLM indisponible' };
      }
    },
  );

  return app;
}
