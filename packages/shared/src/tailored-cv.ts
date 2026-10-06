import type { JobAnalysis } from './job-analysis';
import type { JobOffer } from './job-offer';
import type { MasterProfile, ProfileExperience } from './profile';

/** Contenu d'un CV : le profil maître sans ses métadonnées. */
export type CvContent = Omit<MasterProfile, 'updatedAt'>;

/** Langue des titres de section du CV (celle du profil). */
export type CvLanguage = 'fr' | 'en';

export interface CvChange {
  kind: 'summary' | 'experience' | 'skills';
  /** Ex. « Accroche adaptée », « Nuvia mis en avant ». */
  title: string;
  /** Pourquoi, en une phrase. */
  detail: string;
  /** Texte d'origine, affiché barré (accroche). */
  before?: string;
  /** Pour `experience` : position de l'expérience dans `cv.experiences`. */
  experienceIndex?: number;
}

/**
 * CV adapté à une offre. Seule l'accroche est réécrite : expériences, réalisations et
 * compétences sont choisies et réordonnées dans le profil maître, jamais inventées.
 */
export interface TailoredCv {
  cv: CvContent;
  lang: CvLanguage;
  changes: CvChange[];
  /** Date ISO de la génération. */
  generatedAt: string;
  /** `updatedAt` du profil utilisé : un profil modifié depuis rend le CV périmé. */
  profileUpdatedAt: string;
}

/** Une sélection d'indices et une accroche : la réponse reste courte. */
export const TAILORED_CV_MAX_TOKENS = 2048;

/** L'offre complète aide à reprendre ses mots-clés ; au-delà, elle n'apporte plus rien. */
const OFFER_TEXT_MAX_LENGTH = 8000;

export type CvSection = 'summary' | 'experience' | 'skills' | 'education' | 'languages';

/** Titres des sections du CV, dans sa langue. */
export const CV_SECTION_TITLES: Record<CvLanguage, Record<CvSection, string>> = {
  fr: {
    summary: 'Profil',
    experience: 'Expérience',
    skills: 'Compétences',
    education: 'Formation',
    languages: 'Langues',
  },
  en: {
    summary: 'Profile',
    experience: 'Experience',
    skills: 'Skills',
    education: 'Education',
    languages: 'Languages',
  },
};

/** Profil numéroté : le LLM répond par indices, ce qui l'empêche d'inventer une ligne. */
function numberedProfile(profile: MasterProfile): string {
  const experiences = profile.experiences.map((e, i) => {
    const dates = [e.start, e.end].filter(Boolean).join(' – ');
    const head = `[${i}] ${[e.title, e.company].filter(Boolean).join(' — ')}${dates ? ` (${dates})` : ''}`;
    return [head, ...e.highlights.map((h, j) => `    ${j}. ${h}`)].join('\n');
  });
  return [
    `Titre : ${profile.headline}`,
    `Accroche actuelle : ${profile.summary || '(aucune)'}`,
    '',
    'Expériences :',
    ...experiences,
    '',
    'Compétences :',
    profile.skills.map((s, i) => `[${i}] ${s}`).join(', '),
    '',
    `Formation : ${profile.education.map((e) => [e.degree, e.school].filter(Boolean).join(', ')).join(' ; ')}`,
    `Langues : ${profile.languages.join(', ')}`,
  ].join('\n');
}

