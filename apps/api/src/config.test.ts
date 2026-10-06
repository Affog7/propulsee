import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('fournit des valeurs par défaut pour le dev local', () => {
    expect(loadConfig({})).toEqual({
      host: 'localhost',
      port: 3000,
      databaseUrl: 'postgres://propulsee:propulsee@localhost:5433/propulsee',
      logLevel: 'info',
      anthropicApiKey: null,
      llmModel: 'claude-opus-5-5',
      llmDailyLimit: 200,
    });
  });

  it('lit la clé et le modèle du LLM géré', () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: 'sk-ant-x', LLM_MODEL: 'claude-sonnet-5-5' });
    expect(config.anthropicApiKey).toBe('sk-ant-x');
    expect(config.llmModel).toBe('claude-sonnet-5-5');
  });

  it('rejette un LLM_DAILY_LIMIT invalide', () => {
    expect(() => loadConfig({ LLM_DAILY_LIMIT: '0' })).toThrow('LLM_DAILY_LIMIT invalide');
  });

  it('rejette un PORT invalide', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('PORT invalide');
  });
});
