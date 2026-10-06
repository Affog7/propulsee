import { describe, expect, it } from 'vitest';
import { joinTextParts } from './pdf-text';

describe('joinTextParts', () => {
  it('recompose les lignes et ignore le contenu balisé', () => {
    const text = joinTextParts([
      { str: 'Camille', hasEOL: false },
      { str: 'Martin', hasEOL: true },
      {},
      { str: '  Product   Manager ', hasEOL: true },
      { str: '', hasEOL: true },
      { str: 'Paris', hasEOL: false },
    ]);
    expect(text).toBe('Camille Martin\nProduct Manager\nParis');
  });
});
