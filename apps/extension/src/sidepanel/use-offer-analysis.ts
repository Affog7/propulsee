import type { JobAnalysis, JobOffer, LlmSettings, MasterProfile } from '@propulsee/shared';
import { useCallback, useEffect, useState } from 'react';
import { analyzeOffer, loadAnalysis, saveAnalysis } from '../lib/job-analysis';

export type OfferAnalysis =
  /** Pas encore analysée : l'analyse part au clic sur « Préparer ma candidature ». */
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'done'; analysis: JobAnalysis }
  | { status: 'error'; error: string };

const IDLE: OfferAnalysis = { status: 'idle' };

/**
 * Analyse de l'offre affichée. L'état est gardé par offre : une analyse lancée continue si
 * l'utilisateur change d'onglet, et s'affiche quand il revient sur l'offre.
 */
export function useOfferAnalysis(
  offer: JobOffer | null,
  llm: LlmSettings | null,
  profile: MasterProfile | null,
): { state: OfferAnalysis; analyze: () => void } {
  const url = offer?.url ?? null;
  const [byUrl, setByUrl] = useState<Record<string, OfferAnalysis>>({});
  const state = (url && byUrl[url]) || IDLE;
  const known = url !== null && url in byUrl;

  const set = useCallback((target: string, analysis: OfferAnalysis) => {
    setByUrl((all) => ({ ...all, [target]: analysis }));
  }, []);

  // Offre déjà analysée lors d'une visite précédente : on réaffiche son analyse.
  useEffect(() => {
    if (!url || known) return;
    let active = true;
    void loadAnalysis(url).then((saved) => {
      // Ne pas écraser une analyse lancée entre-temps.
      if (!active || !saved) return;
      setByUrl((all) =>
        url in all ? all : { ...all, [url]: { status: 'done', analysis: saved } },
      );
    });
    return () => {
      active = false;
    };
  }, [url, known]);

  const analyze = useCallback(() => {
    if (!offer || !llm || state.status === 'analyzing') return;
    const target = offer.url;
    set(target, { status: 'analyzing' });
    void analyzeOffer(llm, offer, profile).then(async (result) => {
      if (!result.ok) {
        set(target, { status: 'error', error: result.error });
        return;
      }
      set(target, { status: 'done', analysis: result.value });
      // Un échec d'enregistrement ne doit pas cacher une analyse réussie.
      await saveAnalysis(target, result.value).catch(() => undefined);
    });
  }, [offer, llm, profile, state.status, set]);

  return { state, analyze };
}
