import {
  LLM_PROVIDERS,
  LLM_PROVIDER_INFO,
  detectProvider,
  type LlmProvider,
  type LlmSettings,
} from '@propulsee/shared';
import { useState, type FormEvent } from 'react';
import { saveLlmSettings, testLlmConnection } from '../lib/llm';

interface Props {
  initial: LlmSettings | null;
  onSaved: (settings: LlmSettings) => void;
  onClose: () => void;
}

type TestState = { kind: 'idle' } | { kind: 'testing' } | { kind: 'error'; message: string };

export function SettingsView({ initial, onSaved, onClose }: Props) {
  const [provider, setProvider] = useState<LlmProvider>(initial?.provider ?? 'anthropic');
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '');
  const [model, setModel] = useState(initial?.model ?? LLM_PROVIDER_INFO.anthropic.defaultModel);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const info = LLM_PROVIDER_INFO[provider];

  function selectProvider(next: LlmProvider) {
    if (next === provider) return;
    // On garde un modèle saisi à la main, sinon on passe au modèle par défaut du fournisseur.
    if (model === info.defaultModel || model === '') setModel(LLM_PROVIDER_INFO[next].defaultModel);
    setProvider(next);
    setTest({ kind: 'idle' });
  }

  function changeApiKey(value: string) {
    setApiKey(value);
    setTest({ kind: 'idle' });
    // Coller une clé suffit : le fournisseur est reconnu à son préfixe.
    const detected = detectProvider(value);
    if (detected) selectProvider(detected);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const settings: LlmSettings = {
      provider,
      apiKey: info.needsApiKey ? apiKey.trim() : '',
      model: model.trim(),
    };
    setTest({ kind: 'testing' });
    const result = await testLlmConnection(settings);
    if (!result.ok) {
      setTest({ kind: 'error', message: result.error });
      return;
    }
    await saveLlmSettings(settings);
    onSaved(settings);
  }

  const canSubmit =
    test.kind !== 'testing' && model.trim() !== '' && (!info.needsApiKey || apiKey.trim() !== '');

  return (
    <form className="settings" onSubmit={(e) => void submit(e)}>
      <div className="settings-header">
        <h2>Connexion au LLM</h2>
        <button type="button" className="link" onClick={onClose}>
          Fermer
        </button>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Fournisseur">
        {LLM_PROVIDERS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={p === provider}
            className="segment"
            onClick={() => selectProvider(p)}
          >
            {LLM_PROVIDER_INFO[p].label}
          </button>
        ))}
      </div>

      {info.needsApiKey ? (
        <label className="field">
          <span>Clé API</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
            value={apiKey}
            onChange={(e) => changeApiKey(e.target.value)}
            autoFocus
          />
          {info.keyHelpUrl && (
            <a href={info.keyHelpUrl} target="_blank" rel="noreferrer" className="hint">
              Obtenir une clé {info.label}
            </a>
          )}
        </label>
      ) : (
        <p className="hint">
          Aucune clé nécessaire : Ollama doit tourner sur ce poste (<code>ollama serve</code>).
        </p>
      )}

      <label className="field">
        <span>Modèle</span>
        <input
          type="text"
          spellCheck={false}
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setTest({ kind: 'idle' });
          }}
        />
      </label>

      {test.kind === 'error' && (
        <p className="form-error" role="alert">
          {test.message}
        </p>
      )}

      <button type="submit" className="primary" disabled={!canSubmit}>
        {test.kind === 'testing' ? 'Test en cours…' : 'Tester et enregistrer'}
      </button>
      <p className="hint">La clé reste sur ce navigateur et n’est jamais envoyée à Propulsee.</p>
    </form>
  );
}
