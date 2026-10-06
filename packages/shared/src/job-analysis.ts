import type { JobOffer } from './job-offer';
import type { MasterProfile } from './profile';

/** Compétence clé demandée par l'offre. */
export interface JobSkill {
  name: string;
  /** `true` si le profil maître montre clairement cette compétence. */
  inProfile: boolean;
}

/** L'essentiel d'une offre, à lire en quelques secondes. Pas de score de compatibilité. */
export interface JobAnalysis {
  /** Une phrase : le poste et son enjeu. */
  summary: string;
  /** Missions principales, une par élément. */
  missions: string[];
  skills: JobSkill[];
  /** Attentes : expérience, diplôme, langues, contrat, lieu, télétravail… */
  expectations: string[];
  /** Date ISO de l'analyse. */
  analyzedAt: string;
}

/** Une analyse courte : quelques lignes suffisent. */
export const JOB_ANALYSIS_MAX_TOKENS = 2048;

/** Au-delà, le profil n'aide plus à repérer les compétences et alourdit le prompt. */
const PROFILE_DIGEST_MAX_LENGTH = 6000;

const MAX_MISSIONS = 5;
const MAX_SKILLS = 8;
const MAX_EXPECTATIONS = 5;

/** Ce que le LLM doit savoir du profil pour dire si une compétence y figure. */
export function profileDigest(profile: MasterProfile): string {
  const lines = [
    profile.headline,
    profile.summary,
    profile.skills.length ? `Compétences : ${profile.skills.join(', ')}` : '',
    profile.languages.length ? `Langues : ${profile.languages.join(', ')}` : '',
    ...profile.experiences.map((e) =>
      [`- ${[e.title, e.company].filter(Boolean).join(', ')}`, ...e.highlights].join(' ; '),
    ),
    ...profile.education.map((e) => `- ${[e.degree, e.school].filter(Boolean).join(', ')}`),
  ];
  return lines.filter(Boolean).join('\n').slice(0, PROFILE_DIGEST_MAX_LENGTH);
}

/** Prompt qui résume une offre en missions, compétences clés et attentes. */
export function buildJobAnalysisPrompt(offer: JobOffer, profile: MasterProfile | null): string {
  const header = [offer.title, offer.company, offer.location].filter(Boolean).join(' · ');
  const digest = profile ? profileDigest(profile) : '';
  const profileBlock = digest
    ? `

Profil du candidat, pour remplir "inProfile" :
"""
${digest}
"""`
    : '';

  return `Tu aides un candidat à comprendre une offre d'emploi en quelques secondes.

Réponds uniquement avec un objet JSON valide, sans texte autour ni bloc de code, de cette forme :
{
  "summary": "une phrase : le poste et son enjeu principal",
  "missions": ["mission principale, courte"],
  "skills": [{ "name": "compétence clé, 1 à 3 mots", "inProfile": true }],
  "expectations": ["attente concrète : années d'expérience, diplôme, langues, contrat, télétravail…"]
}

Règles :
- Écris en français, phrases courtes, sans jargon RH ; garde les noms d'outils et de technologies tels quels.
- ${MAX_MISSIONS} missions au plus, ${MAX_SKILLS} compétences au plus (les plus importantes d'abord), ${MAX_EXPECTATIONS} attentes au plus.
- N'invente rien : uniquement ce que dit l'offre. Ignore la présentation de l'entreprise et les avantages.
- "inProfile" vaut true seulement si le profil du candidat montre clairement la compétence${profile ? '' : ' ; ici, aucun profil : mets toujours false'}.

Offre : ${header}
"""
${offer.description ?? ''}
"""${profileBlock}`;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(str).filter(Boolean))].slice(0, max);
}

function skillList(value: unknown): JobSkill[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const skills: JobSkill[] = [];
  for (const item of value) {
    // Le LLM renvoie parfois une simple liste de noms.
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
    const name = record ? str(record.name) : str(item);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    skills.push({ name, inProfile: record?.inProfile === true });
  }
  return skills.slice(0, MAX_SKILLS);
}

/**
 * Lit l'analyse renvoyée par le LLM. Tolère un bloc de code ou du texte autour du JSON ;
 * renvoie `null` si rien d'exploitable n'en sort.
 */
export function parseJobAnalysisResponse(text: string, now = new Date()): JobAnalysis | null {
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
  const analysis: JobAnalysis = {
    summary: str(data.summary),
    missions: strList(data.missions, MAX_MISSIONS),
    skills: skillList(data.skills),
    expectations: strList(data.expectations, MAX_EXPECTATIONS),
    analyzedAt: now.toISOString(),
  };
  const usable = analysis.missions.length > 0 || analysis.skills.length > 0;
  return usable ? analysis : null;
}
