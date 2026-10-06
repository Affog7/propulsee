import type { JobAnalysis } from '@propulsee/shared';
import { describe, expect, it } from 'vitest';
import { keepRecent } from './job-analysis';

function analysis(analyzedAt: string): JobAnalysis {
  return { summary: '', missions: ['m'], skills: [], expectations: [], analyzedAt };
}

describe('keepRecent', () => {
  it('garde les analyses les plus récentes', () => {
    const kept = keepRecent(
      {
        a: analysis('2026-10-01T00:00:00Z'),
        b: analysis('2026-10-03T00:00:00Z'),
        c: analysis('2026-10-02T00:00:00Z'),
      },
      2,
    );
    expect(Object.keys(kept).sort()).toEqual(['b', 'c']);
  });
});
