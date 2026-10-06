import type { JobAnalysis, JobOffer, LlmSettings, MasterProfile } from '@propulsee/shared';
import { useCallback, useState } from 'react';
import type { FreeQuestionField } from '../lib/autofill';
import { activeTabId, fillForm } from '../lib/autofill-tab';
import { draftFreeAnswers } from '../lib/free-answers';

/** Question libre du formulaire et la réponse proposée, telle qu'affichée dans le panneau. */
export interface FreeAnswerItem {
  question: FreeQuestionField;
  /** `''` : pas encore rédigée, ou le profil ne permet pas d'y répondre. */
  text: string;
  writing: boolean;
}

interface Entry {
  /** Questions de la dernière lecture du formulaire. */
  questions: FreeQuestionField[];
  /** Réponses par libellé : gardées si le formulaire est relu (« Remplir à nouveau »). */
  answers: Record<string, string>;
  /** Libellés en cours de rédaction. */
  writing: string[];
  error: string | null;
  inserting: boolean;
  /** Réponses insérées dans le formulaire, et pas retouchées depuis. */
  inserted: boolean;
  /** Nombre de réponses écrites au dernier « Insérer ». */
  insertedCount: number;
}

export interface FreeAnswersState {
  items: FreeAnswerItem[];
  error: string | null;
  inserting: boolean;
  inserted: boolean;
  insertedCount: number;
}

interface Options {
  offer: JobOffer | null;
  profile: MasterProfile | null;
  analysis: JobAnalysis | null;
  llm: LlmSettings | null;
}

const EMPTY: FreeAnswersState = {
  items: [],
  error: null,
  inserting: false,
  inserted: false,
  insertedCount: 0,
};

/**
 * Réponses proposées aux questions libres du formulaire, rédigées d'elles-mêmes dès qu'elles
 * sont relevées. L'utilisateur les relit, les retouche, puis les insère toutes en un clic.
 */
export function useFreeAnswers({ offer, profile, analysis, llm }: Options) {
  const url = offer?.url ?? null;
  const [byUrl, setByUrl] = useState<Record<string, Entry>>({});
  const entry = url ? byUrl[url] : undefined;

  const update = useCallback((target: string, change: (current: Entry) => Entry) => {
    setByUrl((all) => {
      const current = all[target];
      return current ? { ...all, [target]: change(current) } : all;
    });
  }, []);

  const draft = useCallback(
    (
      target: string,
      asked: FreeQuestionField[],
      settings: LlmSettings,
      from: MasterProfile,
      to: JobOffer,
      job: JobAnalysis | null,
    ) => {
      const labels = asked.map((q) => q.label);
      update(target, (e) => ({ ...e, writing: [...e.writing, ...labels], error: null }));
      void draftFreeAnswers(settings, from, to, job, asked).then((result) => {
        update(target, (e) => {
          const writing = e.writing.filter((l) => !labels.includes(l));
          if (!result.ok) return { ...e, writing, error: result.error };
          const answers = { ...e.answers };
          labels.forEach((label, i) => (answers[label] = result.value[i] ?? ''));
          return { ...e, writing, answers, inserted: false };
        });
      });
    },
    [update],
  );

  /**
   * Questions relevées par un remplissage : on rédige tout de suite celles qui n'ont pas encore
   * de réponse, sans attendre de clic.
   */
  const start = useCallback(
    (target: string, questions: FreeQuestionField[]) => {
      const current = byUrl[target];
      const known = current?.answers ?? {};
      const busy = current?.writing ?? [];
      setByUrl((all) => ({
        ...all,
        [target]: {
          questions,
          answers: all[target]?.answers ?? {},
          writing: all[target]?.writing ?? [],
          error: null,
          inserting: false,
          inserted: false,
          insertedCount: 0,
        },
      }));
      const asked = questions.filter((q) => !(q.label in known) && !busy.includes(q.label));
      if (asked.length > 0 && llm && profile && offer?.url === target) {
        draft(target, asked, llm, profile, offer, analysis);
      }
    },
    [byUrl, llm, profile, offer, analysis, draft],
  );

  const state: FreeAnswersState = entry
    ? {
        items: entry.questions.map((question) => ({
          question,
          text: entry.answers[question.label] ?? '',
          writing: entry.writing.includes(question.label),
        })),
        error: entry.error,
        inserting: entry.inserting,
        inserted: entry.inserted,
        insertedCount: entry.insertedCount,
      }
    : EMPTY;

  const edit = useCallback(
    (label: string, text: string) => {
      if (!url) return;
      update(url, (e) => ({ ...e, answers: { ...e.answers, [label]: text }, inserted: false }));
    },
    [url, update],
  );

  /** Nouvelle proposition pour une question, ou pour toutes celles restées sans réponse. */
  const rewrite = useCallback(
    (label?: string) => {
      if (!url || !entry || !llm || !profile || !offer) return;
      const asked = entry.questions.filter(
        (q) =>
          !entry.writing.includes(q.label) && (label ? q.label === label : !entry.answers[q.label]),
      );
      if (asked.length > 0) draft(url, asked, llm, profile, offer, analysis);
    },
    [url, entry, llm, profile, offer, analysis, draft],
  );

  /** Écrit les réponses dans le formulaire ; une réponse vide laisse sa question telle quelle. */
  const insert = useCallback(() => {
    if (!url || !entry || entry.inserting) return;
    const fills = entry.questions.flatMap((q) => {
      const value = entry.answers[q.label]?.trim();
      return value
        ? [{ frameId: q.frameId, fill: { index: q.index, kind: 'value' as const, value } }]
        : [];
    });
    if (fills.length === 0) return;
    update(url, (e) => ({ ...e, inserting: true, error: null }));
    void (async () => {
      let written = 0;
      try {
        const tabId = await activeTabId();
        if (tabId !== null) written = await fillForm(tabId, fills);
      } catch {
        written = 0;
      }
      update(url, (e) =>
        written > 0
          ? { ...e, inserting: false, inserted: true, insertedCount: written }
          : {
              ...e,
              inserting: false,
              error: 'Le formulaire a changé : cliquez sur « Remplir à nouveau », puis réessayez.',
            },
      );
    })();
  }, [url, entry, update]);

  return { state, start, edit, rewrite, insert };
}
