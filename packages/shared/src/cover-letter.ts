import { analysisDigest, profileDigest, type JobAnalysis } from './job-analysis';
import type { JobOffer } from './job-offer';
import type { MasterProfile } from './profile';
import type { CvLanguage } from './tailored-cv';

/** Formats proposés, du plus court au plus long. */
export const COVER_LETTER_FORMATS = ['short', 'classic', 'message'] as const;

export type CoverLetterFormat = (typeof COVER_LETTER_FORMATS)[number];

export const COVER_LETTER_FORMAT_LABELS: Record<CoverLetterFormat, string> = {
  short: 'Courte',
  classic: 'Classique',
  message: 'Message recruteur',
};

/** Format choisi d'office : court, il se lit en entier et convient à la plupart des sites. */
export const DEFAULT_COVER_LETTER_FORMAT: CoverLetterFormat = 'short';

export interface CoverLetter {
  format: CoverLetterFormat;
  /** Langue de l'offre, dans laquelle la lettre est écrite. */
  lang: CvLanguage;
  /** Texte complet, formule d'appel et signature comprises ; paragraphes séparés par une ligne vide. */
  text: string;
  /** Ce qui rend la lettre efficace, en quelques points courts. */
  why: string[];
  /** `true` si l'utilisateur a retouché le texte. */
  edited: boolean;
  /** Date ISO de la génération. */
  generatedAt: string;
  /** `updatedAt` du profil utilisé : un profil modifié depuis rend la lettre périmée. */
  profileUpdatedAt: string;
}

export const COVER_LETTER_MAX_TOKENS = 2048;

const OFFER_TEXT_MAX_LENGTH = 8000;
const MAX_WHY = 3;

const FORMAT_RULES: Record<CoverLetterFormat, string> = {
  short:
    'Lettre courte, 120 à 180 mots, 3 paragraphes. Formule d’appel simple (« Bonjour, » ou « Hello, »), puis le prénom et nom du candidat en signature.',
  classic:
    'Lettre classique, 250 à 330 mots, 4 paragraphes. Formule d’appel formelle (« Madame, Monsieur, » ou « Dear Hiring Team, »), formule de politesse sobre, puis le prénom et nom du candidat en signature.',
  message:
    'Message direct à un recruteur (LinkedIn ou e-mail), 60 à 100 mots, 2 paragraphes courts. Ton cordial et direct, sans formule de politesse longue, terminé par le prénom du candidat.',
};

/** Prompt qui rédige une lettre ou un message recruteur à partir du profil et de l'offre. */
export function buildCoverLetterPrompt(
  profile: MasterProfile,
  offer: JobOffer,
  analysis: JobAnalysis,
  format: CoverLetterFormat,
): string {
  const header = [offer.title, offer.company, offer.location].filter(Boolean).join(' · ');
  const expectations = analysisDigest(analysis);

  return `Tu rédiges pour un candidat ${format === 'message' ? 'un message à un recruteur' : 'une lettre de motivation'}, prête à envoyer.

Réponds uniquement avec un objet JSON valide, sans texte autour ni bloc de code, de cette forme :
{
  "lang": "fr",
  "text": "texte complet, paragraphes séparés par une ligne vide",
  "why": ["ce qui rend ce texte efficace, en quelques mots"]
}

Règles :
- ${FORMAT_RULES[format]}
- Écris dans la langue de l'offre ; "lang" vaut "fr" ou "en" selon cette langue.
- Ouvre sur l'enjeu de l'entreprise ou du poste, pas sur le candidat.
- Cite une ou deux réalisations concrètes du profil, chiffrées si le profil donne des chiffres, en lien direct avec les attentes de l'offre.
- N'invente rien : ni expérience, ni chiffre, ni compétence absents du profil. Ne prétends pas connaître l'entreprise au-delà de ce que dit l'offre.
- Pas de clichés (« passionné », « dynamique », « motivé », « je me permets »), pas de superlatifs, pas de champ à compléter entre crochets.
- Pas d'en-tête (adresse, date, objet) : uniquement le corps, de la formule d'appel à la signature.
- "why" : ${MAX_WHY} points au plus, en français, courts, adressés au candidat (ex. « Elle s'ouvre sur l'enjeu de l'entreprise »).

Offre : ${header}
Analyse de l'offre :
"""
${expectations}
"""
Texte de l'offre :
"""
${(offer.description ?? '').slice(0, OFFER_TEXT_MAX_LENGTH)}
"""

Profil du candidat (${profile.fullName || 'nom inconnu'}) :
"""
${profileDigest(profile)}
"""`;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Paragraphes nettoyés : espaces superflus retirés, une seule ligne vide entre deux. */
export function normalizeLetterText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Lit la lettre renvoyée par le LLM. Tolère un bloc de code ou du texte autour du JSON ;
 * renvoie `null` si aucun texte exploitable n'en sort.
 */
export function parseCoverLetterResponse(
  text: string,
  format: CoverLetterFormat,
  profile: MasterProfile,
  now = new Date(),
): CoverLetter | null {
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
  const body = normalizeLetterText(str(data.text));
  if (!body) return null;
  const why = Array.isArray(data.why) ? [...new Set(data.why.map(str).filter(Boolean))] : [];
  return {
    format,
    lang: data.lang === 'en' ? 'en' : 'fr',
    text: body,
    why: why.slice(0, MAX_WHY),
    edited: false,
    generatedAt: now.toISOString(),
    profileUpdatedAt: profile.updatedAt,
  };
}

/** Nombre de mots, affiché à côté du format. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
