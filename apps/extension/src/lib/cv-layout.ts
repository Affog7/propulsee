import { CV_SECTION_TITLES, type CvContent, type CvLanguage } from '@propulsee/shared';

/** Mise en page du CV, indépendante de la bibliothèque PDF pour rester testable. */

export type CvFont = 'regular' | 'bold';
export type CvTone = 'ink' | 'body' | 'muted' | 'accent';

export interface CvTextOp {
  type: 'text';
  page: number;
  x: number;
  /** Ligne de base, mesurée depuis le haut de la page. */
  y: number;
  text: string;
  size: number;
  font: CvFont;
  tone: CvTone;
}

/** Filet horizontal sous un titre de section. */
export interface CvRuleOp {
  type: 'rule';
  page: number;
  x: number;
  y: number;
  width: number;
}

export type CvOp = CvTextOp | CvRuleOp;

export interface CvLayout {
  pages: number;
  ops: CvOp[];
}

/** Largeur d'un texte, en points. */
export type MeasureText = (text: string, size: number, font: CvFont) => number;

/** A4 en points. */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
const MARGIN_X = 52;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;
const BULLET_INDENT = 11;

interface TextStyle {
  size: number;
  lineHeight: number;
  font: CvFont;
  tone: CvTone;
}

const NAME: TextStyle = { size: 22, lineHeight: 27, font: 'bold', tone: 'ink' };
const HEADLINE: TextStyle = { size: 11.5, lineHeight: 16, font: 'regular', tone: 'accent' };
const CONTACT: TextStyle = { size: 8.5, lineHeight: 12, font: 'regular', tone: 'muted' };
const HEADING: TextStyle = { size: 8.5, lineHeight: 12, font: 'bold', tone: 'accent' };
const BODY: TextStyle = { size: 9.8, lineHeight: 13.8, font: 'regular', tone: 'body' };
const ROW: TextStyle = { size: 10.3, lineHeight: 14.5, font: 'bold', tone: 'ink' };
const DATES: TextStyle = { size: 8.5, lineHeight: 14.5, font: 'regular', tone: 'muted' };

const SEPARATOR = ' · ';

/** Découpe `text` en lignes de largeur `width` au plus ; coupe un mot trop long (URL). */
export function wrapText(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    while (measure(line) > width && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && measure(line.slice(0, cut)) > width) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Caractères qu'une police standard ne sait pas dessiner, remplacés par un équivalent. */
const REPLACEMENTS: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '⇒': '=>',
  '≥': '>=',
  '≤': '<=',
  '−': '-',
  '‐': '-',
  '‑': '-',
  '′': '’',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
};

/**
 * Rend `text` dessinable par la police (`isSupported` reçoit un point de code) :
 * équivalent connu, sinon lettre sans accent, sinon le caractère est retiré.
 */
