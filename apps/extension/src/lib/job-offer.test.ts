import { describe, expect, it } from 'vitest';
import {
  JOB_DESCRIPTION_MAX_LENGTH,
  buildJobOffer,
  htmlToText,
  parseJobPosting,
} from './job-offer';

const URL = 'https://www.welcometothejungle.com/fr/companies/acme/jobs/senior-pm_paris';

const posting = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Senior Product Manager, AI &amp; Data',
  hiringOrganization: { '@type': 'Organization', name: 'Acme' },
  jobLocation: [
    { '@type': 'Place', address: { addressLocality: 'Paris', addressCountry: 'FR' } },
    { '@type': 'Place', address: { addressLocality: 'Paris', addressCountry: 'FR' } },
    { '@type': 'Place', address: { addressLocality: 'Lyon', addressCountry: 'FR' } },
  ],
  description: '<p>Vous pilotez la <b>roadmap</b>.</p><ul><li>SaaS B2B</li><li>ML</li></ul>',
};

describe('htmlToText', () => {
  it('garde les paragraphes et les listes', () => {
    expect(htmlToText('<p>Bonjour&nbsp;!</p><p>Missions :</p><ul><li>A</li><li>B</li></ul>')).toBe(
      'Bonjour !\nMissions :\n\n• A\n• B',
    );
  });

  it('lit le HTML échappé deux fois', () => {
    expect(htmlToText('&lt;p&gt;R&amp;amp;D&lt;/p&gt;&lt;p&gt;Paris&lt;/p&gt;')).toBe('R&D\nParis');
  });
});

describe('parseJobPosting', () => {
  it("lit l'offre d'un @graph et ignore le JSON invalide", () => {
    const graph = { '@graph': [{ '@type': 'WebPage' }, { ...posting, '@type': ['JobPosting'] }] };
    expect(parseJobPosting(['{oups', JSON.stringify(graph)])).toEqual({
      title: 'Senior Product Manager, AI & Data',
      company: 'Acme',
      location: 'Paris, Lyon',
      description: 'Vous pilotez la roadmap.\n\n• SaaS B2B\n• ML',
    });
  });

  it('signale le télétravail sans lieu', () => {
    const remote = { '@type': 'JobPosting', title: 'Dev', jobLocationType: 'TELECOMMUTE' };
    expect(parseJobPosting([JSON.stringify(remote)])?.location).toBe('Télétravail');
  });

  it('renvoie null sans offre sur la page', () => {
    expect(parseJobPosting([JSON.stringify({ '@type': 'Organization' })])).toBeNull();
  });
});

describe('buildJobOffer', () => {
  it('préfère le JSON-LD pour le titre et le texte affiché pour la description', () => {
    const offer = buildJobOffer({
      url: URL,
      jsonLd: [JSON.stringify(posting)],
      title: 'Titre affiché',
      company: 'Acme SAS\n4,5 ★',
      description: '  À propos   du poste\n\n\n\nVous pilotez la roadmap. ',
    });
    expect(offer).toEqual({
      url: URL,
      title: 'Senior Product Manager, AI & Data',
      company: 'Acme',
      location: 'Paris, Lyon',
      description: 'À propos du poste\n\nVous pilotez la roadmap.',
    });
  });

  it('se rabat sur les sélecteurs, puis sur le titre de la page', () => {
    expect(
      buildJobOffer({ url: URL, jsonLd: [], title: 'PM\nPromue', company: 'Acme\nSuivre' }),
    ).toEqual({ url: URL, title: 'PM', company: 'Acme' });
    expect(buildJobOffer({ url: URL, jsonLd: [], heading: 'Data Analyst' })?.title).toBe(
      'Data Analyst',
    );
    expect(
      buildJobOffer({ url: URL, jsonLd: [], ogTitle: 'Acme recrute un PM | LinkedIn' })?.title,
    ).toBe('Acme recrute un PM');
  });

  it('tronque les descriptions trop longues', () => {
    const offer = buildJobOffer({
      url: URL,
      jsonLd: [],
      title: 'PM',
      description: 'a'.repeat(30_000),
    });
    expect(offer?.description).toHaveLength(JOB_DESCRIPTION_MAX_LENGTH);
  });

  it("renvoie null quand la page n'a pas d'offre lisible", () => {
    expect(buildJobOffer({ url: URL, jsonLd: [] })).toBeNull();
  });
});
