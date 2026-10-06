import {
  COVER_LETTER_MAX_TOKENS,
  DEFAULT_COVER_LETTER_FORMAT,
  buildCoverLetterPrompt,
  parseCoverLetterResponse,
  type CoverLetter,
  type CoverLetterFormat,
  type JobAnalysis,
  type JobOffer,
  type LlmSettings,
  type MasterProfile,
} from '@propulsee/shared';
import { sanitizeText } from './cv-layout';
import { layoutLetter, letterDateLine, letterSubject } from './letter-layout';
import { complete, type LlmResult } from './llm';
import { downloadPdf, renderPdf } from './pdf-render';

const STORAGE_KEY = 'coverLetters';

/** Lettres gardées : revenir sur une offre les réaffiche sans nouvel appel au LLM. */
const MAX_STORED_OFFERS = 50;

/** Lettres d'une offre : une par format déjà demandé, et le format affiché. */
export interface OfferLetters {
  active: CoverLetterFormat;
  letters: Partial<Record<CoverLetterFormat, CoverLetter>>;
}

type StoredLetters = Record<string, OfferLetters>;

async function loadAll(): Promise<StoredLetters> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as StoredLetters | undefined) ?? {};
}

/**
 * Garde les lettres encore valables pour ce profil : une lettre générée avant une modification
 * du profil est périmée, sauf si l'utilisateur l'a retouchée (on ne jette pas son travail).
 */
export function freshLetters(
  saved: OfferLetters | undefined,
  profile: MasterProfile,
): OfferLetters {
  const letters: OfferLetters['letters'] = {};
  for (const letter of Object.values(saved?.letters ?? {})) {
    if (letter.edited || letter.profileUpdatedAt === profile.updatedAt) {
      letters[letter.format] = letter;
    }
  }
  return { active: saved?.active ?? DEFAULT_COVER_LETTER_FORMAT, letters };
}

export async function loadOfferLetters(url: string, profile: MasterProfile): Promise<OfferLetters> {
  return freshLetters((await loadAll())[url], profile);
}

function lastChange(entry: OfferLetters): string {
  return (
    Object.values(entry.letters)
      .map((l) => l.generatedAt)
      .sort()
      .at(-1) ?? ''
  );
}

/** Garde les lettres des offres les plus récentes, dans la limite de `max`. */
export function keepRecentLetters(all: StoredLetters, max = MAX_STORED_OFFERS): StoredLetters {
  const entries = Object.entries(all)
    .sort(([, a], [, b]) => lastChange(b).localeCompare(lastChange(a)))
    .slice(0, max);
  return Object.fromEntries(entries);
}

export async function saveOfferLetters(url: string, entry: OfferLetters): Promise<void> {
  const all = keepRecentLetters({ ...(await loadAll()), [url]: entry });
  await chrome.storage.local.set({ [STORAGE_KEY]: all });
}

/** Demande au LLM une lettre (ou un message recruteur) au format voulu. */
export async function writeCoverLetter(
  settings: LlmSettings,
  profile: MasterProfile,
  offer: JobOffer,
  analysis: JobAnalysis,
  format: CoverLetterFormat,
  signal?: AbortSignal,
): Promise<LlmResult<CoverLetter>> {
  const result = await complete(
    settings,
    buildCoverLetterPrompt(profile, offer, analysis, format),
    { maxTokens: COVER_LETTER_MAX_TOKENS, signal },
  );
  if (!result.ok) return result;
  const letter = parseCoverLetterResponse(result.value, format, profile);
  return letter
    ? { ok: true, value: letter }
    : { ok: false, error: 'Je n’ai pas réussi à rédiger la lettre. Réessayez.' };
}

/** Génère le PDF de la lettre : en-tête du candidat, date, objet, puis le texte. */
export function buildLetterPdf(
  letter: CoverLetter,
  profile: MasterProfile,
  offer: JobOffer,
  now = new Date(),
): Promise<Uint8Array> {
  return renderPdf(
    { title: `Lettre · ${profile.fullName || offer.title}`, author: profile.fullName || undefined },
    (measure, isSupported) => {
      const clean = (text: string) => sanitizeText(text, isSupported);
      return layoutLetter(
        {
          fullName: clean(profile.fullName),
          contact: [profile.location, profile.email, profile.phone].map(clean).filter(Boolean),
          dateLine: clean(letterDateLine(now, letter.lang, profile.location)),
          subject: clean(letterSubject(offer.title, letter.lang)),
          // Les retours à la ligne comptent dans une lettre : on nettoie ligne par ligne.
          text: letter.text
            .split('\n')
            .map((line) => (line.trim() ? clean(line) : ''))
            .join('\n'),
        },
        measure,
      );
    },
  );
}

export async function downloadLetterPdf(
  letter: CoverLetter,
  profile: MasterProfile,
  offer: JobOffer,
  fileName: string,
): Promise<void> {
  downloadPdf(await buildLetterPdf(letter, profile, offer), fileName);
}
