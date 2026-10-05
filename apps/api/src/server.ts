import type { HealthResponse } from '@propulsee/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Db } from './db';

export interface ServerOptions {
  db: Db;
  logger?: FastifyServerOptions['logger'];
}

export function buildServer({ db, logger = true }: ServerOptions) {
  const app = Fastify({ logger });

  app.addHook('onClose', async () => {
    await db.close();
  });

  app.get('/health', async (_request, reply): Promise<HealthResponse> => {
    const dbUp = await db.ping();
    reply.code(dbUp ? 200 : 503);
    return { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' };
  });

  return app;
}
