import { describe, expect, it } from 'vitest';
import { detectedOffer, detectionPage, postingOffer, prefilterPage } from './any-job-page';
import type { RawAnyPage } from './collect-any-page';

const OFFER_TEXT = `Product Manager IA (H/F)
CDI · Lyon · Télétravail partiel
Vos missions : piloter la roadmap, animer l'équipe produit, suivre les indicateurs.
Profil recherché : 5 ans d'expérience en SaaS B2B, anglais courant.
Rémunération : 55-65 k€ selon profil.
${'Nous construisons des outils pour les équipes RH. '.repeat(10)}`;

const ARTICLE_TEXT = `Les dix tendances du design en 2026
${'Le design évolue vite, et les équipes adoptent de nouveaux outils chaque année. '.repeat(10)}`;

function page(overrides: Partial<RawAnyPage> = {}): RawAnyPage {
  return {
    url: 'https://careers.acme.com/jobs/product-manager-ia',
    jsonLd: [],
    heading: 'Product Manager IA (H/F)',
    text: OFFER_TEXT,
    applyAction: true,
    ...overrides,
  };
}

const posting = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Product Manager IA',
  hiringOrganization: { '@type': 'Organization', name: 'Acme' },
  jobLocation: { '@type': 'Place', address: { addressLocality: 'Lyon' } },
  description: '<p>Piloter la roadmap.</p>',
});

describe('prefilterPage', () => {
  it('lit directement une offre publiée en JSON-LD, sans LLM', () => {
    expect(prefilterPage(page({ jsonLd: [posting], text: '' }))).toBe('posting');
  });

  it('envoie au LLM une page qui ressemble à une fiche de poste', () => {
    expect(prefilterPage(page())).toBe('likely');
    // Même sans adresse ni bouton typiques, le texte suffit.
    expect(prefilterPage(page({ url: 'https://acme.fr/p/42', applyAction: false }))).toBe('likely');
  });

  it("garde pour soi les pages qui n'y ressemblent pas", () => {
    expect(
      prefilterPage(
        page({ url: 'https://blog.acme.fr/design', text: ARTICLE_TEXT, applyAction: false }),
      ),
    ).toBe('unlikely');
    // Une page presque vide n'est pas une offre lisible.
    expect(prefilterPage(page({ text: 'Postuler' }))).toBe('unlikely');
  });
});

describe('postingOffer', () => {
  it("prend l'offre du JSON-LD", () => {
    expect(postingOffer(page({ jsonLd: [posting] }))).toEqual({
      url: 'https://careers.acme.com/jobs/product-manager-ia',
      title: 'Product Manager IA',
      company: 'Acme',
      location: 'Lyon',
      description: 'Piloter la roadmap.',
    });
  });

  it('se rabat sur le texte de la page quand le JSON-LD est sans description', () => {
    const bare = JSON.stringify({ '@type': 'JobPosting', title: 'Product Manager IA' });
    expect(postingOffer(page({ jsonLd: [bare] }))?.description).toContain('Vos missions');
  });
});

describe('detectedOffer', () => {
  it("assemble l'en-tête lu par le LLM et le texte de la page", () => {
    expect(
      detectedOffer(page(), { isJobOffer: true, title: 'Product Manager IA', company: 'Acme' }),
    ).toEqual({
      url: 'https://careers.acme.com/jobs/product-manager-ia',
      title: 'Product Manager IA',
      company: 'Acme',
      description: OFFER_TEXT.trim(),
    });
  });
});

describe('detectionPage', () => {
  it('montre au LLM le titre de la page et son texte', () => {
    expect(detectionPage(page({ heading: undefined, ogTitle: 'PM IA | Acme' }))).toEqual({
      url: 'https://careers.acme.com/jobs/product-manager-ia',
      title: 'PM IA | Acme',
      text: OFFER_TEXT,
    });
  });
});
