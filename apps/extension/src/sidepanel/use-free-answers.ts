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
  /** La réponse affichée est celle qui est dans le formulaire. */
  inserted: boolean;
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
  /** Ce qui est écrit dans le formulaire, par libellé. */
  written: Record<string, string>;
}

export interface FreeAnswersState {
  items: FreeAnswerItem[];
  error: string | null;
  inserting: boolean;
  /** Réponses retouchées dans le panneau, pas encore reportées dans le formulaire. */
  pending: number;
  /** Réponses dans le formulaire. */
  insertedCount: number;
}

interface Options {
  offer: JobOffer | null;
  profile: MasterProfile | null;
  analysis: JobAnalysis | null;
  llm: LlmSettings | null;
}

interface Answer {
  question: FreeQuestionField;
  value: string;
}

const EMPTY: FreeAnswersState = {
  items: [],
  error: null,
  inserting: false,
  pending: 0,
  insertedCount: 0,
};

/** Réponses à écrire : non vides et différentes de ce que contient déjà le formulaire. */
function pendingAnswers(entry: Entry): Answer[] {
  return entry.questions.flatMap((question) => {
    const value = entry.answers[question.label]?.trim() ?? '';
    return value && entry.written[question.label] !== value ? [{ question, value }] : [];
  });
}

/**
 * Réponses proposées aux questions libres du formulaire : rédigées d'elles-mêmes dès qu'elles
 * sont relevées, puis insérées dans le formulaire sans clic. L'utilisateur les relit dans le
 * panneau ; une retouche est reportée dans le formulaire au moment de l'envoi.
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

  /** Écrit des réponses dans le formulaire ; renvoie `false` si la page ne les a pas prises. */
  const write = useCallback(
    async (target: string, answers: Answer[]): Promise<boolean> => {
      if (answers.length === 0) return true;
      update(target, (e) => ({ ...e, inserting: true, error: null }));
      let count = 0;
      try {
        const tabId = await activeTabId();
        if (tabId !== null) {
          count = await fillForm(
            tabId,
            answers.map(({ question, value }) => ({
              frameId: question.frameId,
              fill: { index: question.index, kind: 'value' as const, value },
            })),
          );
        }
      } catch {
        count = 0;
      }
      update(target, (e) => {
        if (count === 0) {
          return {
            ...e,
            inserting: false,
            error: 'Le formulaire a changé : cliquez sur « Remplir à nouveau ».',
          };
        }
        const written = { ...e.written };
        for (const { question, value } of answers) written[question.label] = value;
        return { ...e, inserting: false, written };
      });
      return count > 0;
    },
    [update],
  );

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
          return { ...e, writing, answers };
        });
        if (result.ok) {
          void write(
            target,
            asked.flatMap((question, i) => {
              const value = result.value[i]?.trim() ?? '';
              return value ? [{ question, value }] : [];
            }),
          );
        }
      });
    },
    [update, write],
  );

  /**
   * Questions relevées par un remplissage : les réponses déjà connues repartent dans le
   * formulaire, les autres sont rédigées tout de suite, sans attendre de clic.
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
          // Formulaire relu : il a pu être rechargé, on réécrit tout.
          written: {},
        },
      }));
      void write(
        target,
        questions.flatMap((question) => {
          const value = known[question.label]?.trim() ?? '';
          return value ? [{ question, value }] : [];
        }),
      );
      const asked = questions.filter((q) => !(q.label in known) && !busy.includes(q.label));
      if (asked.length > 0 && llm && profile && offer?.url === target) {
        draft(target, asked, llm, profile, offer, analysis);
      }
    },
    [byUrl, llm, profile, offer, analysis, draft, write],
  );

  const state: FreeAnswersState = entry
    ? {
        items: entry.questions.map((question) => {
          const text = entry.answers[question.label] ?? '';
          return {
            question,
            text,
            writing: entry.writing.includes(question.label),
            inserted: text.trim() !== '' && entry.written[question.label] === text.trim(),
          };
        }),
        error: entry.error,
        inserting: entry.inserting,
        pending: pendingAnswers(entry).length,
        insertedCount: entry.questions.filter(
          (q) =>
            entry.written[q.label] && entry.written[q.label] === entry.answers[q.label]?.trim(),
        ).length,
      }
    : EMPTY;

  const edit = useCallback(
    (label: string, text: string) => {
      if (!url) return;
      update(url, (e) => ({ ...e, answers: { ...e.answers, [label]: text } }));
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

  /** Reporte dans le formulaire les réponses retouchées : appelé juste avant l'envoi. */
  const flush = useCallback(
    () => (url && entry ? write(url, pendingAnswers(entry)) : Promise.resolve(true)),
    [url, entry, write],
  );

  return { state, start, edit, rewrite, flush };
}
