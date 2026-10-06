import { describe, expect, it } from 'vitest';
import { buildJobAnalysisPrompt, parseJobAnalysisResponse, profileDigest } from './job-analysis';
import { emptyProfile, type MasterProfile } from './profile';

const offer = {
  url: 'https://example.com/offre',
  title: 'Senior Product Manager, AI',
  company: 'Acme',
  location: 'Paris',
  description: 'Vous pilotez la roadmap IA. 5 ans d’expérience en SaaS B2B.',
};

const profile: MasterProfile = {
  ...emptyProfile(),
  fullName: 'Camille Martin',
  headline: 'Product Manager · SaaS & IA',
  skills: ['Roadmap', 'SQL'],
  experiences: [
    {
      title: 'Product Manager',
      company: 'Orbis',
      location: '',
      start: '2019',
      end: 'Aujourd’hui',
      highlights: ['Lancement de 3 fonctionnalités IA'],
    },
  ],
};

describe('profileDigest', () => {
  it('résume titre, compétences et expériences du profil', () => {
    const digest = profileDigest(profile);
    expect(digest).toContain('Product Manager · SaaS & IA');
    expect(digest).toContain('Compétences : Roadmap, SQL');
    expect(digest).toContain('- Product Manager, Orbis ; Lancement de 3 fonctionnalités IA');
  });

  it('ignore les champs vides', () => {
    expect(profileDigest(emptyProfile())).toBe('');
  });
});

describe('buildJobAnalysisPrompt', () => {
  it('inclut l’offre et le profil et demande du JSON seul', () => {
    const prompt = buildJobAnalysisPrompt(offer, profile);
    expect(prompt).toContain('Senior Product Manager, AI · Acme · Paris');
    expect(prompt).toContain('Vous pilotez la roadmap IA.');
    expect(prompt).toContain('Compétences : Roadmap, SQL');
    expect(prompt).toContain('uniquement avec un objet JSON');
  });

  it('sans profil, demande inProfile à false', () => {
    const prompt = buildJobAnalysisPrompt(offer, null);
    expect(prompt).not.toContain('Profil du candidat');
    expect(prompt).toContain('aucun profil');
  });
});

describe('parseJobAnalysisResponse', () => {
  const now = new Date('2026-10-06T08:00:00Z');

  it('lit un JSON entouré de texte et nettoie les listes', () => {
    const text = `Voici :\n\`\`\`json\n${JSON.stringify({
      summary: ' Piloter les fonctionnalités IA. ',
      missions: ['Porter la roadmap', 'Porter la roadmap', '', 42],
      skills: [{ name: 'SaaS', inProfile: true }, { name: 'saas' }, 'Python', { inProfile: true }],
      expectations: ['5 ans d’expérience'],
    })}\n\`\`\``;
    expect(parseJobAnalysisResponse(text, now)).toEqual({
      summary: 'Piloter les fonctionnalités IA.',
      missions: ['Porter la roadmap'],
      skills: [
        { name: 'SaaS', inProfile: true },
        { name: 'Python', inProfile: false },
      ],
      expectations: ['5 ans d’expérience'],
      analyzedAt: '2026-10-06T08:00:00.000Z',
    });
  });

  it('limite le nombre d’éléments', () => {
    const many = Array.from({ length: 12 }, (_, i) => `élément ${i}`);
    const analysis = parseJobAnalysisResponse(
      JSON.stringify({ missions: many, skills: many, expectations: many }),
    );
    expect(analysis?.missions).toHaveLength(5);
    expect(analysis?.skills).toHaveLength(8);
    expect(analysis?.expectations).toHaveLength(5);
  });

  it('renvoie null pour une réponse illisible, tronquée ou vide', () => {
    expect(parseJobAnalysisResponse('désolé')).toBeNull();
    expect(parseJobAnalysisResponse('{"missions":["Porter')).toBeNull();
    expect(parseJobAnalysisResponse('{"summary":"Un poste"}')).toBeNull();
    expect(parseJobAnalysisResponse('[]')).toBeNull();
  });
});
