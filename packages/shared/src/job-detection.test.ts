import { describe, expect, it } from 'vitest';
import {
  JOB_DETECTION_TEXT_MAX_LENGTH,
  buildJobDetectionPrompt,
  parseJobDetectionResponse,
} from './job-detection';

describe('buildJobDetectionPrompt', () => {
  it("donne l'adresse, le titre et le début du texte de la page", () => {
    const prompt = buildJobDetectionPrompt({
      url: 'https://careers.acme.com/jobs/42',
      title: 'Product Manager',
      text: 'Vos missions : piloter la roadmap.',
    });
    expect(prompt).toContain('https://careers.acme.com/jobs/42');
    expect(prompt).toContain('Titre : Product Manager');
    expect(prompt).toContain('Vos missions : piloter la roadmap.');
  });

  it("n'envoie que le début d'une très longue page", () => {
    const prompt = buildJobDetectionPrompt({ url: 'https://a.fr', text: 'x'.repeat(50_000) });
    expect(prompt.length).toBeLessThan(JOB_DETECTION_TEXT_MAX_LENGTH + 2000);
  });
});

describe('parseJobDetectionResponse', () => {
  it("lit l'en-tête d'une offre, même entouré de texte", () => {
    const text =
      'Voici :\n```json\n{"isJobOffer": true, "title": " Product Manager ", "company": "Acme", "location": ""}\n```';
    expect(parseJobDetectionResponse(text)).toEqual({
      isJobOffer: true,
      title: 'Product Manager',
      company: 'Acme',
    });
  });

  it("reconnaît une page qui n'est pas une offre", () => {
    expect(parseJobDetectionResponse('{"isJobOffer": false}')).toEqual({ isJobOffer: false });
  });

  it.each(['pas de JSON', '{"isJobOffer": true}', '{"isJobOffer": "peut-être"}', '{oups}'])(
    'renvoie null pour une réponse inexploitable : %s',
    (text) => {
      expect(parseJobDetectionResponse(text)).toBeNull();
    },
  );
});
