import { normalizeLetterText } from './cover-letter';
import { analysisDigest, profileDigest, type JobAnalysis } from './job-analysis';
import type { JobOffer } from './job-offer';
import type { MasterProfile } from './profile';

/** Question libre d'un formulaire de candidature (« Pourquoi nous rejoindre ? »…). */
export interface FreeQuestion {
  label: string;
  /** Nombre maximal de caractères accepté par le champ, `0` s'il n'y en a pas. */
  maxLength: number;
}

/** Plusieurs réponses courtes en un seul appel. */
export const FREE_ANSWERS_MAX_TOKENS = 3072;

const OFFER_TEXT_MAX_LENGTH = 6000;

/** Longueur visée sans limite du site : une réponse se lit en quelques secondes. */
const DEFAULT_WORDS = '40 à 110 mots';

function lengthRule(question: FreeQuestion): string {
  if (!question.maxLength) return DEFAULT_WORDS;
  // On vise sous la limite : le texte est coupé proprement s'il la dépasse quand même.
  return `${Math.floor(question.maxLength * 0.85)} caractères au plus`;
}

/** Prompt qui propose une réponse à chaque question libre, dans l'ordre. */
export function buildFreeAnswersPrompt(
  profile: MasterProfile,
  offer: JobOffer,
  analysis: JobAnalysis | null,
  questions: FreeQuestion[],
): string {
  const header = [offer.title, offer.company, offer.location].filter(Boolean).join(' · ');
  const list = questions.map((q, i) => `${i + 1}. ${q.label} (${lengthRule(q)})`).join('\n');
  const analysisBlock = analysis
    ? `
Analyse de l'offre :
"""
${analysisDigest(analysis)}
"""`
    : '';

  return `Tu réponds, à la place d'un candidat, aux questions libres du formulaire de candidature d'une offre d'emploi. Il relira et corrigera avant d'envoyer.

Réponds uniquement avec un objet JSON valide, sans texte autour ni bloc de code, de cette forme :
{
  "answers": ["réponse à la question 1", "réponse à la question 2"]
}

Règles :
- Exactement ${questions.length} réponse${questions.length > 1 ? 's' : ''}, dans l'ordre des questions.
- Chaque réponse est écrite dans la langue de sa question, à la première personne, ton sobre et direct.
- Respecte la longueur indiquée entre parenthèses après chaque question.
- Va droit au but : la première phrase répond à la question. Appuie-toi sur un fait précis du profil (réalisation, chiffre, outil) en lien avec l'offre.
- N'invente rien : ni expérience, ni chiffre, ni compétence absents du profil. Ne prétends pas connaître l'entreprise au-delà de ce que dit l'offre.
- Si le profil ne permet pas de répondre (disponibilité, préavis, comment le candidat a connu l'offre, références…), mets une chaîne vide : le candidat répondra lui-même.
- Texte brut : pas de markdown, pas de liste à puces, pas de formule de politesse ni de signature, pas de champ à compléter entre crochets.
- Pas de clichés (« passionné », « dynamique », « motivé »), pas de superlatifs.

Offre : ${header}${analysisBlock}
Texte de l'offre :
"""
${(offer.description ?? '').slice(0, OFFER_TEXT_MAX_LENGTH)}
"""

Profil du candidat (${profile.fullName || 'nom inconnu'}) :
"""
${profileDigest(profile)}
"""

Questions du formulaire :
${list}`;
}

/**
 * Ramène une réponse sous la limite du champ : coupée après la dernière phrase complète qui
 * tient, sinon au dernier mot. Un site tronquerait au caractère près, au milieu d'un mot.
 */
export function fitAnswer(text: string, maxLength: number): string {
  if (!maxLength || text.length <= maxLength) return text;
  const head = text.slice(0, maxLength);
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (sentence > maxLength / 2) return head.slice(0, sentence + 1).trim();
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head).replace(/[\s,;:–-]+$/, '');
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Lit les réponses renvoyées par le LLM, alignées sur les questions : `''` pour une question
 * sans réponse. Tolère un bloc de code ou du texte autour du JSON ; `null` s'il est illisible.
 */
export function parseFreeAnswersResponse(text: string, questions: FreeQuestion[]): string[] | null {
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
  const answers = (json as Record<string, unknown>).answers;
  if (!Array.isArray(answers)) return null;
  return questions.map((q, i) =>
    fitAnswer(normalizeLetterText(str(answers[i])).replace(/^[-•*]\s+/gm, ''), q.maxLength),
  );
}
