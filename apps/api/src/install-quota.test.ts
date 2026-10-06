import { describe, expect, it } from 'vitest';
import { createInstallQuota } from './install-quota';

describe('createInstallQuota', () => {
  it('refuse au-delà de la limite du jour, installation par installation', () => {
    const quota = createInstallQuota(2, () => new Date('2026-10-06T10:00:00Z'));
    expect(quota.take('a')).toBe(true);
    expect(quota.take('a')).toBe(true);
    expect(quota.take('a')).toBe(false);
    expect(quota.take('b')).toBe(true);
  });

  it('repart de zéro le lendemain', () => {
    let now = new Date('2026-10-06T23:59:00Z');
    const quota = createInstallQuota(1, () => now);
    expect(quota.take('a')).toBe(true);
    expect(quota.take('a')).toBe(false);
    now = new Date('2026-10-07T00:01:00Z');
    expect(quota.take('a')).toBe(true);
  });
});
