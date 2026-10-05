import { describe, expect, it } from 'vitest';
import { APPLICATION_STEPS, nextStep } from './steps';

describe('nextStep', () => {
  it('suit le flux Préparer → Vérifier → Postuler', () => {
    expect(APPLICATION_STEPS).toEqual(['prepare', 'verify', 'apply']);
    expect(nextStep('prepare')).toBe('verify');
    expect(nextStep('verify')).toBe('apply');
  });

  it('renvoie null après la dernière étape', () => {
    expect(nextStep('apply')).toBeNull();
  });
});
