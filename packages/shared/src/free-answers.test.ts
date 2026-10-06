import { describe, expect, it } from 'vitest';
import {
  buildFreeAnswersPrompt,
  fitAnswer,
  parseFreeAnswersResponse,
  type FreeQuestion,
} from './free-answers';
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
};

const questions: FreeQuestion[] = [
  { label: 'Why do you want to join Acme?', maxLength: 0 },
  { label: 'Décrivez un projet dont vous êtes fier', maxLength: 500 },
];

describe('buildFreeAnswersPrompt', () => {
  it('liste les questions dans l’ordre, avec la longueur attendue', () => {
    const prompt = buildFreeAnswersPrompt(profile, offer, analysis, questions);
    expect(prompt).toContain('1. Why do you want to join Acme? (40 à 110 mots)');
    expect(prompt).toContain('2. Décrivez un projet dont vous êtes fier (425 caractères au plus)');
    expect(prompt).toContain('Exactement 2 réponses');
  });

  it('s’appuie sur le profil, l’offre et son analyse', () => {
    const prompt = buildFreeAnswersPrompt(profile, offer, analysis, questions);
    expect(prompt).toContain('Transcription IA adoptée par 62 % des clients');
    expect(prompt).toContain('You will own the AI roadmap.');
    expect(prompt).toContain('Missions : Porter la roadmap IA');
  });

  it('se passe de l’analyse si l’offre n’a pas été préparée', () => {
    const prompt = buildFreeAnswersPrompt(profile, offer, null, questions);
    expect(prompt).not.toContain('Analyse de l');
  });
});

describe('parseFreeAnswersResponse', () => {
  it('aligne les réponses sur les questions', () => {
    const text = '```json\n{"answers": ["Because of the AI roadmap.", ""]}\n```';
    expect(parseFreeAnswersResponse(text, questions)).toEqual(['Because of the AI roadmap.', '']);
  });

  it('complète par des réponses vides s’il en manque', () => {
    expect(parseFreeAnswersResponse('{"answers": ["Une seule"]}', questions)).toEqual([
      'Une seule',
      '',
    ]);
  });

  it('retire puces et espaces superflus', () => {
    const [answer] = parseFreeAnswersResponse('{"answers": ["- Un   point\\n- Un autre"]}', [
      { label: 'Q', maxLength: 0 },
    ])!;
    expect(answer).toBe('Un point\nUn autre');
  });

  it('respecte la limite du champ', () => {
    const long = 'Première phrase courte. ' + 'mot '.repeat(200);
    const [, answer] = parseFreeAnswersResponse(
      JSON.stringify({ answers: ['', long] }),
      questions,
    )!;
    expect(answer!.length).toBeLessThanOrEqual(500);
  });

  it('renvoie null sans JSON exploitable', () => {
    expect(parseFreeAnswersResponse('Désolé, je ne peux pas.', questions)).toBeNull();
    expect(parseFreeAnswersResponse('{"answers": "non"}', questions)).toBeNull();
  });
});

describe('fitAnswer', () => {
  it('ne touche pas une réponse qui tient', () => {
    expect(fitAnswer('Court.', 100)).toBe('Court.');
    expect(fitAnswer('Sans limite.', 0)).toBe('Sans limite.');
  });

  it('coupe après la dernière phrase complète', () => {
    expect(fitAnswer('Une phrase entière. Une autre bien trop longue', 30)).toBe(
      'Une phrase entière.',
    );
  });

  it('coupe au dernier mot faute de phrase complète', () => {
    expect(fitAnswer('Un texte sans point qui déborde largement', 20)).toBe('Un texte sans point');
  });
});
