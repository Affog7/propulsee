import {
  APPLICATION_STEPS,
  LLM_PROVIDER_INFO,
  STEP_LABELS,
  nextStep,
  type ApplicationStep,
  type LlmSettings,
} from '@propulsee/shared';
import { useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api';
import { loadLlmSettings } from '../lib/llm';
import { SettingsView } from './SettingsView';

type ApiState = 'checking' | 'ok' | 'degraded' | 'offline';

const API_LABELS: Record<ApiState, string> = {
  checking: 'API…',
  ok: 'API connectée',
  degraded: 'API sans base',
  offline: 'API hors ligne',
};

export function App() {
  const [step, setStep] = useState<ApplicationStep>('prepare');
  const [api, setApi] = useState<ApiState>('checking');
  // `undefined` tant que les paramètres ne sont pas chargés, `null` si aucun LLM n'est configuré.
  const [llm, setLlm] = useState<LlmSettings | null | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const next = nextStep(step);

  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal).then((health) => {
      if (!controller.signal.aborted) setApi(health?.status ?? 'offline');
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    void loadLlmSettings().then((settings) => {
      if (!active) return;
      setLlm(settings);
      // Premier lancement : on ouvre directement la connexion au LLM, sans clic.
      if (!settings) setShowSettings(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="panel">
      <header className="panel-header">
        <h1>Propulsee</h1>
        <div className="panel-status">
          <span className={`api-status api-status--${api}`}>{API_LABELS[api]}</span>
          {llm !== undefined && (
            <button
              type="button"
              className={`api-status api-status--${llm ? 'ok' : 'offline'} link`}
              title="Paramètres du LLM"
              onClick={() => setShowSettings(true)}
            >
              {llm ? LLM_PROVIDER_INFO[llm.provider].label : 'Connecter un LLM'}
            </button>
          )}
        </div>
      </header>

      {showSettings && llm !== undefined ? (
        <SettingsView
          initial={llm}
          onSaved={(settings) => {
            setLlm(settings);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      ) : (
        <>
          <ol className="steps">
            {APPLICATION_STEPS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="step"
                  aria-current={s === step ? 'step' : undefined}
                  onClick={() => setStep(s)}
                >
                  {STEP_LABELS[s]}
                </button>
              </li>
            ))}
          </ol>

          <section className="step-content">
            <h2>{STEP_LABELS[step]}</h2>
            <p>Étape à implémenter.</p>
          </section>

          {next && (
            <button type="button" className="primary" onClick={() => setStep(next)}>
              {STEP_LABELS[next]} →
            </button>
          )}
        </>
      )}
    </main>
  );
}
