import { describe, expect, it } from 'vitest';
import {
  buildCoverLetterPrompt,
  countWords,
  normalizeLetterText,
  parseCoverLetterResponse,
} from './cover-letter';
import type { JobAnalysis } from './job-analysis';
import { emptyProfile, type MasterProfile } from './profile';

const offer = {
  url: 'https://example.com/offre',
  title: 'Senior Product Manager, AI',
  company: 'Acme',
  location: 'Paris',
  description: 'You will own the AI roadmap.',
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
  skills: ['SQL'],
  experiences: [
    {
      title: 'Product Manager',
      company: 'Nuvia',
      location: '',
      start: '2019',
      end: '2022',
      highlights: ['Transcription IA adoptée par 62 % des clients'],
    },
  ],
  updatedAt: '2026-10-01T08:00:00.000Z',
};

const now = new Date('2026-10-06T09:00:00.000Z');

describe('buildCoverLetterPrompt', () => {
  it('donne le format, l’offre, son analyse et le profil', () => {
    const prompt = buildCoverLetterPrompt(profile, offer, analysis, 'short');
    expect(prompt).toContain('120 à 180 mots');
    expect(prompt).toContain('Offre : Senior Product Manager, AI · Acme · Paris');
    expect(prompt).toContain('Compétences clés : Machine learning');
    expect(prompt).toContain('You will own the AI roadmap.');
    expect(prompt).toContain('Profil du candidat (Camille Martin)');
    expect(prompt).toContain('Transcription IA adoptée par 62 % des clients');
  });

  it('adapte la consigne au message recruteur', () => {
    const prompt = buildCoverLetterPrompt(profile, offer, analysis, 'message');
    expect(prompt).toContain('un message à un recruteur');
    expect(prompt).toContain('60 à 100 mots');
  });
});

describe('parseCoverLetterResponse', () => {
  it('lit le texte, la langue et les raisons', () => {
    const response = JSON.stringify({
      lang: 'en',
      text: 'Hello,\n\n  Acme is moving AI   to daily use.  \n\n\n\nCamille Martin',
      why: ['Elle s’ouvre sur l’enjeu d’Acme', 'Elle cite un chiffre', 'Courte', 'De trop', ''],
    });
    const letter = parseCoverLetterResponse(response, 'short', profile, now);
    expect(letter).toEqual({
      format: 'short',
      lang: 'en',
      text: 'Hello,\n\nAcme is moving AI to daily use.\n\nCamille Martin',
      why: ['Elle s’ouvre sur l’enjeu d’Acme', 'Elle cite un chiffre', 'Courte'],
      edited: false,
      generatedAt: '2026-10-06T09:00:00.000Z',
      profileUpdatedAt: '2026-10-01T08:00:00.000Z',
    });
  });

  it('tolère un bloc de code et l’absence de raisons', () => {
    const letter = parseCoverLetterResponse(
      '```json\n{"text":"Bonjour,"}\n```',
      'classic',
      profile,
      now,
    );
    expect(letter?.text).toBe('Bonjour,');
    expect(letter?.why).toEqual([]);
    expect(letter?.lang).toBe('fr');
  });

  it('renvoie null sans texte exploitable', () => {
    expect(parseCoverLetterResponse('Désolé.', 'short', profile, now)).toBeNull();
    expect(parseCoverLetterResponse('{"text":"  "}', 'short', profile, now)).toBeNull();
    expect(parseCoverLetterResponse('{oups}', 'short', profile, now)).toBeNull();
  });
});

describe('normalizeLetterText', () => {
  it('garde les retours à la ligne d’un paragraphe et une seule ligne vide entre deux', () => {
    expect(normalizeLetterText('Cordialement,\r\nCamille\n \n\nPS')).toBe(
      'Cordialement,\nCamille\n\nPS',
    );
  });
});

describe('countWords', () => {
  it('compte les mots, sans la ponctuation isolée', () => {
    expect(countWords('Bonjour, je suis — vraiment — ravie d’échanger.')).toBe(6);
    expect(countWords('')).toBe(0);
  });
});
