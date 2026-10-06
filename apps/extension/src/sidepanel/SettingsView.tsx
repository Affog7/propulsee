import {
  LLM_PROVIDER_INFO,
  OWN_KEY_PROVIDERS,
  detectProvider,
  isWeakLocalModel,
  type LlmSettings,
  type OwnKeyProvider,
} from '@propulsee/shared';
import { useState, type FormEvent } from 'react';
import { saveLlmSettings, testLlmConnection } from '../lib/llm';

interface Props {
  /** Clé déjà branchée, à modifier ; `null` pour en brancher une. */
  initial: LlmSettings | null;
  onSaved: (settings: LlmSettings) => void;
  onClose: () => void;
}

type TestState = { kind: 'idle' } | { kind: 'testing' } | { kind: 'error'; message: string };

function ownKeyProvider(settings: LlmSettings | null): OwnKeyProvider {
  return settings && settings.provider !== 'propulsee' ? settings.provider : 'anthropic';
}

/** « Ma propre clé » : brancher son compte Claude, OpenAI ou un modèle local, sans abonnement. */
export function SettingsView({ initial, onSaved, onClose }: Props) {
  const [provider, setProvider] = useState<OwnKeyProvider>(ownKeyProvider(initial));
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '');
  const [model, setModel] = useState(initial?.model ?? LLM_PROVIDER_INFO.anthropic.defaultModel);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const info = LLM_PROVIDER_INFO[provider];

  function selectProvider(next: OwnKeyProvider) {
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
        <h2>Ma propre clé</h2>
        <button type="button" className="link" onClick={onClose}>
          Retour
        </button>
      </div>
      <p className="settings-lead">Connectez votre compte : plus de limite ni d’abonnement.</p>

      <div className="segmented" role="radiogroup" aria-label="Fournisseur">
        {OWN_KEY_PROVIDERS.map((p) => (
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

      {isWeakLocalModel({ provider, apiKey: '', model }) && (
        <p className="warn-note">
          Modèle léger : CV et lettres risquent d’être moins fiables. Préférez un modèle d’au moins
          7 milliards de paramètres, par exemple{' '}
          <code>{LLM_PROVIDER_INFO.ollama.defaultModel}</code>.
        </p>
      )}

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
