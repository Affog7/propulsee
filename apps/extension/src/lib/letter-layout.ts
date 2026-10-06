import type { CvLanguage } from '@propulsee/shared';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  wrapText,
  type CvLayout,
  type CvOp,
  type CvFont,
  type CvTone,
  type MeasureText,
} from './cv-layout';

/** Ce qu'il faut pour mettre une lettre en page, textes déjà rendus dessinables. */
export interface LetterContent {
  fullName: string;
  /** Ville, e-mail, téléphone… */
  contact: string[];
  /** Ex. « Paris, le 6 octobre 2026 ». */
  dateLine: string;
  /** Ex. « Objet : Candidature au poste de Senior Product Manager ». */
  subject: string;
  /** Paragraphes séparés par une ligne vide. */
  text: string;
}

const MARGIN_X = 64;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;

interface TextStyle {
  size: number;
  lineHeight: number;
  font: CvFont;
  tone: CvTone;
}

const NAME: TextStyle = { size: 15, lineHeight: 20, font: 'bold', tone: 'ink' };
const CONTACT: TextStyle = { size: 8.5, lineHeight: 12, font: 'regular', tone: 'muted' };
const META: TextStyle = { size: 9.5, lineHeight: 14, font: 'regular', tone: 'muted' };
const SUBJECT: TextStyle = { size: 10.5, lineHeight: 15, font: 'bold', tone: 'ink' };
const BODY: TextStyle = { size: 10.5, lineHeight: 16, font: 'regular', tone: 'body' };

const MONTHS: Record<CvLanguage, string[]> = {
  fr: [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

/** « Paris, le 6 octobre 2026 » ou « Paris, October 6, 2026 », sans dépendre de la locale. */
export function letterDateLine(date: Date, lang: CvLanguage, city: string): string {
  const month = MONTHS[lang][date.getMonth()] ?? '';
  const day = date.getDate();
  const formatted =
    lang === 'en'
      ? `${month} ${day}, ${date.getFullYear()}`
      : `${day === 1 ? '1er' : day} ${month} ${date.getFullYear()}`;
  if (!city) return lang === 'en' ? formatted : `Le ${formatted}`;
  return lang === 'en' ? `${city}, ${formatted}` : `${city}, le ${formatted}`;
}

/** Ligne d'objet de la lettre. */
export function letterSubject(jobTitle: string, lang: CvLanguage): string {
  return lang === 'en'
    ? `Re: Application for ${jobTitle}`
    : `Objet : Candidature au poste de ${jobTitle}`;
}

/** Place la lettre sur des pages A4 : en-tête, date, objet, puis le texte. */
export function layoutLetter(letter: LetterContent, measure: MeasureText): CvLayout {
  const ops: CvOp[] = [];
  let page = 0;
  let y = MARGIN_TOP;

  function line(text: string, style: TextStyle) {
    if (y + style.lineHeight > PAGE_HEIGHT - MARGIN_BOTTOM && y > MARGIN_TOP) {
      page++;
      y = MARGIN_TOP;
    }
    ops.push({ type: 'text', page, x: MARGIN_X, y: y + style.lineHeight * 0.75, text, ...style });
    y += style.lineHeight;
  }

  function paragraph(text: string, style: TextStyle) {
    for (const l of wrapText(text, CONTENT_WIDTH, (t) => measure(t, style.size, style.font))) {
      line(l, style);
    }
  }

  if (letter.fullName) line(letter.fullName, NAME);
  if (letter.contact.length) paragraph(letter.contact.join(' · '), CONTACT);
  ops.push({ type: 'rule', page, x: MARGIN_X, y: y + 8, width: CONTENT_WIDTH });
  y += 34;

  if (letter.dateLine) paragraph(letter.dateLine, META);
  if (letter.subject) {
    y += 4;
    paragraph(letter.subject, SUBJECT);
  }
  y += 22;

  letter.text.split(/\n\s*\n/).forEach((block, i) => {
    if (i > 0) y += 9;
    for (const l of block.split('\n')) paragraph(l, BODY);
  });

  return { pages: page + 1, ops };
}