export function sanitizeText(text: string, isSupported: (codePoint: number) => boolean): string {
  let out = '';
  for (const char of text.replace(/\s/g, (s) => (s in REPLACEMENTS ? s : ' '))) {
    const code = char.codePointAt(0) ?? 0;
    if (isSupported(code)) {
      out += char;
      continue;
    }
    const replacement = REPLACEMENTS[char];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base && [...base].every((c) => isSupported(c.codePointAt(0) ?? 0))) out += base;
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

/** Applique `sanitizeText` à tous les textes du CV. */
export function sanitizeCv(cv: CvContent, isSupported: (codePoint: number) => boolean): CvContent {
  const clean = (text: string) => sanitizeText(text, isSupported);
  const list = (items: string[]) => items.map(clean).filter(Boolean);
  return {
    fullName: clean(cv.fullName),
    headline: clean(cv.headline),
    email: clean(cv.email),
    phone: clean(cv.phone),
    location: clean(cv.location),
    links: list(cv.links),
    summary: clean(cv.summary),
    experiences: cv.experiences.map((e) => ({
      title: clean(e.title),
      company: clean(e.company),
      location: clean(e.location),
      start: clean(e.start),
      end: clean(e.end),
      highlights: list(e.highlights),
    })),
    education: cv.education.map((e) => ({
      degree: clean(e.degree),
      school: clean(e.school),
      start: clean(e.start),
      end: clean(e.end),
    })),
    skills: list(cv.skills),
    languages: list(cv.languages),
  };
}

function dateRange(start: string, end: string): string {
  return [start, end].filter(Boolean).join(' – ');
}

/** Lien affiché sans protocole ni « www. », comme sur un CV papier. */
export function displayLink(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

/** Place chaque ligne du CV sur des pages A4, en évitant les titres orphelins en bas de page. */
export function layoutCv(cv: CvContent, lang: CvLanguage, measure: MeasureText): CvLayout {
  const titles = CV_SECTION_TITLES[lang];
  const ops: CvOp[] = [];
  let page = 0;
  let y = MARGIN_TOP;

  function ensure(height: number) {
    if (y + height > PAGE_HEIGHT - MARGIN_BOTTOM && y > MARGIN_TOP) {
      page++;
      y = MARGIN_TOP;
    }
  }

  function line(text: string, style: TextStyle, x = MARGIN_X) {
    ensure(style.lineHeight);
    // Ligne de base aux trois quarts de la hauteur de ligne.
    ops.push({ type: 'text', page, x, y: y + style.lineHeight * 0.75, text, ...style });
    y += style.lineHeight;
  }

  function paragraph(text: string, style: TextStyle, x = MARGIN_X, width = CONTENT_WIDTH) {
    for (const l of wrapText(text, width, (t) => measure(t, style.size, style.font))) {
      line(l, style, x);
    }
  }

  function heading(title: string) {
    y += 12;
    // Le titre ne reste pas seul en bas de page : il emmène au moins deux lignes.
    ensure(HEADING.lineHeight + 4 + 2 * BODY.lineHeight);
    line(title.toUpperCase(), HEADING);
    ops.push({ type: 'rule', page, x: MARGIN_X, y: y + 1, width: CONTENT_WIDTH });
    y += 6;
  }

  /** Ligne « Poste — Entreprise » avec les dates alignées à droite. */
  function row(left: string, right: string, keepWith: number) {
    const rightWidth = right ? measure(right, DATES.size, DATES.font) : 0;
    const leftWidth = CONTENT_WIDTH - (rightWidth ? rightWidth + 12 : 0);
    const lines = wrapText(left, leftWidth, (t) => measure(t, ROW.size, ROW.font));
    ensure(lines.length * ROW.lineHeight + keepWith);
    if (right) {
      const baseline = y + ROW.lineHeight * 0.75;
      ops.push({
        type: 'text',
        page,
        x: MARGIN_X + CONTENT_WIDTH - rightWidth,
        y: baseline,
        text: right,
        ...DATES,
      });
    }
    for (const l of lines) line(l, ROW);
  }

  if (cv.fullName) line(cv.fullName, NAME);
  if (cv.headline) paragraph(cv.headline, HEADLINE);
  const contact = [cv.location, cv.email, cv.phone, ...cv.links.map(displayLink)].filter(Boolean);
  if (contact.length) {
    y += 2;
    paragraph(contact.join(SEPARATOR), CONTACT);
  }

  if (cv.summary) {
    heading(titles.summary);
    paragraph(cv.summary, BODY);
  }

  if (cv.experiences.length) {
    heading(titles.experience);
    cv.experiences.forEach((e, i) => {
      if (i > 0) y += 7;
      const right = [dateRange(e.start, e.end), e.location].filter(Boolean).join(SEPARATOR);
      row(
        [e.title, e.company].filter(Boolean).join(' — '),
        right,
        e.highlights.length ? BODY.lineHeight : 0,
      );
      for (const highlight of e.highlights) {
        const lines = wrapText(highlight, CONTENT_WIDTH - BULLET_INDENT, (t) =>
          measure(t, BODY.size, BODY.font),
        );
        lines.forEach((l, j) => {
          if (j === 0) {
            ensure(BODY.lineHeight);
            ops.push({
              type: 'text',
              page,
              x: MARGIN_X + 2,
              y: y + BODY.lineHeight * 0.75,
              text: '•',
              ...BODY,
              tone: 'accent',
            });
          }
          line(l, BODY, MARGIN_X + BULLET_INDENT);
        });
      }
    });
  }

  if (cv.skills.length) {
    heading(titles.skills);
    paragraph(cv.skills.join(SEPARATOR), BODY);
  }

  if (cv.education.length) {
    heading(titles.education);
    for (const e of cv.education) {
      row([e.degree, e.school].filter(Boolean).join(' — '), dateRange(e.start, e.end), 0);
    }
  }

  if (cv.languages.length) {
    heading(titles.languages);
    paragraph(cv.languages.join(SEPARATOR), BODY);
  }

  return { pages: page + 1, ops };
}
