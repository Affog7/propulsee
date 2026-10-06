import type { TailoredCv } from '@propulsee/shared';
import { describe, expect, it } from 'vitest';
import { keepRecentCvs } from './tailored-cv';

function cv(generatedAt: string): TailoredCv {
  return {
    cv: {} as TailoredCv['cv'],
    lang: 'fr',
    changes: [],
    generatedAt,
    profileUpdatedAt: '',
  };
}

describe('keepRecentCvs', () => {
  it('garde les CV les plus récents', () => {
    const kept = keepRecentCvs(
      {
        a: cv('2026-10-01T00:00:00Z'),
        b: cv('2026-10-03T00:00:00Z'),
        c: cv('2026-10-02T00:00:00Z'),
      },
      2,
    );
    expect(Object.keys(kept).sort()).toEqual(['b', 'c']);
  });
});
