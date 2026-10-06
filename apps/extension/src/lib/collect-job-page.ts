import type { JobSiteSelectors } from './job-sites';

/** Données brutes lues sur la page d'une offre, mises en forme par `buildJobOffer`. */
export interface RawJobPage {
  url: string;
  /** Contenu des balises `<script type="application/ld+json">` (schema.org JobPosting). */
  jsonLd: string[];
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  /** Repli quand les sélecteurs du site ne trouvent rien (mise en page modifiée). */
  heading?: string;
  ogTitle?: string;
}

/**
 * Lit la page de l'offre. Injectée dans l'onglet par `chrome.scripting.executeScript` :
 * Chrome n'en transmet que le code source, elle ne doit donc rien utiliser de l'extérieur.
 */
export function collectJobPage(selectors: JobSiteSelectors): RawJobPage {
  const textOf = (candidates: string[]): string | undefined => {
    for (const selector of candidates) {
      const el = document.querySelector<HTMLElement>(selector);
      const text = el?.innerText.trim();
      if (text) return text;
    }
    return undefined;
  };

  return {
    url: location.href,
    jsonLd: Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
      (script) => script.textContent ?? '',
    ),
    title: textOf(selectors.title),
    company: textOf(selectors.company),
    location: textOf(selectors.location),
    description: textOf(selectors.description),
    heading: textOf(['main h1', 'h1']),
    ogTitle:
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content.trim() ||
      undefined,
  };
}
