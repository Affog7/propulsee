import { fileURLToPath } from 'node:url';

export interface Config {
  host: string;
  port: number;
  databaseUrl: string;
  logLevel: string;
}

// Même chemin depuis src/ (tsx) et dist/ (build) : le .env est à la racine du dépôt.
const ROOT_ENV_FILE = fileURLToPath(new URL('../../../.env', import.meta.url));

/** Charge le `.env` racine s'il existe. Les variables déjà définies restent prioritaires. */
export function loadDotEnv(path = ROOT_ENV_FILE): void {
  try {
    process.loadEnvFile(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT invalide : ${env.PORT}`);
  }

  return {
    host: env.HOST ?? 'localhost',
    port,
    databaseUrl: env.DATABASE_URL ?? 'postgres://propulsee:propulsee@localhost:5433/propulsee',
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
