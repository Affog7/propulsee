import {
  cvFileName,
  documentFileName,
  type ApplicationAnswers,
  type CoverLetter,
  type JobOffer,
  type MasterProfile,
  type TailoredCv,
} from '@propulsee/shared';
import { useCallback, useState } from 'react';
import {
  planAutofill,
  type AttachedFile,
  type AutofillPlan,
  type FreeQuestionField,
} from '../lib/autofill';
import { activeTabId, fillForm, inspectTab, scanForm, toBase64 } from '../lib/autofill-tab';
import { buildLetterPdf } from '../lib/cover-letter';
import { buildCvPdf } from '../lib/cv-pdf';
import { saveProfile } from '../lib/profile';
import { requestAnySiteAccess } from '../lib/site-access';

export type AutofillState =
  | { status: 'idle' }
  | { status: 'filling' }
  /** Rien à remplir sur la page : le formulaire n'est pas encore ouvert. */
  | { status: 'empty' }
  | {
      status: 'done';
      result: AutofillPlan;
      cvName: string | null;
      letterName: string | null;
      /** Déclarations obligatoires du site : cochées seulement au clic d'envoi. */
      declarations: string[];
      /** PDF effectivement joints au formulaire : gardés dans le suivi à l'envoi. */
      attached: { cv: AttachedFile | null; letter: (AttachedFile & { text: string }) | null };
    }
  | { status: 'error'; error: string };

interface Options {
  offer: JobOffer | null;
  profile: MasterProfile | null;
  /** Documents déjà prêts : joints s'ils le sont, sinon le formulaire est rempli sans eux. */
  cv: TailoredCv | null;
  letter: CoverLetter | null;
  onProfileSaved: (profile: MasterProfile) => void;
  /** Questions libres relevées : le panneau en propose les réponses. */
  onQuestions: (url: string, questions: FreeQuestionField[]) => void;
}

const IDLE: AutofillState = { status: 'idle' };

async function attach(bytes: Promise<Uint8Array>, name: string): Promise<AttachedFile> {
  return { name, base64: toBase64(await bytes) };
}

/**
 * Remplissage du formulaire de candidature ouvert dans l'onglet, en un clic. L'état est gardé
 * par offre. Rien n'est envoyé : l'utilisateur relit le formulaire et l'envoie lui-même.
 */
export function useAutofill({ offer, profile, cv, letter, onProfileSaved, onQuestions }: Options) {
  const url = offer?.url ?? null;
  const [byUrl, setByUrl] = useState<Record<string, AutofillState>>({});
  const state = (url && byUrl[url]) || IDLE;

  const set = useCallback((target: string, next: AutofillState) => {
    setByUrl((all) => ({ ...all, [target]: next }));
  }, []);

  /**
   * Remplit le formulaire. `answers` : réponses que l'utilisateur vient de donner (salaire…),
   * enregistrées dans le profil maître pour les prochaines candidatures.
   */
  const fill = useCallback(
    (answers?: Partial<ApplicationAnswers>) => {
      if (!offer || !profile || state.status === 'filling') return;
      // Avant tout `await` : Chrome n'accepte la demande d'accès que pendant le clic.
      const access = requestAnySiteAccess();
      const target = offer.url;
      const from = answers ? { ...profile, answers: { ...profile.answers, ...answers } } : profile;
      set(target, { status: 'filling' });
      if (answers) void saveProfile(from).then(onProfileSaved, () => undefined);

      void (async () => {
        const granted = await access;
        const tabId = await activeTabId();
        if (tabId === null) {
          set(target, { status: 'empty' });
          return;
        }
        const cvName = cv ? cvFileName(cv.cv.fullName, offer.company) : null;
        const letterName = letter ? documentFileName(from.fullName, 'Lettre', offer.company) : null;
        try {
          const [fields, cvFile, letterFile] = await Promise.all([
            scanForm(tabId),
            cv && cvName ? attach(buildCvPdf(cv), cvName) : null,
            letter && letterName
              ? attach(buildLetterPdf(letter, from, offer), letterName).then((file) => ({
                  ...file,
                  text: letter.text,
                }))
              : null,
          ]);
          const plan = planAutofill(fields, { profile: from, cv: cvFile, letter: letterFile });
          if (plan.fills.length + plan.missing.length + plan.questions.length === 0) {
            set(target, { status: 'empty' });
            return;
          }
          await fillForm(tabId, plan.fills);
          const form = await inspectTab(tabId).catch(() => null);
          set(target, {
            status: 'done',
            result: plan,
            cvName,
            letterName,
            declarations: form?.declarations ?? [],
            attached: {
              cv: plan.cv ? cvFile : null,
              letter: plan.letter ? letterFile : null,
            },
          });
          onQuestions(target, plan.questions);
        } catch {
          set(target, {
            status: 'error',
            error: granted
              ? 'Je ne peux pas remplir cette page. Ouvrez le formulaire du site, puis réessayez.'
              : 'Autorisez Propulsee à remplir les formulaires, puis réessayez.',
          });
        }
      })();
    },
    [offer, profile, cv, letter, state.status, set, onProfileSaved, onQuestions],
  );

  return { state, fill };
}
