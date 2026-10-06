import { describe, expect, it } from 'vitest';
import type { CvTextOp, MeasureText } from './cv-layout';
import { layoutLetter, letterDateLine, letterSubject } from './letter-layout';

const measure: MeasureText = (text, size) => text.length * size * 0.5;

describe('letterDateLine', () => {
  const date = new Date(2026, 9, 6);

  it('écrit la date en toutes lettres, avec la ville', () => {
    expect(letterDateLine(date, 'fr', 'Paris')).toBe('Paris, le 6 octobre 2026');
    expect(letterDateLine(date, 'en', 'Paris')).toBe('Paris, October 6, 2026');
    expect(letterDateLine(new Date(2026, 0, 1), 'fr', '')).toBe('Le 1er janvier 2026');
  });
});

describe('letterSubject', () => {
  it('suit la langue de la lettre', () => {
    expect(letterSubject('PM', 'fr')).toBe('Objet : Candidature au poste de PM');
    expect(letterSubject('PM', 'en')).toBe('Re: Application for PM');
  });
});

describe('layoutLetter', () => {
  it('place en-tête, date, objet puis les paragraphes, lignes conservées', () => {
    const layout = layoutLetter(
      {
        fullName: 'Camille Martin',
        contact: ['Paris', 'camille@mail.fr'],
        dateLine: 'Paris, le 6 octobre 2026',
        subject: 'Objet : Candidature',
        text: 'Bonjour,\n\nPremier paragraphe.\n\nCordialement,\nCamille Martin',
      },
      measure,
    );
    const texts = layout.ops.filter((op): op is CvTextOp => op.type === 'text');
    expect(texts.map((op) => op.text)).toEqual([
      'Camille Martin',
      'Paris · camille@mail.fr',
      'Paris, le 6 octobre 2026',
      'Objet : Candidature',
      'Bonjour,',
      'Premier paragraphe.',
      'Cordialement,',
      'Camille Martin',
    ]);
    const y = (text: string) => texts.find((op) => op.text === text)?.y ?? 0;
    const signature = texts.at(-1)?.y ?? 0;
    // Un espace entre deux paragraphes, aucun entre deux lignes d'un même paragraphe.
    expect(y('Premier paragraphe.') - y('Bonjour,')).toBeGreaterThan(
      signature - y('Cordialement,'),
    );
    expect(layout.pages).toBe(1);
  });

  it('passe à la page suivante pour une longue lettre', () => {
    const text = Array.from({ length: 60 }, (_, i) => `Paragraphe ${i}.`).join('\n\n');
    const layout = layoutLetter(
      { fullName: 'C', contact: [], dateLine: '', subject: '', text },
      measure,
    );
    expect(layout.pages).toBeGreaterThan(1);
  });
});
