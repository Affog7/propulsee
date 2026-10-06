import { describe, expect, it } from 'vitest';
import { fromBase64 } from './applications';
import { toBase64 } from './autofill-tab';

describe('fromBase64', () => {
  it('rend les octets encodés par toBase64', () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 0, 255, 128]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });
});
