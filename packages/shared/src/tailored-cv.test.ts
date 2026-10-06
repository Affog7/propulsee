import { describe, expect, it } from 'vitest';
import type { JobAnalysis } from './job-analysis';
import { emptyProfile, type MasterProfile } from './profile';
import {
  buildTailoredCvPrompt,
  cvFileName,
  documentFileName,
  parseTailoredCvResponse,
} from './tailored-cv';

const offer = {
  url: 'https://example.com/offre',
  title: 'Senior Product Manager, AI',
  company: 'Acme',
  location: 'Paris',
  description: 'Vous pilotez la roadmap IA.',
};

const analysis: JobAnalysis = {
  summary: 'Piloter la stratégie des fonctionnalités IA.',
  missions: ['Porter la roadmap IA'],
  skills: [{ name: 'Machine learning', inProfile: true }],
  expectations: ['5 ans d’expérience'],
  analyzedAt: '2026-10-05T10:00:00.000Z',
};

const profile: MasterProfile = {
  ...emptyProfile(),
  fullName: 'Camille Martin',
  headline: 'Product Manager · SaaS & IA',
  summary: 'Product Manager avec 7 ans d’expérience.',
  skills: ['Figma', 'SQL', 'IA appliquée'],
  experiences: [
    {
      title: 'Lead PM',
      company: 'Orbis',
      location: 'Paris',
      start: '2022',
      end: 'Aujourd’hui',
      highlights: ['Onboarding : activation +18 %', 'Roadmap de 3 équipes'],
    },
    {
      title: 'Product Owner',
      company: 'Atelier Lumière',
      location: '',
      start: '2017',
      end: '2019',
      highlights: ['Backlog e-commerce', 'Refonte du tunnel', 'Tests A/B'],
    },
  ],
  updatedAt: '2026-10-01T08:00:00.000Z',
};

const now = new Date('2026-10-06T09:00:00.000Z');

describe('buildTailoredCvPrompt', () => {
  it('numérote expériences, réalisations et compétences du profil', () => {
    const prompt = buildTailoredCvPrompt(profile, offer, analysis);
    expect(prompt).toContain('[0] Lead PM — Orbis (2022 – Aujourd’hui)');
    expect(prompt).toContain('    1. Roadmap de 3 équipes');
    expect(prompt).toContain('[2] IA appliquée');
    expect(prompt).toContain('Compétences clés : Machine learning');
    expect(prompt).toContain('Vous pilotez la roadmap IA.');
  });
});

