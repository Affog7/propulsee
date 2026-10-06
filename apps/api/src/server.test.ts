import { describe, expect, it } from 'vitest';
import type { Db } from './db';
import { createInstallQuota } from './install-quota';
import type { GatewayResult, LlmGateway } from './llm-gateway';
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

describe('POST /llm/complete', () => {
  const install = '0b6f8a52-3c1e-4d7a-9f10-2a4b6c8d0e12';
  const body = { prompt: 'Bonjour', maxTokens: 100 };

  function fakeLlm(result: GatewayResult | Error) {
    const calls: Array<[string, number]> = [];
    const llm: LlmGateway = {
      complete: async (prompt, maxTokens) => {
        calls.push([prompt, maxTokens]);
        if (result instanceof Error) throw result;
        return result;
      },
    };
    return { llm, calls };
  }

  function post(app: ReturnType<typeof buildServer>, headers = { 'x-propulsee-install': install }) {
    return app.inject({ method: 'POST', url: '/llm/complete', headers, payload: body });
  }

  it('renvoie le texte du LLM', async () => {
    const { llm, calls } = fakeLlm({ ok: true, text: 'Salut' });
    const app = buildServer({ db: fakeDb(true), llm, logger: false });
    const res = await post(app);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ text: 'Salut' });
    expect(calls).toEqual([['Bonjour', 100]]);
    await app.close();
  });

  it('exige un identifiant d’installation valide', async () => {
    const { llm, calls } = fakeLlm({ ok: true, text: 'Salut' });
    const app = buildServer({ db: fakeDb(true), llm, logger: false });

    expect((await post(app, { 'x-propulsee-install': 'nimporte' })).statusCode).toBe(400);
    expect(calls).toEqual([]);
    await app.close();
  });

  it('rejette un prompt vide ou une réponse trop longue', async () => {
    const { llm } = fakeLlm({ ok: true, text: 'Salut' });
    const app = buildServer({ db: fakeDb(true), llm, logger: false });
    const send = (payload: object) =>
      app.inject({
        method: 'POST',
        url: '/llm/complete',
        headers: { 'x-propulsee-install': install },
        payload,
      });

    expect((await send({ prompt: '', maxTokens: 10 })).statusCode).toBe(400);
    expect((await send({ prompt: 'x', maxTokens: 100_000 })).statusCode).toBe(400);
    await app.close();
  });

  it('répond 429 une fois la limite du jour atteinte', async () => {
    const { llm } = fakeLlm({ ok: true, text: 'Salut' });
    const app = buildServer({ db: fakeDb(true), llm, quota: createInstallQuota(1), logger: false });

    expect((await post(app)).statusCode).toBe(200);
    expect((await post(app)).statusCode).toBe(429);
    await app.close();
  });

  it('répond 503 sans clé configurée', async () => {
    const app = buildServer({ db: fakeDb(true), logger: false });
    expect((await post(app)).statusCode).toBe(503);
    await app.close();
  });

  it('répond 422 sur un refus et 502 sur une erreur du fournisseur', async () => {
    const refused = buildServer({
      db: fakeDb(true),
      llm: fakeLlm({ ok: false, reason: 'refusal' }).llm,
      logger: false,
    });
    expect((await post(refused)).statusCode).toBe(422);
    await refused.close();

    const failing = buildServer({
      db: fakeDb(true),
      llm: fakeLlm(new Error('panne')).llm,
      logger: false,
    });
    expect((await post(failing)).statusCode).toBe(502);
    await failing.close();
  });
});
