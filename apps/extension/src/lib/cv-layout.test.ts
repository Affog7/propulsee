import { emptyProfile, type CvContent } from '@propulsee/shared';
import { describe, expect, it } from 'vitest';
import {
  PAGE_HEIGHT,
  layoutCv,
  sanitizeCv,
  sanitizeText,
  wrapText,
  type CvTextOp,
  type MeasureText,
} from './cv-layout';

/** Police à chasse fixe : un demi-corps par caractère. */
const measure: MeasureText = (text, size) => text.length * size * 0.5;

/** Latin-1 seulement, comme une police standard sans flèches ni emoji. */
const latin1 = (code: number) => code < 256 || code === 0x2019 || code === 0x2013;

const cv: CvContent = {
  ...emptyProfile(),
  fullName: 'Camille Martin',
  headline: 'Product Manager · SaaS & IA',
  email: 'camille@mail.fr',
  links: ['https://www.linkedin.com/in/camille/'],
  summary: 'Product Manager SaaS et IA.',
  experiences: [
    {
      title: 'Lead PM',
      company: 'Orbis',
      location: 'Paris',
      start: '2022',
      end: 'Aujourd’hui',
      highlights: ['Onboarding : activation +18 %'],
    },
  ],
  skills: ['IA appliquée', 'SQL'],
  languages: ['Anglais (C1)'],
};

function texts(ops: ReturnType<typeof layoutCv>['ops']): CvTextOp[] {
  return ops.filter((op): op is CvTextOp => op.type === 'text');
}

describe('wrapText', () => {
  const width = (t: string) => t.length;

  it('passe à la ligne entre les mots', () => {
    expect(wrapText('un deux trois quatre', 9, width)).toEqual(['un deux', 'trois', 'quatre']);
  });

  it('coupe un mot plus long que la ligne', () => {
    expect(wrapText('abcdefghij', 4, width)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('ignore les espaces superflus', () => {
    expect(wrapText('  a   b ', 10, width)).toEqual(['a b']);
    expect(wrapText('', 10, width)).toEqual([]);
  });
});

describe('sanitizeText', () => {
  it('remplace ce que la police ne sait pas dessiner', () => {
    expect(sanitizeText('Croissance → x2, ≥ 5 ans ✓', latin1)).toBe('Croissance -> x2, >= 5 ans');
    expect(sanitizeText('Prix : 5 €', (c) => c !== 0x202f)).toBe('Prix : 5 €');
  });

  it('garde les accents et retire seulement l’accent qui manque', () => {
    expect(sanitizeText('Élodie, Paris – Lyon', latin1)).toBe('Élodie, Paris – Lyon');
    expect(sanitizeText('Ștefan Łódź', latin1)).toBe('Stefan ódz');
  });

  it('remplace les retours à la ligne par des espaces', () => {
    expect(sanitizeText('a\nb\tc', latin1)).toBe('a b c');
  });

  it('nettoie tout le CV et retire les éléments devenus vides', () => {
    const clean = sanitizeCv({ ...cv, skills: ['🚀', 'SQL'] }, latin1);
    expect(clean.skills).toEqual(['SQL']);
    expect(clean.experiences[0]?.end).toBe('Aujourd’hui');
  });
});

describe('layoutCv', () => {
  it('place nom, titre, contact puis les sections dans l’ordre', () => {
    const layout = layoutCv(cv, 'fr', measure);
    const lines = texts(layout.ops).map((op) => op.text);
    expect(layout.pages).toBe(1);
    expect(lines.slice(0, 3)).toEqual([
      'Camille Martin',
      'Product Manager · SaaS & IA',
      'camille@mail.fr · linkedin.com/in/camille',
    ]);
    const order = ['PROFIL', 'EXPÉRIENCE', 'COMPÉTENCES', 'LANGUES'].map((t) => lines.indexOf(t));
    expect(order.every((i, k) => i > 0 && (k === 0 || i > (order[k - 1] ?? 0)))).toBe(true);
    expect(lines).toContain('Lead PM — Orbis');
    expect(lines).toContain('2022 – Aujourd’hui · Paris');
    expect(lines).toContain('IA appliquée · SQL');
    expect(layout.ops.filter((op) => op.type === 'rule')).toHaveLength(4);
  });

  it('titre les sections dans la langue du CV et saute les sections vides', () => {
    const lines = texts(layoutCv({ ...cv, languages: [] }, 'en', measure).ops).map((o) => o.text);
    expect(lines).toContain('EXPERIENCE');
    expect(lines).not.toContain('LANGUAGES');
  });

  it('aligne les dates à droite de la ligne du poste', () => {
    const ops = texts(layoutCv(cv, 'fr', measure).ops);
    const row = ops.find((op) => op.text === 'Lead PM — Orbis');
    const date = ops.find((op) => op.text === '2022 – Aujourd’hui · Paris');
    expect(date?.y).toBe(row?.y);
    expect((date?.x ?? 0) + measure(date?.text ?? '', date?.size ?? 0, 'regular')).toBeCloseTo(
      595.28 - 52,
    );
  });

  it('passe à la page suivante sans dépasser la marge du bas', () => {
    const long: CvContent = {
      ...cv,
      experiences: Array.from({ length: 12 }, (_, i) => ({
        ...cv.experiences[0]!,
        company: `Entreprise ${i}`,
        highlights: Array.from({ length: 5 }, (_, j) => `Réalisation ${j} chez ${i}`),
      })),
    };
    const layout = layoutCv(long, 'fr', measure);
    expect(layout.pages).toBeGreaterThan(1);
    for (const op of texts(layout.ops)) {
      expect(op.y).toBeLessThanOrEqual(PAGE_HEIGHT - 50);
      expect(op.page).toBeLessThan(layout.pages);
    }
    // Un poste n'est jamais séparé de sa première réalisation.
    for (const op of texts(layout.ops).filter((o) => o.text.startsWith('Lead PM'))) {
      const next = texts(layout.ops).find(
        (o) => o.text === '•' && o.y > op.y && o.page === op.page,
      );
      expect(next).toBeDefined();
    }
  });
});
