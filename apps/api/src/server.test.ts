import { describe, expect, it } from 'vitest';
import type { Db } from './db';
import { buildServer } from './server';

function fakeDb(up: boolean): Db {
  return { ping: async () => up, close: async () => {} };
}

describe('GET /health', () => {
  it('répond ok quand Postgres est joignable', async () => {
    const app = buildServer({ db: fakeDb(true), logger: false });
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'up' });
    await app.close();
  });

  it('répond 503 quand Postgres est injoignable', async () => {
    const app = buildServer({ db: fakeDb(false), logger: false });
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'degraded', db: 'down' });
    await app.close();
  });
});
