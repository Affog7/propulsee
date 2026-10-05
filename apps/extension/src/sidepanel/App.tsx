import { APPLICATION_STEPS, STEP_LABELS, nextStep, type ApplicationStep } from '@propulsee/shared';
import { useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api';

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
  const next = nextStep(step);

  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal).then((health) => {
      if (!controller.signal.aborted) setApi(health?.status ?? 'offline');
    });
    return () => controller.abort();
  }, []);

  return (
    <main className="panel">
      <header className="panel-header">
        <h1>Propulsee</h1>
        <span className={`api-status api-status--${api}`}>{API_LABELS[api]}</span>
      </header>

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
    </main>
  );
}
