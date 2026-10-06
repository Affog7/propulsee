import type {
  JobAnalysis,
  JobOffer,
  LlmSettings,
  MasterProfile,
  TailoredCv,
} from '@propulsee/shared';
import { useCallback, useEffect, useState } from 'react';
import { loadTailoredCv, saveTailoredCv, tailorCv } from '../lib/tailored-cv';

export type CvState =
  /** Rien à adapter : pas d'offre analysée, ou pas de profil. */
  | { status: 'unavailable' }
  /** Lecture du CV éventuellement déjà adapté, avant son adaptation automatique. */
  | { status: 'loading' }
  /** Pas de LLM configuré pour l'adapter. */
  | { status: 'idle' }
  | { status: 'tailoring' }
  | { status: 'done'; tailored: TailoredCv }
  | { status: 'error'; error: string };

interface Options {
  offer: JobOffer | null;
  analysis: JobAnalysis | null;
  llm: LlmSettings | null;
  profile: MasterProfile | null;
  /**
   * Charge ou adapte le CV de lui-même dès que l'offre est analysée. Désactivé pendant
   * l'édition du profil : chaque correction enregistrée relancerait l'adaptation.
   */
  auto: boolean;
}

/**
 * CV adapté à l'offre affichée. L'état est gardé par offre et par version du profil : corriger
 * son profil donne un nouveau CV, et une adaptation lancée continue si l'onglet change.
 */
export function useTailoredCv({ offer, analysis, llm, profile, auto }: Options): {
  state: CvState;
  tailor: () => void;
} {
  const key = offer && profile ? `${offer.url}|${profile.updatedAt}` : null;
  const [byKey, setByKey] = useState<Record<string, CvState>>({});
  const stored = key ? byKey[key] : undefined;
  const state: CvState =
    !key || !analysis ? { status: 'unavailable' } : (stored ?? { status: 'loading' });

  const set = useCallback((target: string, cv: CvState) => {
    setByKey((all) => ({ ...all, [target]: cv }));
  }, []);

  const run = useCallback(
    (
      target: string,
      settings: LlmSettings,
      from: MasterProfile,
      to: JobOffer,
      job: JobAnalysis,
    ) => {
      set(target, { status: 'tailoring' });
      void tailorCv(settings, from, to, job).then(async (result) => {
        if (!result.ok) {
          set(target, { status: 'error', error: result.error });
          return;
        }
        set(target, { status: 'done', tailored: result.value });
        // Un échec d'enregistrement ne doit pas cacher un CV réussi.
        await saveTailoredCv(to.url, result.value).catch(() => undefined);
      });
    },
    [set],
  );

  // CV déjà adapté lors d'une visite précédente : on le réaffiche. Sinon on l'adapte tout de
  // suite, car préparer c'est aussi adapter le CV : pas de clic de plus.
  useEffect(() => {
    if (!key || !offer || !profile || !analysis || !auto || stored) return;
    let active = true;
    void loadTailoredCv(offer.url, profile).then((saved) => {
      // Tout changement d'état pour cette offre relance l'effet et désactive ce rappel.
      if (!active) return;
      if (saved) set(key, { status: 'done', tailored: saved });
      else if (llm) run(key, llm, profile, offer, analysis);
      else set(key, { status: 'idle' });
    });
    return () => {
      active = false;
    };
  }, [key, offer, profile, analysis, llm, auto, stored, set, run]);

  const tailor = useCallback(() => {
    if (!key || !offer || !analysis || !llm || !profile || state.status === 'tailoring') return;
    run(key, llm, profile, offer, analysis);
  }, [key, offer, analysis, llm, profile, state.status, run]);

  return { state, tailor };
}
