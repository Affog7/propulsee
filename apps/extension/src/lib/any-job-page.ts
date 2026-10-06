import type { JobDetection, JobDetectionPage, JobOffer } from '@propulsee/shared';
import type { RawAnyPage } from './collect-any-page';
import { JOB_DESCRIPTION_MAX_LENGTH, buildJobOffer, parseJobPosting } from './job-offer';

/**
 * Verdict du pré-filtre local, sans appel au LLM :
 * - `posting` : la page publie son offre en JSON-LD (schema.org JobPosting), lisible telle quelle ;
 * - `likely` : elle y ressemble assez pour la faire confirmer par le LLM ;
 * - `unlikely` : on ne l'envoie pas au LLM (coût, vie privée).
 */
export type PageVerdict = 'posting' | 'likely' | 'unlikely';

/** Chemins typiques d'une offre : /jobs/42, /carrieres/…, /offre-emploi-…, /stellen/… */
const JOB_PATH =
  /(^|[/_.-])(jobs?|careers?|carrieres?|emplois?|offres?|recrutement|recruitment|vacanc(y|ies)|positions?|postes?|stellen|jobboard)([/_.-]|$)/i;

/** Mots d'une fiche de poste, en français et en anglais. */
const JOB_WORDS = [
  /\bCDI\b/,
  /\bCDD\b/,
  /\balternance\b/i,
  /\btemps (plein|partiel)\b/i,
  /\bfull[- ]time\b|\bpart[- ]time\b/i,
  /\bprofil recherché|\bvotre profil\b/i,
  /\b(vos |les )?missions\b/i,
  /\bresponsabilités|\bresponsibilities\b/i,
  /\brequirements\b|\bqualifications\b|\bcompétences requises\b/i,
  /\bwhat you('|’)ll do\b|\babout the (role|job)\b/i,
  /\brémunération\b|\bsalaire\b|\bsalary\b/i,
  /\bcandidature\b|\bpostuler\b|\bapply\b/i,
  /\bans d('|’)expérience\b|\byears of experience\b/i,
];

/** Une fiche de poste fait plus que quelques lignes. */
const MIN_TEXT_LENGTH = 400;

/** Points à atteindre pour envoyer la page au LLM. */
const LIKELY_SCORE = 5;

function jobWordCount(text: string): number {
  return JOB_WORDS.filter((word) => word.test(text)).length;
}

export function prefilterPage(page: RawAnyPage): PageVerdict {
  if (parseJobPosting(page.jsonLd)) return 'posting';
  if (page.text.length < MIN_TEXT_LENGTH) return 'unlikely';
  let path = '';
  try {
    path = new URL(page.url).pathname;
  } catch {
    // Adresse illisible : on se fie au contenu.
  }
  const score =
    (JOB_PATH.test(path) ? 2 : 0) + (page.applyAction ? 2 : 0) + jobWordCount(page.text);
  return score >= LIKELY_SCORE ? 'likely' : 'unlikely';
}

/** Offre publiée en JSON-LD : sa description est plus propre que le texte de la page. */
export function postingOffer(page: RawAnyPage): JobOffer | null {
  const offer = buildJobOffer(page);
  if (offer && !offer.description && page.text) {
    offer.description = page.text.trim().slice(0, JOB_DESCRIPTION_MAX_LENGTH);
  }
  return offer;
}

/** Ce que le LLM voit de la page. */
export function detectionPage(page: RawAnyPage): JobDetectionPage {
  return { url: page.url, title: page.heading ?? page.ogTitle, text: page.text };
}

/** Offre confirmée par le LLM : son en-tête, et le texte de la page comme description. */
export function detectedOffer(
  page: RawAnyPage,
  detection: Extract<JobDetection, { isJobOffer: true }>,
): JobOffer {
  const offer: JobOffer = { url: page.url, title: detection.title };
  if (detection.company) offer.company = detection.company;
  if (detection.location) offer.location = detection.location;
  const description = page.text.trim();
  if (description) offer.description = description.slice(0, JOB_DESCRIPTION_MAX_LENGTH);
  return offer;
}
