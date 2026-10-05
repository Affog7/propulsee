import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('fournit des valeurs par défaut pour le dev local', () => {
    expect(loadConfig({})).toEqual({
      host: 'localhost',
      port: 3000,
      databaseUrl: 'postgres://propulsee:propulsee@localhost:5433/propulsee',
      logLevel: 'info',
    });
  });

  it('rejette un PORT invalide', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('PORT invalide');
  });
});
