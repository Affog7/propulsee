import type { RawJobPage } from './collect-job-page';

/** Page d'un site inconnu : de quoi décider localement si elle vaut d'être montrée au LLM. */
export interface RawAnyPage extends RawJobPage {
  /** Texte visible de la zone principale (`main`, `article`…), à défaut de toute la page. */
  text: string;
  /** La page a un bouton ou un lien « Postuler », « Apply »… */
  applyAction: boolean;
}

/**
 * Lit une page quelconque. Injectée dans l'onglet par `chrome.scripting.executeScript` :
 * Chrome n'en transmet que le code source, elle ne doit donc rien utiliser de l'extérieur.
 * `maxLength` borne le texte lu, pour ne pas recopier une page géante.
 */
export function collectAnyPage(maxLength: number): RawAnyPage {
  const clean = (text: string | undefined) => text?.trim() || undefined;
  const main = document.querySelector<HTMLElement>(
    'main, [role="main"], article, #content, .content',
  );
  const zone = main && main.innerText.trim().length > 200 ? main : document.body;
  const apply = /^\s*(postuler|candidater|apply|apply now|apply for this job|bewerben|postular)\b/i;
  const applyAction = Array.from(
    document.querySelectorAll<HTMLElement>('a, button, input[type="submit"]'),
  ).some((el) => apply.test(el.innerText || (el as HTMLInputElement).value || ''));

  return {
    url: location.href,
    jsonLd: Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
      (script) => script.textContent ?? '',
    ),
    heading: clean(document.querySelector<HTMLElement>('main h1, h1')?.innerText),
    ogTitle: clean(document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content),
    text: (zone?.innerText ?? '').slice(0, maxLength),
    applyAction,
  };
}
