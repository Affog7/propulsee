import { describe, expect, it } from 'vitest';
import {
  addApplication,
  applicationsSummary,
  findApplication,
  normalizeApplications,
  removeApplication,
  sentDateLabel,
  setApplicationStatus,
  type SentApplication,
} from './applications';

function sent(url: string, extra: Partial<SentApplication> = {}): SentApplication {
  return {
    offer: { url, title: 'Senior Product Manager, AI', company: 'Acme' },
    sentAt: '2026-10-05T09:00:00.000Z',
    status: 'sent',
    cv: { name: 'Camille-Martin-CV-Acme.pdf', base64: 'JVBERi0=' },
    letter: null,
    answers: [],
    confirmed: [],
    declarations: [],
    fields: 8,
    ...extra,
  };
}

describe('addApplication', () => {
  it('ajoute la candidature en tête de liste', () => {
    const list = addApplication([sent('https://a')], sent('https://b'));
    expect(list.map((a) => a.offer.url)).toEqual(['https://b', 'https://a']);
  });

  it('remplace un envoi précédent pour la même offre en gardant son statut', () => {
    const before = [sent('https://a', { status: 'interview' }), sent('https://b')];
    const list = addApplication(before, sent('https://a', { fields: 12 }));
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ status: 'interview', fields: 12 });
  });

  it('garde au plus `max` candidatures, les plus récentes', () => {
    const list = addApplication([sent('https://a'), sent('https://b')], sent('https://c'), 2);
    expect(list.map((a) => a.offer.url)).toEqual(['https://c', 'https://a']);
  });
});

describe('statut et retrait', () => {
  it('change le statut de la seule candidature visée', () => {
    const list = setApplicationStatus(
      [sent('https://a'), sent('https://b')],
      'https://b',
      'rejected',
    );
    expect(list.map((a) => a.status)).toEqual(['sent', 'rejected']);
  });

  it('retire une candidature de la liste', () => {
    const list = removeApplication([sent('https://a'), sent('https://b')], 'https://a');
    expect(findApplication(list, 'https://a')).toBeUndefined();
    expect(findApplication(list, 'https://b')).toBeDefined();
  });
});

describe('applicationsSummary', () => {
  it('compte les envois et les entretiens', () => {
    expect(applicationsSummary([])).toBe('Aucune candidature envoyée');
    expect(applicationsSummary([sent('https://a')])).toBe('1 envoyée');
    expect(
      applicationsSummary([
        sent('https://a', { status: 'interview' }),
        sent('https://b'),
        sent('https://c', { status: 'rejected' }),
      ]),
    ).toBe('3 envoyées · 1 entretien');
  });
});

describe('sentDateLabel', () => {
  const now = new Date(2026, 9, 6, 15, 0);

  it('dit « Aujourd’hui » et « Hier »', () => {
    expect(sentDateLabel(new Date(2026, 9, 6, 8, 0).toISOString(), now)).toBe('Aujourd’hui');
    expect(sentDateLabel(new Date(2026, 9, 5, 23, 0).toISOString(), now)).toBe('Hier');
  });

  it('donne le jour et le mois, et l’année si elle diffère', () => {
    expect(sentDateLabel(new Date(2026, 8, 28).toISOString(), now)).toBe('28 sept.');
    expect(sentDateLabel(new Date(2025, 11, 2).toISOString(), now)).toBe('2 déc. 2025');
  });

  it('ignore une date illisible', () => {
    expect(sentDateLabel('pas une date', now)).toBe('');
  });
});

describe('normalizeApplications', () => {
  it('écarte les entrées illisibles et complète les champs manquants', () => {
    const list = normalizeApplications([
      null,
      { offer: { title: 'Sans URL' } },
      {
        offer: { url: 'https://a', title: 'PM' },
        status: 'inconnu',
        letter: { name: 'Lettre.pdf', base64: 'JVBE', text: 'Bonjour,' },
        answers: [{ question: 'Pourquoi nous ?', answer: 'Parce que.' }, { answer: 'orpheline' }],
      },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      status: 'sent',
      cv: null,
      letter: { name: 'Lettre.pdf', text: 'Bonjour,' },
      answers: [{ question: 'Pourquoi nous ?', answer: 'Parce que.' }],
      declarations: [],
      fields: 0,
    });
  });

  it('renvoie une liste vide pour un stockage vide', () => {
    expect(normalizeApplications(undefined)).toEqual([]);
  });
});