describe('parseTailoredCvResponse', () => {
  it('construit le CV à partir des indices et liste les changements', () => {
    const response = JSON.stringify({
      lang: 'fr',
      summary: 'Product Manager SaaS et IA, 7 ans d’expérience.',
      summaryReason: 'L’offre cite l’IA dès l’intitulé.',
      experiences: [
        { index: 0, highlights: [1, 0], reason: 'La roadmap d’abord.' },
        { index: 1, highlights: [0], reason: '' },
      ],
      skills: [2, 1],
      skillsReason: 'IA en premier.',
    });
    const tailored = parseTailoredCvResponse(response, profile, now);
    expect(tailored?.cv.summary).toBe('Product Manager SaaS et IA, 7 ans d’expérience.');
    expect(tailored?.cv.experiences[0]?.highlights).toEqual([
      'Roadmap de 3 équipes',
      'Onboarding : activation +18 %',
    ]);
    expect(tailored?.cv.experiences[1]?.highlights).toEqual(['Backlog e-commerce']);
    expect(tailored?.cv.skills).toEqual(['IA appliquée', 'SQL']);
    expect(tailored?.cv).not.toHaveProperty('updatedAt');
    expect(tailored?.profileUpdatedAt).toBe('2026-10-01T08:00:00.000Z');
    expect(tailored?.generatedAt).toBe('2026-10-06T09:00:00.000Z');
    expect(tailored?.changes).toEqual([
      {
        kind: 'summary',
        title: 'Accroche adaptée',
        detail: 'L’offre cite l’IA dès l’intitulé.',
        before: 'Product Manager avec 7 ans d’expérience.',
      },
      {
        kind: 'experience',
        title: 'Orbis mis en avant',
        detail: 'La roadmap d’abord.',
        experienceIndex: 0,
      },
      {
        kind: 'experience',
        title: 'Atelier Lumière raccourci',
        detail: '1 ligne au lieu de 3.',
        experienceIndex: 1,
      },
      {
        kind: 'skills',
        title: 'Compétences réordonnées',
        detail: 'IA en premier. 1 compétence hors sujet retirée.',
      },
    ]);
  });

  it('n’invente rien : indices hors limites et doublons ignorés', () => {
    const response = JSON.stringify({
      summary: profile.summary,
      experiences: [
        { index: 0, highlights: [0, 0, 7, -1, 1.5] },
        { index: 9, highlights: [0] },
      ],
      skills: [0, 42, 'Kubernetes'],
    });
    const tailored = parseTailoredCvResponse(response, profile, now);
    expect(tailored?.cv.experiences[0]?.highlights).toEqual(['Onboarding : activation +18 %']);
    expect(tailored?.cv.experiences).toHaveLength(2);
    expect(tailored?.cv.skills).toEqual(['Figma']);
  });

  it('retrouve une réalisation citée en texte plutôt que par son numéro', () => {
    const response = JSON.stringify({
      experiences: [{ index: 0, highlights: ['roadmap de 3 équipes'] }],
    });
    const tailored = parseTailoredCvResponse(response, profile, now);
    expect(tailored?.cv.experiences[0]?.highlights).toEqual(['Roadmap de 3 équipes']);
  });

  it('garde le profil tel quel quand la réponse ne change rien', () => {
    const response = JSON.stringify({ summary: '', experiences: [{ index: 1, highlights: [] }] });
    const tailored = parseTailoredCvResponse(response, profile, now);
    expect(tailored?.cv.summary).toBe(profile.summary);
    expect(tailored?.cv.experiences[1]?.highlights).toHaveLength(3);
    expect(tailored?.cv.skills).toEqual(profile.skills);
    expect(tailored?.changes).toEqual([]);
    expect(tailored?.lang).toBe('fr');
  });

  it('écrit une accroche absente du profil, en anglais si le profil l’est', () => {
    const response = JSON.stringify({ lang: 'en', summary: 'Product Manager, SaaS & AI.' });
    const tailored = parseTailoredCvResponse(response, { ...profile, summary: '' }, now);
    expect(tailored?.lang).toBe('en');
    expect(tailored?.changes[0]).toMatchObject({ kind: 'summary', title: 'Accroche écrite' });
    expect(tailored?.changes[0]).not.toHaveProperty('before');
  });

  it('tolère un bloc de code autour du JSON', () => {
    const tailored = parseTailoredCvResponse('```json\n{"skills":[1]}\n```', profile, now);
    expect(tailored?.cv.skills).toEqual(['SQL']);
  });

  it('renvoie null sans JSON exploitable', () => {
    expect(parseTailoredCvResponse('Désolé.', profile, now)).toBeNull();
    expect(parseTailoredCvResponse('{"foo": 1}', profile, now)).toBeNull();
    expect(parseTailoredCvResponse('{oups}', profile, now)).toBeNull();
  });
});

describe('cvFileName', () => {
  it('nomme le PDF d’après le candidat et l’entreprise, sans accents', () => {
    expect(cvFileName('Camille Martin', 'Acme')).toBe('Camille-Martin-CV-Acme.pdf');
    expect(cvFileName('Élodie Brûlé', 'L’Oréal Paris')).toBe('Elodie-Brule-CV-L-Oreal-Paris.pdf');
    expect(cvFileName('', undefined)).toBe('CV.pdf');
  });
});

describe('documentFileName', () => {
  it('nomme la lettre comme le CV', () => {
    expect(documentFileName('Camille Martin', 'Lettre', 'Acme')).toBe(
      'Camille-Martin-Lettre-Acme.pdf',
    );
  });
});
