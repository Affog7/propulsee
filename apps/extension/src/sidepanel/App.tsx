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
import { CvPreview } from './CvPreview';
import { OfferView } from './OfferView';
import { ProfileView } from './ProfileView';
import { SettingsView } from './SettingsView';
import { VerifyView } from './VerifyView';
import { useActiveJobOffer } from './use-active-job-offer';
import { useCvDownload } from './use-cv-download';
import { useOfferAnalysis, type OfferAnalysis } from './use-offer-analysis';
import { useTailoredCv } from './use-tailored-cv';

type ApiState = 'checking' | 'ok' | 'degraded' | 'offline';

const API_LABELS: Record<ApiState, string> = {
  checking: 'API…',
  ok: 'API connectée',
  degraded: 'API sans base',
  offline: 'API hors ligne',
};

type View = 'flow' | 'settings' | 'profile' | 'cv';

/** Écran à ouvrir d'office : ce qui manque encore, dans l'ordre (LLM puis profil). */
function missingView(llm: LlmSettings | null, profile: MasterProfile | null): View {
  if (!llm) return 'settings';
  if (!profile) return 'profile';
  return 'flow';
}

/** Bouton principal de « Préparer » : lance l'analyse, puis mène à « Vérifier ». */
function PrepareButton({
  analysis,
  onPrepare,
  onNext,
}: {
  analysis: OfferAnalysis;
  onPrepare: () => void;
  onNext: () => void;
}) {
  switch (analysis.status) {
    case 'analyzing':
      return (
        <button type="button" className="primary" disabled>
          Quelques secondes…
        </button>
      );
    case 'done':
      return (
        <button type="button" className="primary" onClick={onNext}>
          {STEP_LABELS.verify} →
        </button>
      );
    case 'error':
      return (
        <button type="button" className="primary" onClick={onPrepare}>
          Réessayer
        </button>
      );
    case 'idle':
      return (
        <button type="button" className="primary" onClick={onPrepare}>
          Préparer ma candidature
        </button>
      );
  }
}

export function App() {
  const offer = useActiveJobOffer();
  const offerUrl = offer.status === 'found' ? offer.offer.url : null;
  // Chaque nouvelle offre repart de « Préparer ».
  const [progress, setProgress] = useState<{ url: string | null; step: ApplicationStep }>({
    url: null,
    step: 'prepare',
  });
  const step = progress.url === offerUrl ? progress.step : 'prepare';
  const setStep = (s: ApplicationStep) => setProgress({ url: offerUrl, step: s });
  const [api, setApi] = useState<ApiState>('checking');
  // `undefined` tant que le stockage n'est pas lu, `null` si rien n'est encore configuré.
  const [llm, setLlm] = useState<LlmSettings | null | undefined>(undefined);
  const [profile, setProfile] = useState<MasterProfile | null | undefined>(undefined);
  const [view, setView] = useState<View>('flow');
  const next = nextStep(step);
  const activeOffer = offer.status === 'found' ? offer.offer : null;
  const analysis = useOfferAnalysis(activeOffer, llm ?? null, profile ?? null);
  const cv = useTailoredCv({
    offer: activeOffer,
    analysis: analysis.state.status === 'done' ? analysis.state.analysis : null,
    llm: llm ?? null,
    profile: profile ?? null,
    auto: view === 'flow' || view === 'cv',
  });
  const cvDownload = useCvDownload();

  function prepare() {
    if (!llm) setView('settings');
    else {
      setStep('prepare');
      analysis.analyze();
    }
  }

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
      ) : view === 'cv' && activeOffer && cv.state.status === 'done' ? (
        <CvPreview
          tailored={cv.state.tailored}
          downloading={cvDownload.busy}
          downloadError={cvDownload.error}
          onDownload={() => {
            if (cv.state.status === 'done') cvDownload.download(cv.state.tailored, activeOffer);
          }}
          onRetailor={() => {
            cv.tailor();
            setView('flow');
          }}
          onClose={() => setView('flow')}
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
            {APPLICATION_STEPS.map((s, index) => (
              <li key={s}>
                <button
                  type="button"
                  className="step"
                  data-done={index < APPLICATION_STEPS.indexOf(step) || undefined}
                  aria-current={s === step ? 'step' : undefined}
                  disabled={!offerUrl}
                  onClick={() => setStep(s)}
                >
                  {STEP_LABELS[s]}
                </button>
              </li>
            ))}
          </ol>

          {step === 'prepare' ? (
            <OfferView state={offer} analysis={analysis.state} hasProfile={!!profile} />
          ) : step === 'verify' ? (
            <VerifyView
              offer={activeOffer}
              cv={cv.state}
              hasProfile={!!profile}
              downloading={cvDownload.busy}
              downloadError={cvDownload.error}
              onRetry={cv.tailor}
              onPreview={() => setView('cv')}
              onDownload={(tailored) => activeOffer && cvDownload.download(tailored, activeOffer)}
            />
          ) : (
            <section className="step-content">
              <h2>{STEP_LABELS[step]}</h2>
              <p>Étape à implémenter.</p>
            </section>
          )}

          <div className="sticky-footer">
            {step === 'prepare'
              ? offerUrl && (
                  <PrepareButton
                    analysis={analysis.state}
                    onPrepare={prepare}
                    onNext={() => setStep('verify')}
                  />
                )
              : step === 'verify' && offerUrl && cv.state.status === 'unavailable'
                ? analysis.state.status !== 'analyzing' && (
                    <button
                      type="button"
                      className="primary"
                      onClick={profile ? prepare : () => setView(llm ? 'profile' : 'settings')}
                    >
                      {profile ? 'Préparer ma candidature' : 'Créer mon profil'}
                    </button>
                  )
                : next && (
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
          </div>
        </>
      )}
    </main>
  );
}
