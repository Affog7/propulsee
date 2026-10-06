import { emptyProfile, type CoverLetter, type MasterProfile } from '@propulsee/shared';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildLetterPdf, freshLetters, keepRecentLetters } from './cover-letter';

const profile: MasterProfile = {
  ...emptyProfile(),
  fullName: 'Camille Martin',
  location: 'Paris',
  email: 'camille@mail.fr',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

function letter(over: Partial<CoverLetter>): CoverLetter {
  return {
    format: 'short',
    lang: 'fr',
    text: 'Bonjour,\n\nTexte → avec une flèche 🚀.\n\nCamille Martin',
    why: [],
    edited: false,
    generatedAt: '2026-10-03T00:00:00.000Z',
    profileUpdatedAt: profile.updatedAt,
    ...over,
  };
}

describe('freshLetters', () => {
  it('écarte les lettres périmées sauf celles retouchées', () => {
    const fresh = freshLetters(
      {
        active: 'classic',
        letters: {
          short: letter({}),
          classic: letter({ format: 'classic', profileUpdatedAt: 'ancien' }),
          message: letter({ format: 'message', profileUpdatedAt: 'ancien', edited: true }),
        },
      },
      profile,
    );
    expect(fresh.active).toBe('classic');
    expect(Object.keys(fresh.letters).sort()).toEqual(['message', 'short']);
  });

  it('part du format court quand rien n’est enregistré', () => {
    expect(freshLetters(undefined, profile)).toEqual({ active: 'short', letters: {} });
  });
});

describe('keepRecentLetters', () => {
  it('garde les offres dont la lettre est la plus récente', () => {
    const at = (generatedAt: string) => ({
      active: 'short' as const,
      letters: { short: letter({ generatedAt }) },
    });
    const kept = keepRecentLetters(
      {
        a: at('2026-10-01T00:00:00Z'),
        b: at('2026-10-03T00:00:00Z'),
        c: at('2026-10-02T00:00:00Z'),
      },
      2,
    );
    expect(Object.keys(kept).sort()).toEqual(['b', 'c']);
  });
});

describe('buildLetterPdf', () => {
  it('produit un PDF lisible, même avec des caractères hors police', async () => {
    const bytes = await buildLetterPdf(letter({}), profile, {
      url: 'x',
      title: 'Senior Product Manager',
      company: 'Acme',
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe('Lettre · Camille Martin');
  });
});
