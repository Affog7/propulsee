import { describe, expect, it } from 'vitest';
import {
  MAX_CV_TEXT_LENGTH,
  buildProfileExtractionPrompt,
  emptyAnswers,
  emptyProfile,
  normalizeProfile,
  parseProfileResponse,
  profileInitials,
  sameDocumentContent,
} from './profile';

describe('buildProfileExtractionPrompt', () => {
  it('inclut le texte du CV et demande du JSON seul', () => {
    const prompt = buildProfileExtractionPrompt('Camille Martin, Product Manager');
    expect(prompt).toContain('Camille Martin, Product Manager');
    expect(prompt).toContain('uniquement avec un objet JSON');
  });

  it('tronque un texte trop long', () => {
    const prompt = buildProfileExtractionPrompt('x'.repeat(MAX_CV_TEXT_LENGTH + 500));
    expect(prompt).not.toContain('x'.repeat(MAX_CV_TEXT_LENGTH + 1));
  });
});

describe('normalizeProfile', () => {
  it('complète les champs manquants et nettoie les valeurs', () => {
    const profile = normalizeProfile({
      fullName: '  Camille Martin ',
      skills: ['SQL', 'sql', '', null, 'Roadmap'],
      experiences: [
        { title: 'PM', company: 'Orbis', highlights: ['  +30 % ', ''] },
        { title: '', company: '' },
        'pas un objet',
      ],
      education: [{ degree: 'Master', school: 'ESCP', end: 2017 }],
    });
    expect(profile.fullName).toBe('Camille Martin');
    expect(profile.skills).toEqual(['SQL', 'Roadmap']);
    expect(profile.experiences).toEqual([
      { title: 'PM', company: 'Orbis', location: '', start: '', end: '', highlights: ['+30 %'] },
    ]);
    expect(profile.education[0]).toEqual({
      degree: 'Master',
      school: 'ESCP',
      start: '',
      end: '2017',
    });
    expect(profile.links).toEqual([]);
  });

  it('renvoie un profil vide pour une valeur inexploitable', () => {
    expect(normalizeProfile(null)).toEqual(emptyProfile());
  });
});

describe('parseProfileResponse', () => {
  it('lit un JSON entouré de texte ou dans un bloc de code', () => {
    const text = 'Voici le profil :\n```json\n{"fullName":"Camille Martin","skills":["SQL"]}\n```';
    expect(parseProfileResponse(text)).toMatchObject({
      fullName: 'Camille Martin',
      skills: ['SQL'],
    });
  });

  it('renvoie null pour une réponse illisible, tronquée ou vide', () => {
    expect(parseProfileResponse('désolé')).toBeNull();
    expect(parseProfileResponse('{"fullName":"Camille')).toBeNull();
    expect(parseProfileResponse('{"skills":["SQL"]}')).toBeNull();
  });
});

describe('profileInitials', () => {
  it('prend la première lettre du prénom et du nom', () => {
    expect(profileInitials('camille de la Martin')).toBe('CM');
    expect(profileInitials('Camille')).toBe('C');
    expect(profileInitials('  ')).toBe('');
  });
});

describe('réponses aux formulaires', () => {
  it('garde le salaire et l’autorisation de travail, ignore une valeur inconnue', () => {
    expect(
      normalizeProfile({ answers: { salary: ' 65 000 € ', workAuthorization: 'yes' } }).answers,
    ).toEqual({ salary: '65 000 €', workAuthorization: 'yes' });
    expect(normalizeProfile({ answers: { workAuthorization: 'peut-être' } }).answers).toEqual(
      emptyAnswers(),
    );
  });

  it('ne périme pas les documents quand seules les réponses changent', () => {
    const profile = { ...emptyProfile(), fullName: 'Camille Martin' };
    const answered = { ...profile, answers: { salary: '70k', workAuthorization: 'no' as const } };
    expect(sameDocumentContent(profile, answered)).toBe(true);
    expect(sameDocumentContent(profile, { ...profile, fullName: 'Camille Durand' })).toBe(false);
  });
});
