import type { JobOffer } from './job-offer';

/** Où en est une candidature envoyée : l'utilisateur le change d'un geste, s'il le souhaite. */
export const APPLICATION_STATUSES = ['sent', 'interview', 'rejected'] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  sent: 'Envoyée',
  interview: 'Entretien',
  rejected: 'Refus',
};

/** Fichier joint au formulaire, gardé tel quel (PDF en base64). */
export interface SentFile {
  name: string;
  base64: string;
}

/** Réponse écrite dans le formulaire, avec sa question. */
export interface SentAnswer {
  question: string;
  answer: string;
}

/**
 * Copie de ce qui est parti, enregistrée d'elle-même à l'envoi : l'offre (elles disparaissent
 * souvent), les pièces jointes, les réponses et la date. Une offre, une candidature.
 */
export interface SentApplication {
  offer: JobOffer;
  /** Date ISO de l'envoi. */
  sentAt: string;
  status: ApplicationStatus;
  cv: SentFile | null;
  letter: (SentFile & { text: string }) | null;
  /** Réponses aux questions libres du formulaire. */
  answers: SentAnswer[];
  /** Réponses sensibles confirmées à l'envoi (salaire, autorisation de travail). */
  confirmed: SentAnswer[];
  /** Déclarations du site cochées à l'envoi. */
  declarations: string[];
  /** Champs remplis par l'assistant (fichiers exceptés). */
  fields: number;
}

/** Au-delà, les plus anciennes sortent de la liste : quelques Mo au plus dans le navigateur. */
export const MAX_APPLICATIONS = 500;

/** Candidature déjà envoyée pour cette offre, s'il y en a une. */
export function findApplication(
  list: SentApplication[],
  url: string | null | undefined,
): SentApplication | undefined {
  return url ? list.find((a) => a.offer.url === url) : undefined;
}

/**
 * Ajoute une candidature en tête de liste. Un nouvel envoi pour la même offre remplace le
 * précédent mais garde son statut : un entretien déjà noté ne repart pas à « Envoyée ».
 */
export function addApplication(
  list: SentApplication[],
  sent: SentApplication,
  max = MAX_APPLICATIONS,
): SentApplication[] {
  const before = findApplication(list, sent.offer.url);
  const next = before ? { ...sent, status: before.status } : sent;
  return [next, ...list.filter((a) => a !== before)].slice(0, max);
}

export function setApplicationStatus(
  list: SentApplication[],
  url: string,
  status: ApplicationStatus,
): SentApplication[] {
  return list.map((a) => (a.offer.url === url ? { ...a, status } : a));
}

export function removeApplication(list: SentApplication[], url: string): SentApplication[] {
  return list.filter((a) => a.offer.url !== url);
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`;
}

/** « 3 envoyées · 1 entretien » : de quoi répondre à « où en suis-je ? » d'un coup d'œil. */
export function applicationsSummary(list: SentApplication[]): string {
  if (list.length === 0) return 'Aucune candidature envoyée';
  const interviews = list.filter((a) => a.status === 'interview').length;
  return [plural(list.length, 'envoyée'), interviews > 0 && plural(interviews, 'entretien')]
    .filter(Boolean)
    .join(' · ');
}

function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** « Aujourd'hui », « Hier », « 5 oct. », ou « 5 oct. 2025 » pour une autre année. */
export function sentDateLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days === 0) return 'Aujourd’hui';
  if (days === 1) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function file(value: unknown): SentFile | null {
  if (!isRecord(value) || !text(value.name) || !text(value.base64)) return null;
  return { name: text(value.name), base64: text(value.base64) };
}

function answers(value: unknown): SentAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((a) =>
    isRecord(a) && text(a.question) ? [{ question: text(a.question), answer: text(a.answer) }] : [],
  );
}

/** Relit la liste enregistrée : une entrée illisible est écartée plutôt que de tout bloquer. */
export function normalizeApplications(raw: unknown): SentApplication[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): SentApplication[] => {
    if (!isRecord(item) || !isRecord(item.offer) || !text(item.offer.url)) return [];
    const offer = item.offer as unknown as JobOffer;
    const letter = file(item.letter);
    const status = APPLICATION_STATUSES.find((s) => s === item.status) ?? 'sent';
    return [
      {
        offer: { ...offer, title: text(offer.title) },
        sentAt: text(item.sentAt),
        status,
        cv: file(item.cv),
        letter:
          letter && isRecord(item.letter) ? { ...letter, text: text(item.letter.text) } : null,
        answers: answers(item.answers),
        confirmed: answers(item.confirmed),
        declarations: Array.isArray(item.declarations)
          ? item.declarations.filter((d): d is string => typeof d === 'string')
          : [],
        fields: typeof item.fields === 'number' ? item.fields : 0,
      },
    ];
  });
}
