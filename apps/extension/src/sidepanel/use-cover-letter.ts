import type {
  CoverLetter,
  CoverLetterFormat,
  JobAnalysis,
  JobOffer,
  LlmSettings,
  MasterProfile,
} from '@propulsee/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadOfferLetters,
  saveOfferLetters,
  writeCoverLetter,
  type OfferLetters,
} from '../lib/cover-letter';

export type LetterState =
  /** Rien à rédiger : pas d'offre analysée, ou pas de profil. */
  | { status: 'unavailable' }
  /** Lecture des lettres déjà rédigées, avant la rédaction automatique. */
  | { status: 'loading' }
  /** Pas de LLM configuré pour la rédiger. */
  | { status: 'idle' }
  | { status: 'writing' }
  | { status: 'done'; letter: CoverLetter }
  | { status: 'error'; error: string };

interface Entry {
  saved: OfferLetters;
  /** Format en cours de rédaction. */
  writing: CoverLetterFormat | null;
  error: { format: CoverLetterFormat; message: string } | null;
}

interface Options {
  offer: JobOffer | null;
  analysis: JobAnalysis | null;
  llm: LlmSettings | null;
  profile: MasterProfile | null;
  /** Comme pour le CV : pas de rédaction automatique pendant l'édition du profil. */
  auto: boolean;
}

/** Délai avant l'enregistrement d'une retouche du texte. */
const AUTOSAVE_DELAY_MS = 400;

/**
 * Lettre (ou message recruteur) pour l'offre affichée, rédigée d'elle-même après l'analyse.
 * Chaque format est gardé : revenir à un format déjà rédigé ne relance pas le LLM.
 */
export function useCoverLetter({ offer, analysis, llm, profile, auto }: Options) {
  const key = offer && profile ? `${offer.url}|${profile.updatedAt}` : null;
  const [byKey, setByKey] = useState<Record<string, Entry>>({});
  const entry = key ? byKey[key] : undefined;
  const format = entry?.saved.active ?? null;
  const letter = format ? entry?.saved.letters[format] : undefined;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  let state: LetterState;
  if (!key || !analysis) state = { status: 'unavailable' };
  else if (!entry || !format) state = { status: 'loading' };
  else if (entry.writing === format) state = { status: 'writing' };
  else if (letter) state = { status: 'done', letter };
  else if (entry.error?.format === format) state = { status: 'error', error: entry.error.message };
  else state = llm ? { status: 'writing' } : { status: 'idle' };

  const update = useCallback(
    (target: string, url: string, change: (current: Entry) => Entry, persist: boolean) => {
      setByKey((all) => {
        const current = all[target];
        if (!current) return all;
        const next = change(current);
        if (persist) void saveOfferLetters(url, next.saved).catch(() => undefined);
        return { ...all, [target]: next };
      });
    },
    [],
  );

  const write = useCallback(
    (
      target: string,
      chosen: CoverLetterFormat,
      settings: LlmSettings,
      from: MasterProfile,
      to: JobOffer,
      job: JobAnalysis,
    ) => {
      update(target, to.url, (e) => ({ ...e, writing: chosen, error: null }), false);
      void writeCoverLetter(settings, from, to, job, chosen).then((result) => {
        update(
          target,
          to.url,
          (e) =>
            result.ok
              ? {
                  ...e,
                  writing: e.writing === chosen ? null : e.writing,
                  saved: { ...e.saved, letters: { ...e.saved.letters, [chosen]: result.value } },
                }
              : {
                  ...e,
                  writing: e.writing === chosen ? null : e.writing,
                  error: { format: chosen, message: result.error },
                },
          result.ok,
        );
      });
    },
    [update],
  );

  // Lettres déjà rédigées pour cette offre : on les réaffiche. Sinon on rédige tout de suite
  // le format affiché, comme le CV : pas de clic de plus.
  useEffect(() => {
    if (!key || !offer || !profile || !analysis || !auto || entry) return;
    let active = true;
    void loadOfferLetters(offer.url, profile).then((saved) => {
      // Tout changement d'état pour cette offre relance l'effet et désactive ce rappel.
      if (!active) return;
      const missing = !saved.letters[saved.active];
      setByKey((all) => ({
        ...all,
        [key]: { saved, writing: missing && llm ? saved.active : null, error: null },
      }));
      if (missing && llm) write(key, saved.active, llm, profile, offer, analysis);
    });
    return () => {
      active = false;
    };
  }, [key, offer, profile, analysis, llm, auto, entry, write]);

  /** Change de format ; rédige celui-ci s'il ne l'a jamais été. */
  const setFormat = useCallback(
    (next: CoverLetterFormat) => {
      if (!key || !offer || !entry || next === format) return;
      update(key, offer.url, (e) => ({ ...e, saved: { ...e.saved, active: next } }), true);
      if (!entry.saved.letters[next] && entry.writing !== next && llm && profile && analysis) {
        write(key, next, llm, profile, offer, analysis);
      }
    },
    [key, offer, entry, format, llm, profile, analysis, update, write],
  );

  const regenerate = useCallback(() => {
    if (!key || !offer || !format || !llm || !profile || !analysis) return;
    if (entry?.writing === format) return;
    write(key, format, llm, profile, offer, analysis);
  }, [key, offer, format, llm, profile, analysis, entry?.writing, write]);

  /** Retouche du texte, enregistrée peu après la dernière frappe. */
  const edit = useCallback(
    (text: string) => {
      if (!key || !offer || !format) return;
      update(
        key,
        offer.url,
        (e) => {
          const current = e.saved.letters[format];
          if (!current) return e;
          return {
            ...e,
            saved: {
              ...e.saved,
              letters: { ...e.saved.letters, [format]: { ...current, text, edited: true } },
            },
          };
        },
        false,
      );
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        update(key, offer.url, (e) => e, true);
      }, AUTOSAVE_DELAY_MS);
    },
    [key, offer, format, update],
  );

  return { state, format, setFormat, regenerate, edit };
}
