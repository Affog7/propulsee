import {
  APPLICATION_STEPS,
  LLM_PROVIDER_INFO,
  STEP_LABELS,
  cvFileName,
  documentFileName,
  emptyAnswers,
  nextStep,
  profileInitials,
  type ApplicationStep,
  type JobOffer,
  type LlmSettings,
  type MasterProfile,
  type TailoredCv,
} from '@propulsee/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api';
import { downloadLetterPdf } from '../lib/cover-letter';
import { downloadCvPdf } from '../lib/cv-pdf';
import { loadLlmSettings } from '../lib/llm';
import { loadProfile } from '../lib/profile';
import { ApplyView } from './ApplyView';
import { CvPreview } from './CvPreview';
import { LetterView } from './LetterView';
import { OfferView } from './OfferView';
import { ProfileView } from './ProfileView';
import { SettingsView } from './SettingsView';
import { VerifyView } from './VerifyView';
import { useActiveJobOffer } from './use-active-job-offer';
import { useAutofill, type AutofillState } from './use-autofill';
import { useCopy } from './use-copy';
import { useCoverLetter } from './use-cover-letter';
import { useDownload } from './use-download';
import { useFreeAnswers } from './use-free-answers';
import { useOfferAnalysis, type OfferAnalysis } from './use-offer-analysis';
import { useTailoredCv } from './use-tailored-cv';

type ApiState = 'checking' | 'ok' | 'degraded' | 'offline';

const API_LABELS: Record<ApiState, string> = {
  checking: 'API…',
  ok: 'API connectée',
  degraded: 'API sans base',
  offline: 'API hors ligne',
};

type View = 'flow' | 'settings' | 'profile' | 'cv' | 'letter';

/** Écran à ouvrir d'office : ce qui manque encore, dans l'ordre (LLM puis profil). */
function missingView(llm: LlmSettings | null, profile: MasterProfile | null): View {
  if (!llm) return 'settings';
  if (!profile) return 'profile';
  return 'flow';
}

