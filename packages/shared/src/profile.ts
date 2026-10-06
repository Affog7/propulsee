/** Poste du parcours. Les dates restent du texte libre (« 2019 », « mars 2022 »…). */
export interface ProfileExperience {
  title: string;
  company: string;
  location: string;
  start: string;
  /** Vide si inconnu, « Aujourd'hui » pour le poste actuel. */
  end: string;
  /** Réalisations et missions, une par ligne. */
  highlights: string[];
}

export interface ProfileEducation {
  degree: string;
  school: string;
  start: string;
  end: string;
}

/**
 * Profil maître : l'unique source de vérité sur le parcours de l'utilisateur, adaptée ensuite
 * à chaque offre. Un champ inconnu vaut `''` ou `[]`, jamais `undefined`, pour simplifier l'édition.
 */
export interface MasterProfile {
  fullName: string;
  /** Titre court, ex. « Product Manager · SaaS & IA ». */
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  summary: string;
  experiences: ProfileExperience[];
  education: ProfileEducation[];
  skills: string[];
  /** Langue et niveau en texte libre, ex. « Anglais (C1) ». */
  languages: string[];
  /** Date ISO de la dernière modification. */
  updatedAt: string;
}

/** Au-delà, le texte du CV est tronqué : un CV tient largement dans cette limite. */
export const MAX_CV_TEXT_LENGTH = 30_000;

/** Jetons de sortie réservés à l'extraction : un parcours détaillé dépasse les 4 096 par défaut. */
export const PROFILE_EXTRACTION_MAX_TOKENS = 8192;

export function emptyProfile(): MasterProfile {
  return {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    summary: '',
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function emptyExperience(): ProfileExperience {
  return { title: '', company: '', location: '', start: '', end: '', highlights: [] };
}

export function emptyEducation(): ProfileEducation {
  return { degree: '', school: '', start: '', end: '' };
}

/** Prompt qui transforme le texte brut d'un CV en profil JSON. */
export function buildProfileExtractionPrompt(cvText: string): string {
  const text = cvText.slice(0, MAX_CV_TEXT_LENGTH);
  return `Tu extrais le parcours d'un candidat à partir du texte brut de son CV.

Réponds uniquement avec un objet JSON valide, sans texte autour ni bloc de code, de cette forme :
{
  "fullName": "Prénom Nom",
  "headline": "titre court, ex. Product Manager · SaaS & IA",
  "email": "",
  "phone": "",
  "location": "ville, pays",
  "links": ["URL LinkedIn, GitHub, portfolio…"],
  "summary": "accroche du CV, 2 à 3 phrases",
  "experiences": [
    {
      "title": "intitulé du poste",
      "company": "entreprise",
      "location": "",
      "start": "2019",
      "end": "2022 ou Aujourd'hui",
      "highlights": ["une réalisation ou mission par élément, chiffres conservés"]
    }
  ],
  "education": [{ "degree": "diplôme", "school": "école", "start": "", "end": "2017" }],
  "skills": ["compétence courte"],
  "languages": ["Anglais (C1)"]
}

Règles :
- N'invente rien. Laisse "" ou [] quand l'information est absente.
- Garde la langue du CV et les formulations du candidat ; corrige seulement la mise en forme.
- Expériences et formations de la plus récente à la plus ancienne.
- Une compétence par élément de "skills", sans doublon.
- Si "headline" ou "summary" manquent, déduis-les fidèlement du parcours.

Texte du CV :
"""
${text}
"""`;
}

function str(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' ? value.trim() : '';
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const s = str(item);
    const key = s.toLowerCase();
    if (s && !seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

function objects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    : [];
}

/** Remet n'importe quelle valeur (réponse du LLM, stockage) dans la forme d'un `MasterProfile`. */
export function normalizeProfile(raw: unknown): MasterProfile {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    fullName: str(data.fullName),
    headline: str(data.headline),
    email: str(data.email),
    phone: str(data.phone),
    location: str(data.location),
    links: strList(data.links),
    summary: str(data.summary),
    experiences: objects(data.experiences)
      .map((e) => ({
        title: str(e.title),
        company: str(e.company),
        location: str(e.location),
        start: str(e.start),
        end: str(e.end),
        highlights: strList(e.highlights),
      }))
      .filter((e) => e.title || e.company),
    education: objects(data.education)
      .map((e) => ({
        degree: str(e.degree),
        school: str(e.school),
        start: str(e.start),
        end: str(e.end),
      }))
      .filter((e) => e.degree || e.school),
    skills: strList(data.skills),
    languages: strList(data.languages),
    updatedAt: str(data.updatedAt) || new Date(0).toISOString(),
  };
}

/**
 * Lit le profil renvoyé par le LLM. Tolère un bloc de code ou du texte autour du JSON ;
 * renvoie `null` si aucun profil exploitable n'en sort.
 */
export function parseProfileResponse(text: string): MasterProfile | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const profile = normalizeProfile(json);
  const usable = profile.fullName || profile.experiences.length > 0 || profile.education.length > 0;
  return usable ? profile : null;
}

/** Initiales affichées dans l'avatar, ex. « Camille Martin » → « CM ». */
export function profileInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
