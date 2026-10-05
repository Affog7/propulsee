import pg from 'pg';

export interface Db {
  /** `true` si Postgres répond. */
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function createDb(connectionString: string, onError: (err: Error) => void): Db {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 2_000 });
  // Sans écouteur, une erreur sur une connexion inactive ferait planter le process.
  pool.on('error', onError);

  return {
    async ping() {
      try {
        await pool.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
    close: () => pool.end(),
  };
}
