import {
  APPLICATION_STEPS,
  LLM_PROVIDER_INFO,
  STEP_LABELS,
  nextStep,
  profileInitials,
  type ApplicationStep,
  type LlmSettings,
  type MasterProfile,
} from '@propulsee/shared';
import { useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api';
import { loadLlmSettings } from '../lib/llm';
import { loadProfile } from '../lib/profile';
import { ProfileView } from './ProfileView';
import { SettingsView } from './SettingsView';

type ApiState = 'checking' | 'ok' | 'degraded' | 'offline';

const API_LABELS: Record<ApiState, string> = {
  checking: 'API…',
  ok: 'API connectée',
  degraded: 'API sans base',
  offline: 'API hors ligne',
};

type View = 'flow' | 'settings' | 'profile';

/** Écran à ouvrir d'office : ce qui manque encore, dans l'ordre (LLM puis profil). */
function missingView(llm: LlmSettings | null, profile: MasterProfile | null): View {
  if (!llm) return 'settings';
  if (!profile) return 'profile';
  return 'flow';
}

export function App() {
  const [step, setStep] = useState<ApplicationStep>('prepare');
  const [api, setApi] = useState<ApiState>('checking');
  // `undefined` tant que le stockage n'est pas lu, `null` si rien n'est encore configuré.
  const [llm, setLlm] = useState<LlmSettings | null | undefined>(undefined);
  const [profile, setProfile] = useState<MasterProfile | null | undefined>(undefined);
  const [view, setView] = useState<View>('flow');
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
    void Promise.all([loadLlmSettings(), loadProfile()]).then(([settings, saved]) => {
      if (!active) return;
      setLlm(settings);
      setProfile(saved);
      // Premier lancement : on enchaîne directement sur ce qui manque, sans clic.
      setView(missingView(settings, saved));
    });
    return () => {
      active = false;
    };
  }, []);

  if (llm === undefined || profile === undefined) return <main className="panel" />;

  return (
    <main className="panel">
      <header className="panel-header">
        <h1>
          <span className="logo" aria-hidden="true">
            ✦
          </span>
          Propulsee
        </h1>
        <div className="panel-status">
          <span className={`api-status api-status--${api}`}>{API_LABELS[api]}</span>
          <button
            type="button"
            className={`api-status api-status--${llm ? 'ok' : 'offline'} link`}
            title="Paramètres du LLM"
            onClick={() => setView('settings')}
          >
            {llm ? LLM_PROVIDER_INFO[llm.provider].label : 'Connecter un LLM'}
          </button>
        </div>
      </header>

      {view === 'settings' ? (
        <SettingsView
          initial={llm}
          onSaved={(settings) => {
            setLlm(settings);
            setView(missingView(settings, profile));
          }}
          onClose={() => setView(missingView(llm, profile) === 'profile' ? 'profile' : 'flow')}
        />
      ) : view === 'profile' && llm ? (
        <ProfileView
          llm={llm}
          initial={profile}
          onSaved={setProfile}
          onClose={() => setView('flow')}
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

          <button
            type="button"
            className="profile-chip"
            onClick={() => setView(llm ? 'profile' : 'settings')}
          >
            <span className="avatar avatar--small" aria-hidden="true">
              {profileInitials(profile?.fullName ?? '') || '✦'}
            </span>
            {profile?.fullName ? `Profil de ${profile.fullName}` : 'Créer mon profil'}
          </button>
        </>
      )}
    </main>
  );
}
