/** Ce que le LLM renvoie d'une page inconnue : quelques champs courts, la réponse est brève. */
export const JOB_DETECTION_MAX_TOKENS = 300;

/** Au-delà, le début de la page suffit pour reconnaître une offre : on limite le coût. */
export const JOB_DETECTION_TEXT_MAX_LENGTH = 6000;

/** Page d'un site inconnu, retenue par le pré-filtre local, à faire confirmer par le LLM. */
export interface JobDetectionPage {
  url: string;
  /** Titre de l'onglet ou premier titre de la page. */
  title?: string;
  text: string;
}

export type JobDetection =
  { isJobOffer: false } | { isJobOffer: true; title: string; company?: string; location?: string };

/** Prompt qui demande au LLM si la page est une offre d'emploi et, si oui, son en-tête. */
export function buildJobDetectionPrompt(page: JobDetectionPage): string {
  return `Tu dis si une page web est une offre d'emploi précise : un seul poste, décrit sur la page.

Réponds uniquement avec un objet JSON valide, sans texte autour ni bloc de code, de cette forme :
{ "isJobOffer": true, "title": "intitulé du poste", "company": "entreprise qui recrute", "location": "ville, ou Télétravail" }

Règles :
- "isJobOffer" vaut false pour une liste de plusieurs offres, une page carrières générale, un article, une page de connexion ou toute autre page ; dans ce cas, renvoie seulement { "isJobOffer": false }.
- Recopie l'intitulé tel qu'il est écrit dans l'offre, sans le nom de l'entreprise ni du site.
- Laisse "company" ou "location" vides si la page ne les donne pas. N'invente rien.

Adresse : ${page.url}
Titre : ${page.title ?? ''}
"""
${page.text.slice(0, JOB_DETECTION_TEXT_MAX_LENGTH)}
"""`;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Lit la réponse du LLM. Tolère un bloc de code ou du texte autour du JSON ; renvoie `null`
 * si la réponse est illisible ou se dit une offre sans intitulé.
 */
export function parseJobDetectionResponse(text: string): JobDetection | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object') return null;
  const data = json as Record<string, unknown>;
  if (data.isJobOffer === false) return { isJobOffer: false };
  const title = str(data.title);
  if (data.isJobOffer !== true || !title) return null;
  const detection: JobDetection = { isJobOffer: true, title };
  const company = str(data.company);
  const location = str(data.location);
  if (company) detection.company = company;
  if (location) detection.location = location;
  return detection;
}
