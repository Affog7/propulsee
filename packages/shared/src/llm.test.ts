import { describe, expect, it } from 'vitest';
import {
  buildCompletionRequest,
  buildTestRequest,
  describeLlmError,
  detectProvider,
  parseCompletionText,
  type LlmSettings,
} from './llm';

const claude: LlmSettings = {
  provider: 'anthropic',
  apiKey: 'sk-ant-xyz',
  model: 'claude-opus-5-5',
};
const openai: LlmSettings = { provider: 'openai', apiKey: 'sk-abc', model: 'gpt-5' };
const ollama: LlmSettings = { provider: 'ollama', apiKey: '', model: 'llama3.2' };

describe('detectProvider', () => {
  it('reconnaît une clé à son préfixe', () => {
    expect(detectProvider('  sk-ant-api03-xyz ')).toBe('anthropic');
    expect(detectProvider('sk-proj-abc')).toBe('openai');
    expect(detectProvider('autre')).toBeNull();
  });
});

describe('buildTestRequest', () => {
  it('lit la fiche du modèle chez Anthropic, avec les en-têtes navigateur', () => {
    const req = buildTestRequest(claude);
    expect(req).toMatchObject({
      url: 'https://api.anthropic.com/v1/models/claude-opus-5-5',
      method: 'GET',
    });
    expect(req.headers).toMatchObject({
      'x-api-key': 'sk-ant-xyz',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
  });

  it('lit la fiche du modèle chez OpenAI avec un jeton Bearer', () => {
    const req = buildTestRequest(openai);
    expect(req.url).toBe('https://api.openai.com/v1/models/gpt-5');
    expect(req.headers.authorization).toBe('Bearer sk-abc');
  });

  it('interroge Ollama en local, sans clé', () => {
    const req = buildTestRequest(ollama);
    expect(req.url).toBe('http://localhost:11434/api/show');
    expect(JSON.parse(req.body ?? '')).toEqual({ model: 'llama3.2' });
  });
});

describe('buildCompletionRequest', () => {
  it("cible l'API Messages d'Anthropic", () => {
    const req = buildCompletionRequest(claude, 'Bonjour', 100);
    expect(req.url).toBe('https://api.anthropic.com/v1/messages');
    expect(JSON.parse(req.body ?? '')).toEqual({
      model: 'claude-opus-5-5',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Bonjour' }],
    });
  });

  it('cible chat/completions chez OpenAI et /api/chat chez Ollama', () => {
    expect(buildCompletionRequest(openai, 'x').url).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
    expect(JSON.parse(buildCompletionRequest(ollama, 'x').body ?? '')).toMatchObject({
      stream: false,
    });
  });
});

describe('parseCompletionText', () => {
  it('extrait le texte de chaque format de réponse', () => {
    expect(
      parseCompletionText('anthropic', {
        content: [
          { type: 'thinking', thinking: '' },
          { type: 'text', text: 'Bon' },
          { type: 'text', text: 'jour' },
        ],
      }),
    ).toBe('Bonjour');
    expect(parseCompletionText('openai', { choices: [{ message: { content: 'Salut' } }] })).toBe(
      'Salut',
    );
    expect(parseCompletionText('ollama', { message: { content: 'Coucou' } })).toBe('Coucou');
  });

  it('renvoie null pour une réponse inattendue', () => {
    expect(parseCompletionText('anthropic', null)).toBeNull();
    expect(parseCompletionText('openai', { choices: [] })).toBeNull();
  });
});

describe('describeLlmError', () => {
  it('traduit les statuts courants en message clair', () => {
    expect(describeLlmError('anthropic', 401)).toBe('Clé Claude refusée.');
    expect(describeLlmError('openai', 404)).toBe('Modèle introuvable chez OpenAI.');
    expect(describeLlmError('ollama', null)).toContain('ollama serve');
  });
});
