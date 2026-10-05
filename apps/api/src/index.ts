import { loadConfig, loadDotEnv } from './config';
import { createDb } from './db';
import { buildServer } from './server';

loadDotEnv();
const config = loadConfig();

const app = buildServer({
  logger: { level: config.logLevel },
  db: createDb(config.databaseUrl, (err) =>
    app.log.error({ err }, 'Postgres : erreur sur une connexion inactive'),
  ),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} reçu, arrêt de l'API`);
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ host: config.host, port: config.port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
