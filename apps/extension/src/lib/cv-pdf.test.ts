import type { TailoredCv } from '@propulsee/shared';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildCvPdf } from './cv-pdf';

const tailored: TailoredCv = {
  cv: {
    fullName: 'Élodie Brûlé',
    headline: 'Product Manager → IA',
    email: 'elodie@mail.fr',
    phone: '',
    location: 'Paris',
    links: [],
    summary: 'Product Manager, 7 ans d’expérience 🚀.',
    experiences: [
      {
        title: 'Lead PM',
        company: 'Orbis',
        location: '',
        start: '2022',
        end: 'Aujourd’hui',
        highlights: ['Activation ≥ +18 %'],
      },
    ],
    education: [{ degree: 'Master', school: 'ESCP', start: '', end: '2017' }],
    skills: ['SQL'],
    languages: ['Anglais (C1)'],
  },
  lang: 'fr',
  changes: [],
  generatedAt: '2026-10-06T09:00:00.000Z',
  profileUpdatedAt: '2026-10-01T08:00:00.000Z',
};

describe('buildCvPdf', () => {
  it('produit un PDF A4 lisible, même avec des caractères hors police', async () => {
    const bytes = await buildCvPdf(tailored);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(595.28);
    expect(doc.getTitle()).toBe('CV · Élodie Brûlé');
    expect(doc.getAuthor()).toBe('Élodie Brûlé');
  });
});