/** Bouton principal de « Postuler » : remplit le formulaire ouvert dans l'onglet. */
function FillButton({
  state,
  documentsPending,
  reviewing,
  onFill,
}: {
  state: AutofillState;
  /** Réponses aux questions libres à relire puis insérer. */
  reviewing: boolean;
  /** CV ou lettre encore en préparation : on attend pour les joindre. */
  documentsPending: boolean;
  onFill: () => void;
}) {
  // Le panneau pose une question, ou attend la relecture des réponses : son propre bouton
  // complète le formulaire.
  if (state.status === 'done' && (state.result.missing.length > 0 || reviewing)) return null;
  if (state.status === 'filling' || documentsPending) {
    return (
      <button type="button" className="primary" disabled>
        {documentsPending ? 'Je finis vos documents…' : 'Quelques secondes…'}
      </button>
    );
  }
  return (
    <button type="button" className="primary" onClick={onFill}>
      {state.status === 'done' ? 'Remplir à nouveau' : 'Remplir le formulaire'}
    </button>
  );
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
  const found = offer.status === 'found' ? offer.offer : null;
  // Chaque nouvelle offre repart de « Préparer ».
  const [progress, setProgress] = useState<{ url: string | null; step: ApplicationStep }>({
    url: null,
    step: 'prepare',
  });
  // Le formulaire de candidature s'ouvre souvent hors du site de l'offre (Greenhouse, site de
  // l'entreprise…) : pendant « Postuler », le panneau garde l'offre à laquelle on postule.
  const [lastOffer, setLastOffer] = useState<JobOffer | null>(null);
  if (found && found !== lastOffer) setLastOffer(found);
  const applyingElsewhere =
    !found && !!lastOffer && progress.url === lastOffer.url && progress.step === 'apply';
  const activeOffer = found ?? (applyingElsewhere ? lastOffer : null);
  const offerUrl = activeOffer?.url ?? null;
  const step = progress.url === offerUrl ? progress.step : 'prepare';
  const setStep = (s: ApplicationStep) => setProgress({ url: offerUrl, step: s });
  const [api, setApi] = useState<ApiState>('checking');
  // `undefined` tant que le stockage n'est pas lu, `null` si rien n'est encore configuré.
  const [llm, setLlm] = useState<LlmSettings | null | undefined>(undefined);
  const [profile, setProfile] = useState<MasterProfile | null | undefined>(undefined);
  const [view, setView] = useState<View>('flow');
  const next = nextStep(step);
  const analysis = useOfferAnalysis(activeOffer, llm ?? null, profile ?? null);
  // CV et lettre se préparent d'eux-mêmes après l'analyse, sauf pendant l'édition du profil.
  const documents = {
    offer: activeOffer,
    analysis: analysis.state.status === 'done' ? analysis.state.analysis : null,
    llm: llm ?? null,
    profile: profile ?? null,
    auto: view === 'flow' || view === 'cv' || view === 'letter',
  };
  const cv = useTailoredCv(documents);
  const letter = useCoverLetter(documents);
  const download = useDownload();
  const clipboard = useCopy();
  const onProfileSaved = useCallback((saved: MasterProfile) => setProfile(saved), []);
  const free = useFreeAnswers(documents);
  const autofill = useAutofill({
    offer: activeOffer,
    profile: profile ?? null,
    cv: cv.state.status === 'done' ? cv.state.tailored : null,
    letter: letter.state.status === 'done' ? letter.state.letter : null,
    onProfileSaved,
    onQuestions: free.start,
  });
  const documentsPending = [cv.state.status, letter.state.status].some(
    (s) => s === 'loading' || s === 'tailoring' || s === 'writing',
  );

  function downloadCv(tailored: TailoredCv) {
    if (activeOffer) {
      download.download(() =>
        downloadCvPdf(tailored, cvFileName(tailored.cv.fullName, activeOffer.company)),
      );
    }
  }

  function downloadLetter() {
    if (activeOffer && profile && letter.state.status === 'done') {
      const done = letter.state.letter;
      download.download(() =>
        downloadLetterPdf(
          done,
          profile,
          activeOffer,
          documentFileName(profile.fullName, 'Lettre', activeOffer.company),
        ),
      );
    }
  }

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
          downloading={download.busy}
          downloadError={download.error}
          onDownload={() => {
            if (cv.state.status === 'done') downloadCv(cv.state.tailored);
          }}
          onRetailor={() => {
            cv.tailor();
            setView('flow');
          }}
          onClose={() => setView('flow')}
        />
      ) : view === 'letter' && activeOffer && letter.format ? (
        <LetterView
          state={letter.state}
          format={letter.format}
          copied={clipboard.copied}
          downloading={download.busy}
          downloadError={download.error}
          onFormat={letter.setFormat}
          onEdit={letter.edit}
          onRegenerate={letter.regenerate}
          onCopy={clipboard.copy}
          onDownload={downloadLetter}
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
              letter={letter.state}
              downloading={download.busy}
              downloadError={download.error}
              letterCopied={clipboard.copied}
              onRetryCv={cv.tailor}
              onPreviewCv={() => setView('cv')}
              onDownloadCv={downloadCv}
              onRetryLetter={letter.regenerate}
              onOpenLetter={() => setView('letter')}
              onCopyLetter={clipboard.copy}
            />
          ) : (
            <ApplyView
              offer={activeOffer}
              hasProfile={!!profile}
              state={autofill.state}
              answers={profile?.answers ?? emptyAnswers()}
              onAnswer={autofill.fill}
              free={free}
            />
          )}

          <div className="sticky-footer">
            {step === 'apply'
              ? offerUrl &&
                (profile ? (
                  <FillButton
                    state={autofill.state}
                    documentsPending={documentsPending}
                    reviewing={free.state.items.length > 0 && !free.state.inserted}
                    onFill={() => autofill.fill()}
                  />
                ) : (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setView(llm ? 'profile' : 'settings')}
                  >
                    Créer mon profil
                  </button>
                ))
              : step === 'prepare'
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