function analysisDigest(analysis: JobAnalysis): string {
  return [
    analysis.summary,
    analysis.missions.length ? `Missions : ${analysis.missions.join(' ; ')}` : '',
    analysis.skills.length
      ? `Compétences clés : ${analysis.skills.map((s) => s.name).join(', ')}`
      : '',
    analysis.expectations.length ? `Attentes : ${analysis.expectations.join(' ; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Prompt qui adapte le profil maître à une offre analysée. */
export function buildTailoredCvPrompt(
  profile: MasterProfile,
  offer: JobOffer,
  analysis: JobAnalysis,
): string {
  const header = [offer.title, offer.company, offer.location].filter(Boolean).join(' · ');
  return `Tu adaptes le CV d'un candidat à une offre d'emploi, sans jamais rien inventer.

Réponds uniquement avec un objet JSON valide, sans texte autour ni bloc de code, de cette forme :
{
  "lang": "fr",
  "summary": "accroche réécrite pour cette offre, 2 à 3 phrases",
  "summaryReason": "pourquoi cette accroche, une phrase",
  "experiences": [{ "index": 0, "highlights": [2, 0], "reason": "pourquoi cet ordre ou ce tri, une phrase" }],
  "skills": [3, 0, 5],
  "skillsReason": "pourquoi cet ordre, une phrase"
}

Règles :
- "lang" : "fr" si le profil est rédigé en français, "en" s'il est en anglais.
- "summary" : dans la langue du profil, à la première personne implicite (pas de « je »), sans superlatifs. Mets en avant ce que l'offre recherche, en ne citant que des faits présents dans le profil.
- "experiences" : une entrée par expérience du profil, "index" étant son numéro. "highlights" liste les numéros des réalisations à garder, les plus pertinentes pour l'offre d'abord. Garde au moins une réalisation par expérience qui en a ; retire celles qui n'apportent rien pour ce poste.
- "skills" : numéros des compétences du profil, les plus demandées par l'offre d'abord ; retire celles qui sont hors sujet.
- N'ajoute aucune réalisation ni compétence : uniquement des numéros du profil.
- "summaryReason", "reason" et "skillsReason" : en français, courtes, adressées au candidat (« L'offre demande… »). Laisse "reason" vide si l'expérience n'a pas changé.

Offre : ${header}
Analyse de l'offre :
"""
${analysisDigest(analysis)}
"""
Texte de l'offre :
"""
${(offer.description ?? '').slice(0, OFFER_TEXT_MAX_LENGTH)}
"""

Profil du candidat :
"""
${numberedProfile(profile)}
"""`;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Indices valides et sans doublon. Le LLM renvoie parfois le texte au lieu du numéro :
 * on le retrouve dans `items`.
 */
function pickIndices(value: unknown, items: string[]): number[] | null {
  if (!Array.isArray(value)) return null;
  const lower = items.map((item) => item.toLowerCase());
  const picked: number[] = [];
  for (const raw of value) {
    const index =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? lower.indexOf(raw.trim().toLowerCase())
          : -1;
    if (Number.isInteger(index) && index >= 0 && index < items.length && !picked.includes(index)) {
      picked.push(index);
    }
  }
  return picked;
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/** `true` si `kept` ne garde pas l'ordre relatif de `original`. */
function isReordered(original: string[], kept: string[]): boolean {
  const positions = kept.map((item) => original.indexOf(item));
  return positions.some((p, i) => i > 0 && p < (positions[i - 1] ?? 0));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

function sentence(...parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

function experienceName(e: ProfileExperience): string {
  return e.company || e.title;
}

/**
 * Lit la sélection renvoyée par le LLM et construit le CV adapté à partir du profil.
 * Tolère un bloc de code ou du texte autour du JSON ; renvoie `null` si rien d'exploitable.
 */
export function parseTailoredCvResponse(
  text: string,
  profile: MasterProfile,
  now = new Date(),
): TailoredCv | null {
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
  if (!('summary' in data) && !('experiences' in data) && !('skills' in data)) return null;

  const { updatedAt, ...base } = profile;
  const lang: CvLanguage = data.lang === 'en' ? 'en' : 'fr';
  const changes: CvChange[] = [];

  const summary = str(data.summary) || profile.summary;
  if (summary !== profile.summary) {
    changes.push({
      kind: 'summary',
      title: profile.summary ? 'Accroche adaptée' : 'Accroche écrite',
      detail: str(data.summaryReason) || 'Elle met en avant ce que l’offre recherche.',
      ...(profile.summary ? { before: profile.summary } : {}),
    });
  }

  const entries = Array.isArray(data.experiences)
    ? data.experiences.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    : [];
  const experiences = profile.experiences.map((experience, i) => {
    const entry = entries.find((e) => Number(e.index) === i);
    const original = experience.highlights;
    const indices = entry ? pickIndices(entry.highlights, original) : null;
    // Une expérience qui avait des réalisations en garde au moins une.
    if (!indices || (indices.length === 0 && original.length > 0)) return experience;
    const highlights = indices.map((j) => original[j] ?? '');
    if (!sameList(highlights, original)) {
      const removed = original.length - highlights.length;
      changes.push({
        kind: 'experience',
        title: `${experienceName(experience)} ${isReordered(original, highlights) ? 'mis en avant' : 'raccourci'}`,
        detail: sentence(
          str(entry?.reason),
          removed > 0 ? `${plural(highlights.length, 'ligne')} au lieu de ${original.length}.` : '',
        ),
        experienceIndex: i,
      });
    }
    return { ...experience, highlights };
  });

  const skillIndices = pickIndices(data.skills, profile.skills);
  const skills =
    skillIndices && skillIndices.length > 0
      ? skillIndices.map((i) => profile.skills[i] ?? '')
      : profile.skills;
  if (!sameList(skills, profile.skills)) {
    const removed = profile.skills.length - skills.length;
    changes.push({
      kind: 'skills',
      title: isReordered(profile.skills, skills) ? 'Compétences réordonnées' : 'Compétences triées',
      detail: sentence(
        str(data.skillsReason),
        removed > 0
          ? `${plural(removed, 'compétence')} hors sujet ${removed > 1 ? 'retirées' : 'retirée'}.`
          : '',
      ),
    });
  }

  return {
    cv: { ...base, summary, experiences, skills },
    lang,
    changes,
    generatedAt: now.toISOString(),
    profileUpdatedAt: updatedAt,
  };
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Nom du PDF, ex. « Camille-Martin-CV-Acme.pdf ». */
export function cvFileName(fullName: string, company?: string): string {
  return [slug(fullName), 'CV', slug(company ?? '')].filter(Boolean).join('-') + '.pdf';
}
