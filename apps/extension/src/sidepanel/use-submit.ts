import { useCallback, useState } from 'react';
import { activeTabId, inspectTab, submitTab } from '../lib/autofill-tab';

export type SubmitState =
  | { status: 'idle' }
  | { status: 'sending' }
  /** Champs obligatoires vides : rien n'est parti. */
  | { status: 'missing'; fields: string[] }
  /** Le site a refusé l'envoi et signale ces champs. */
  | { status: 'rejected'; fields: string[] }
  /** Pas de confirmation visible, ou pas de bouton d'envoi : on demande à l'utilisateur. */
  | { status: 'unsure'; pressed: boolean }
  | { status: 'sent' };

const IDLE: SubmitState = { status: 'idle' };

/** Délai laissé au site pour réagir à l'envoi : page de confirmation, message d'erreur… */
const WATCH_MS = 4000;
const WATCH_STEP_MS = 500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Envoi de la candidature, au clic de l'utilisateur et jamais autrement. L'état est gardé par
 * offre : l'onglet peut quitter le site de l'offre pour celui du formulaire.
 */
export function useSubmit(url: string | null) {
  const [byUrl, setByUrl] = useState<Record<string, SubmitState>>({});
  const state = (url && byUrl[url]) || IDLE;

  const set = useCallback((target: string, next: SubmitState) => {
    setByUrl((all) => ({ ...all, [target]: next }));
  }, []);

  /** `prepare` reporte d'abord les dernières retouches ; `false` arrête l'envoi. */
  const send = useCallback(
    (prepare: () => Promise<boolean>) => {
      if (!url || state.status === 'sending') return;
      const target = url;
      set(target, { status: 'sending' });
      void (async () => {
        try {
          const tabId = await activeTabId();
          if (tabId === null || !(await prepare())) {
            set(target, IDLE);
            return;
          }
          const outcome = await submitTab(tabId);
          if (outcome.status === 'missing') {
            set(target, { status: 'missing', fields: outcome.fields });
            return;
          }
          if (outcome.status === 'no-button') {
            set(target, { status: 'unsure', pressed: false });
            return;
          }
          // Le formulaire disparaît (page de confirmation, autre page) : c'est parti.
          let invalid: string[] = [];
          for (let elapsed = 0; elapsed < WATCH_MS; elapsed += WATCH_STEP_MS) {
            await wait(WATCH_STEP_MS);
            const form = await inspectTab(tabId).catch(() => undefined);
            if (form === undefined) continue;
            if (form === null || form.filled === 0) {
              set(target, { status: 'sent' });
              return;
            }
            invalid = form.invalid;
          }
          set(
            target,
            invalid.length > 0
              ? { status: 'rejected', fields: invalid }
              : { status: 'unsure', pressed: true },
          );
        } catch {
          set(target, { status: 'unsure', pressed: false });
        }
      })();
    },
    [url, state.status, set],
  );

  /** Réponse de l'utilisateur quand la confirmation du site n'a pas été vue. */
  const confirm = useCallback(
    (sent: boolean) => {
      if (url) set(url, sent ? { status: 'sent' } : IDLE);
    },
    [url, set],
  );

  /** Nouveau remplissage : l'issue d'un envoi précédent ne vaut plus. */
  const reset = useCallback(() => {
    if (url) set(url, IDLE);
  }, [url, set]);

  return { state, send, confirm, reset };
}
